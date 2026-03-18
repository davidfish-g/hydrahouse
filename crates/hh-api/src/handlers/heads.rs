use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use hh_core::head::{CreateHeadRequest, HeadStatus};

use crate::auth::AccountId;
use crate::error::ApiError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn create_head(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Json(req): Json<CreateHeadRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if req.participants < 1 || req.participants > 10 {
        return Err(ApiError::bad_request(
            "participants must be between 1 and 10",
        ));
    }

    // Billing gate: check balance before provisioning (actual charge happens on HeadIsOpen).
    // Testnets (preprod, preview) are free.
    if !state.config.stripe_secret_key.is_empty() && !crate::billing::is_free_network(&req.network.to_string()) {
        crate::billing::check_sufficient_balance(&state, account.0, state.config.cost_head_open_cents).await?;
    }

    let config = req.config.unwrap_or_default();
    let config_json =
        serde_json::to_value(&config).map_err(|e| ApiError::internal(e.to_string()))?;

    // 1. Create head record in DB
    let head_row = hh_db::repo::heads::create(
        &state.db,
        account.0,
        &req.network.to_string(),
        req.participants,
        &config_json,
    )
    .await?;

    // 2. Create participant records
    let mut participants = Vec::new();
    for i in 0..req.participants {
        let p = hh_db::repo::participants::create(&state.db, head_row.id, i).await?;
        participants.push(p);
    }

    hh_db::repo::head_events::insert(
        &state.db,
        head_row.id,
        "head_requested",
        &json!({ "network": req.network.to_string(), "participants": req.participants }),
    )
    .await?;

    // 3. Transition to provisioning and kick off orchestration in background
    hh_db::repo::heads::update_status(&state.db, head_row.id, "provisioning").await?;

    let head_id = head_row.id;
    let participant_count = req.participants as u32;
    let network = req.network;
    let provision_config = config.clone();
    let db = state.db.clone();
    let state_clone = state.clone();

    tokio::spawn(async move {
        tracing::info!(%head_id, "starting head provisioning");

        match state_clone
            .orchestrator
            .provision_head(head_id, participant_count, network, &provision_config)
            .await
        {
            Ok(deployment) => {
                if let Ok(participants) =
                    hh_db::repo::participants::list_by_head(&db, head_id).await
                {
                    for (idx, node) in deployment.nodes.iter().enumerate() {
                        if let Some(p) = participants.iter().find(|p| p.slot_index == idx as i32) {
                            if let Err(e) = hh_db::repo::participants::update_keys(
                                &db,
                                p.id,
                                &node.cardano_address,
                                &node.keys_secret_ref,
                            )
                            .await
                            {
                                tracing::warn!(%head_id, error = %e, "failed to update participant keys");
                            }
                        }
                    }
                }

                if let Err(e) = hh_db::repo::heads::update_status(&db, head_id, "initializing").await {
                    tracing::warn!(%head_id, error = %e, "failed to update status to initializing");
                }
                if let Err(e) = hh_db::repo::head_events::insert(
                    &db,
                    head_id,
                    "head_provisioned",
                    &json!({ "node_count": deployment.nodes.len() }),
                )
                .await
                {
                    tracing::warn!(%head_id, error = %e, "failed to insert head_provisioned event");
                }

                // Start lifecycle monitor (single monitor on node 0 handles all nodes)
                {
                    let node_idx = 0u32;
                    crate::lifecycle::spawn_lifecycle_monitor(
                        state_clone.clone(),
                        head_id,
                        node_idx,
                    );
                }

                tracing::info!(%head_id, participant_count, "head provisioned and lifecycle monitors started");
            }
            Err(e) => {
                tracing::error!(%head_id, error = %e, "head provisioning failed");
                let provision_err = e.to_string();
                if let Err(e) = hh_db::repo::heads::update_status(&db, head_id, "aborted").await {
                    tracing::warn!(%head_id, error = %e, "failed to update status to aborted");
                }
                if let Err(e) = hh_db::repo::head_events::insert(
                    &db,
                    head_id,
                    "provisioning_failed",
                    &json!({ "error": provision_err }),
                )
                .await
                {
                    tracing::warn!(%head_id, error = %e, "failed to insert provisioning_failed event");
                }
            }
        }
    });

    let ws_url = format!("{}/v1/heads/{}/ws", state.config.ws_base_url, head_row.id);

    Ok(Json(json!({
        "head_id": head_row.id,
        "status": "provisioning",
        "network": head_row.network,
        "participant_count": head_row.participant_count,
        "ws_url": ws_url,
        "participants": participants.iter().map(|p| json!({
            "id": p.id,
            "slot_index": p.slot_index,
            "commit_status": p.commit_status,
        })).collect::<Vec<_>>(),
        "created_at": head_row.created_at,
    })))
}

