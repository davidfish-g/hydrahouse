use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::auth;
use crate::error::ApiError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateAccountRequest {
    pub email: Option<String>,
}

pub async fn create_account(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateAccountRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let account = hh_db::repo::accounts::create(&state.db, req.email.as_deref()).await?;

    // Create a default API key in the api_keys table
    let api_key = auth::generate_api_key();
    let key_hash = auth::hash_api_key(&api_key);
    let key_id = auth::compute_api_key_id(&api_key);
    hh_db::repo::api_keys::create(&state.db, account.id, "default", &key_hash, &key_id).await?;

    Ok(Json(json!({
        "account_id": account.id,
        "api_key": api_key,
        "email": account.email,
        "plan": account.plan,
        "created_at": account.created_at,
    })))
}

/// Get account info (plan, billing status) for the authenticated account.
pub async fn get_account(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<crate::auth::AccountId>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = hh_db::repo::accounts::find_by_id(&state.db, account.0)
        .await?
        .ok_or_else(|| ApiError::not_found("account not found"))?;

    Ok(Json(json!({
        "account_id": row.id,
        "plan": row.plan,
        "balance_cents": row.balance_cents,
        "has_billing": row.stripe_customer_id.is_some(),
        "username": row.username,
        "email": row.email,
    })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateUsernameRequest {
    pub username: String,
}

pub async fn update_username(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<crate::auth::AccountId>,
    Json(req): Json<UpdateUsernameRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let username = req.username.trim();
    if username.is_empty() || username.len() > 50 {
        return Err(ApiError::bad_request("Username must be 1-50 characters"));
    }
    hh_db::repo::accounts::update_username(&state.db, account.0, username).await?;
    Ok(Json(json!({ "username": username })))
}

/// Delete the authenticated account.
/// Blocked if there are active (non-terminated) heads.
pub async fn delete_account(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<crate::auth::AccountId>,
) -> Result<axum::response::Response, ApiError> {
    use axum::http::header::SET_COOKIE;
    use axum::response::IntoResponse;

    // Block if active heads exist
    let active = hh_db::repo::heads::count_active_by_account(&state.db, account.0).await?;
    if active > 0 {
        return Err(ApiError::bad_request(format!(
            "Cannot delete account: you have {} active head(s). Close or abort them first.",
            active
        )));
    }

    // Perform the deletion
    hh_db::repo::accounts::delete_account(&state.db, account.0).await?;

    // Clear the session cookie
    let secure_flag = if state.config.listen_addr.contains("localhost")
        || state.config.listen_addr.starts_with("127.")
    {
        ""
    } else {
        " Secure;"
    };
    let clear_cookie = format!(
        "{}=;{} HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
        crate::auth::session_cookie_name(),
        secure_flag,
    );

    Ok((
        [(SET_COOKIE, clear_cookie)],
        axum::Json(json!({ "deleted": true })),
    )
        .into_response())
}

/// Get usage statistics for the authenticated account.
pub async fn get_usage(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<crate::auth::AccountId>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let summary = hh_db::repo::usage::summary_for_account(&state.db, account.0).await?;

    let metrics: serde_json::Value = summary
        .iter()
        .map(|s| (s.metric.clone(), json!(s.total)))
        .collect::<serde_json::Map<String, serde_json::Value>>()
        .into();

    Ok(Json(json!({
        "account_id": account.0,
        "usage": metrics,
    })))
}
