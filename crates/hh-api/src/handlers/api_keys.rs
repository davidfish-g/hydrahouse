use axum::extract::{Path, State};
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::auth;
use crate::error::ApiError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
}

pub async fn create_api_key(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<auth::AccountId>,
    Json(req): Json<CreateApiKeyRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(ApiError::bad_request("name is required"));
    }

    let count = hh_db::repo::api_keys::count_by_account(&state.db, account.0).await?;
    if count >= 10 {
        return Err(ApiError::bad_request("maximum of 10 API keys per account"));
    }

    let api_key = auth::generate_api_key();
    let key_hash = auth::hash_api_key(&api_key);
    let key_id = auth::compute_api_key_id(&api_key);

    let row = hh_db::repo::api_keys::create(&state.db, account.0, name, &key_hash, &key_id).await?;

    Ok(Json(json!({
        "id": row.id,
        "name": row.name,
        "api_key": api_key,
        "created_at": row.created_at,
    })))
}

pub async fn list_api_keys(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<auth::AccountId>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let rows = hh_db::repo::api_keys::list_by_account(&state.db, account.0).await?;

    let keys: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            let prefix = if r.key_id.len() >= 8 {
                &r.key_id[r.key_id.len() - 8..]
            } else {
                &r.key_id
            };
            json!({
                "id": r.id,
                "name": r.name,
                "key_prefix": prefix,
                "created_at": r.created_at,
                "last_used_at": r.last_used_at,
            })
        })
        .collect();

    Ok(Json(json!({ "keys": keys })))
}

pub async fn delete_api_key(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<auth::AccountId>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let deleted = hh_db::repo::api_keys::delete(&state.db, id, account.0).await?;
    if !deleted {
        return Err(ApiError::not_found("API key not found"));
    }
    Ok(Json(json!({ "deleted": true })))
}
