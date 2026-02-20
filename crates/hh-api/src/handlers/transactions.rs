use axum::extract::{Path, State};
use axum::Json;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::AccountId;
use crate::error::ApiError;
use crate::state::AppState;

/// Submit a transaction to the L2 head via hydra-node's HTTP API.
/// Accepts `{"cborHex": "<hex-encoded signed tx>"}` or `{"type": "Tx ConwayEra", "cborHex": "..."}`.
pub async fn submit_tx(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = hh_db::repo::heads::find_by_id(&state.db, head_id)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("head {head_id} not found")))?;

    if row.account_id != account.0 {
        return Err(ApiError::not_found(format!("head {head_id} not found")));
    }

    if row.status != "open" {
        return Err(ApiError::bad_request(format!(
            "cannot submit tx: head is in '{}' state, must be 'open'",
            row.status
        )));
    }

    let cbor_hex = body
        .get("cborHex")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::bad_request("missing 'cborHex' field"))?;

    let cbor_bytes = hex::decode(cbor_hex)
        .map_err(|e| ApiError::bad_request(format!("invalid hex in cborHex: {e}")))?;

    let http_url = crate::lifecycle::node_http_url(&state, head_id, 0).await;
    let url = format!("{http_url}/cardano-transaction");

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Content-Type", "application/cbor")
        .body(cbor_bytes)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to reach hydra-node: {e}")))?;

    let status = resp.status();
    let resp_body: serde_json::Value = resp
        .json()
        .await
        .unwrap_or_else(|_| json!({"status": status.as_u16()}));

    if status.is_success() {
        let _ = hh_db::repo::head_events::insert(
            &state.db,
            head_id,
            "tx_submitted",
            &json!({"cborHex_prefix": &cbor_hex[..std::cmp::min(32, cbor_hex.len())]}),
        )
        .await;

        Ok(Json(json!({
            "status": "submitted",
            "hydra_response": resp_body,
        })))
    } else {
        Err(ApiError::bad_request(format!(
            "hydra-node rejected transaction: {}",
            resp_body
        )))
    }
}

/// Query the L2 UTxO snapshot from the hydra-node.
pub async fn get_snapshot(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = hh_db::repo::heads::find_by_id(&state.db, head_id)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("head {head_id} not found")))?;

    if row.account_id != account.0 {
        return Err(ApiError::not_found(format!("head {head_id} not found")));
    }

    if row.status != "open" {
        return Err(ApiError::bad_request(format!(
            "cannot query snapshot: head is in '{}' state, must be 'open'",
            row.status
        )));
    }

    let http_url = crate::lifecycle::node_http_url(&state, head_id, 0).await;
    let url = format!("{http_url}/snapshot/utxo");

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to reach hydra-node: {e}")))?;

    let status = resp.status();
    let utxo: serde_json::Value = resp
        .json()
        .await
        .unwrap_or_else(|_| json!({"error": "failed to parse response"}));

    if status.is_success() {
        Ok(Json(json!({
            "head_id": head_id,
            "utxo": utxo,
        })))
    } else {
        Err(ApiError::internal(format!(
            "hydra-node snapshot query failed: {}",
            utxo
        )))
    }
}
