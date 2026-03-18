use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::auth;
use crate::error::ApiError;
use crate::state::AppState;

// --- Unlink passkey ---

pub async fn unlink_passkey(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<auth::AccountId>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_not_last_method(&state, account.0).await?;

    let deleted = hh_db::repo::passkeys::delete(&state.db, id, account.0).await?;
    if !deleted {
        return Err(ApiError::not_found("Passkey not found"));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// --- Unlink Google ---

pub async fn unlink_google(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<auth::AccountId>,
) -> Result<Json<serde_json::Value>, ApiError> {
    ensure_not_last_method(&state, account.0).await?;

    hh_db::repo::accounts::unlink_google_id(&state.db, account.0).await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

// --- Link Google ---

#[derive(Deserialize)]
pub struct LinkGoogleRequest {
    pub id_token: String,
}

pub async fn link_google(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<auth::AccountId>,
    Json(req): Json<LinkGoogleRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if state.config.google_client_id.is_empty() {
        return Err(ApiError::bad_request("Google authentication is not configured"));
    }

    let url = format!(
        "https://oauth2.googleapis.com/tokeninfo?id_token={}",
        urlencoding::encode(&req.id_token)
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to verify Google token: {e}")))?;

    if !resp.status().is_success() {
        return Err(ApiError::bad_request("Invalid Google ID token"));
    }

    let token_info: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| ApiError::internal(format!("failed to parse Google token info: {e}")))?;

    let google_aud = token_info["aud"].as_str().unwrap_or("");
    if google_aud != state.config.google_client_id {
        return Err(ApiError::bad_request("Token was not issued for this application"));
    }

    let google_id = token_info["sub"]
        .as_str()
        .ok_or_else(|| ApiError::bad_request("Missing sub in token"))?;

    if let Some(existing) = hh_db::repo::accounts::find_by_google_id(&state.db, google_id).await? {
        if existing.id != account.0 {
            return Err(ApiError::bad_request("This Google account is already linked to another account"));
        }
        return Ok(Json(serde_json::json!({ "linked": true, "already_linked": true })));
    }

    hh_db::repo::accounts::link_google_id(&state.db, account.0, google_id).await?;

    let account_row = hh_db::repo::accounts::find_by_id(&state.db, account.0).await?;
    if let Some(row) = account_row {
        if row.email.is_none() {
            if let Some(email) = token_info["email"].as_str() {
                hh_db::repo::accounts::update_email(&state.db, account.0, email).await?;
            }
        }
    }

    Ok(Json(serde_json::json!({ "linked": true })))
}

// --- List all auth methods ---

#[derive(Serialize)]
pub struct AuthMethodsResponse {
    pub google: Option<GoogleMethodInfo>,
    pub passkeys: Vec<PasskeyMethodInfo>,
}

#[derive(Serialize)]
pub struct GoogleMethodInfo {
    pub email: String,
}

#[derive(Serialize)]
pub struct PasskeyMethodInfo {
    pub id: uuid::Uuid,
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list_auth_methods(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<auth::AccountId>,
) -> Result<Json<AuthMethodsResponse>, ApiError> {
    let account_row = hh_db::repo::accounts::find_by_id(&state.db, account.0)
        .await?
        .ok_or_else(|| ApiError::not_found("Account not found"))?;

    let google = if account_row.google_id.is_some() {
        Some(GoogleMethodInfo {
            email: account_row.email.unwrap_or_default(),
        })
    } else {
        None
    };

    let passkey_rows = hh_db::repo::passkeys::list_by_account(&state.db, account.0).await?;
    let passkeys = passkey_rows
        .into_iter()
        .map(|p| PasskeyMethodInfo {
            id: p.id,
            name: p.name,
            created_at: p.created_at,
        })
        .collect();

    Ok(Json(AuthMethodsResponse { google, passkeys }))
}

/// Prevent unlinking the last auth method.
async fn ensure_not_last_method(state: &AppState, account_id: uuid::Uuid) -> Result<(), ApiError> {
    let account = hh_db::repo::accounts::find_by_id(&state.db, account_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Account not found"))?;

    let mut count = 0u32;
    if account.google_id.is_some() {
        count += 1;
    }
    count += hh_db::repo::passkeys::count_by_account(&state.db, account_id).await? as u32;

    if count <= 1 {
        return Err(ApiError::bad_request(
            "Cannot remove your last authentication method. Link another method first.",
        ));
    }

    Ok(())
}