pub async fn list_heads(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let limit = pagination.limit.unwrap_or(50).clamp(1, 100);
    let offset = pagination.offset.unwrap_or(0).max(0);

    let rows =
        hh_db::repo::heads::list_by_account_paginated(&state.db, account.0, limit, offset)
            .await?;

    let heads: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "head_id": r.id,
                "network": r.network,
                "status": r.status,
                "participant_count": r.participant_count,
                "created_at": r.created_at,
                "closed_at": r.closed_at,
            })
        })
        .collect();

    Ok(Json(json!({ "heads": heads, "limit": limit, "offset": offset })))
}

pub async fn get_head(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = super::get_owned_head(&state.db, head_id, account.0).await?;

    let participants = hh_db::repo::participants::list_by_head(&state.db, head_id).await?;
    let ws_url = format!("{}/v1/heads/{}/ws", state.config.ws_base_url, head_id);

    Ok(Json(json!({
        "head_id": row.id,
        "network": row.network,
        "status": row.status,
        "participant_count": row.participant_count,
        "config": row.config_json,
        "ws_url": ws_url,
        "participants": participants.iter().map(|p| json!({
            "id": p.id,
            "slot_index": p.slot_index,
            "cardano_address": p.cardano_address,
            "commit_status": p.commit_status,
        })).collect::<Vec<_>>(),
        "created_at": row.created_at,
        "closed_at": row.closed_at,
    })))
}

pub async fn close_head(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = super::get_owned_head(&state.db, head_id, account.0).await?;

    let current_status: HeadStatus = row
        .status
        .parse()
        .map_err(|e: String| ApiError::internal(e))?;

    if !current_status.can_transition_to(HeadStatus::Closing) {
        return Err(ApiError::bad_request(format!(
            "cannot close head in '{}' state",
            row.status
        )));
    }

    let updated = hh_db::repo::heads::update_status(&state.db, head_id, "closing").await?;

    hh_db::repo::head_events::insert(
        &state.db,
        head_id,
        "head_close_requested",
        &json!({ "previous_status": row.status }),
    )
    .await?;

    // Send close command to hydra-node via WebSocket
    let state_clone = state.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::lifecycle::send_hydra_command(&state_clone, head_id, "Close").await {
            tracing::error!(%head_id, error = %e, "failed to send close command");
        }
    });

    Ok(Json(json!({
        "head_id": updated.id,
        "status": updated.status,
    })))
}

pub async fn get_head_events(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let _row = super::get_owned_head(&state.db, head_id, account.0).await?;

    let limit = pagination.limit.unwrap_or(50).clamp(1, 100);
    let offset = pagination.offset.unwrap_or(0).max(0);

    let events =
        hh_db::repo::head_events::list_by_head_paginated(&state.db, head_id, limit, offset)
            .await?;

    let events_json: Vec<serde_json::Value> = events
        .iter()
        .map(|e| {
            json!({
                "id": e.id,
                "event_type": e.event_type,
                "payload": e.payload_json,
                "created_at": e.created_at,
            })
        })
        .collect();

    Ok(Json(json!({ "events": events_json, "limit": limit, "offset": offset })))
}

pub async fn abort_head(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = super::get_owned_head(&state.db, head_id, account.0).await?;

    let current_status: HeadStatus = row
        .status
        .parse()
        .map_err(|e: String| ApiError::internal(e))?;

    if !current_status.can_transition_to(HeadStatus::Aborted) {
        return Err(ApiError::bad_request(format!(
            "cannot abort head in '{}' state",
            row.status
        )));
    }

    let updated = hh_db::repo::heads::update_status(&state.db, head_id, "aborted").await?;

    hh_db::repo::head_events::insert(
        &state.db,
        head_id,
        "head_aborted",
        &json!({ "previous_status": row.status }),
    )
    .await?;

    // Teardown resources in background
    let state_clone = state.clone();
    let node_count = row.participant_count as u32;
    tokio::spawn(async move {
        if let Err(e) = state_clone
            .orchestrator
            .teardown_head(head_id, node_count)
            .await
        {
            tracing::error!(%head_id, error = %e, "failed to teardown head resources");
        }
    });

    Ok(Json(json!({
        "head_id": updated.id,
        "status": updated.status,
    })))
}
