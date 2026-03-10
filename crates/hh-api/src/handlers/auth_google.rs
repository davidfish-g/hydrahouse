use axum::extract::State;
use axum::http::header::SET_COOKIE;
use axum::http::HeaderValue;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::auth;
use crate::error::ApiError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct GoogleAuthRequest {
    pub id_token: String,
}

/// Deserialize `email_verified` from either a boolean or string `"true"`/`"false"`.
fn deserialize_bool_or_string<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum BoolOrString {
        Bool(bool),
        Str(String),
    }
    match BoolOrString::deserialize(deserializer)? {
        BoolOrString::Bool(b) => Ok(b),
        BoolOrString::Str(s) => Ok(s == "true"),
    }
}

#[derive(Debug, Deserialize)]
struct GoogleTokenInfo {
    aud: String,
    email: String,
    #[serde(deserialize_with = "deserialize_bool_or_string")]
    email_verified: bool,
    sub: String,
}

#[derive(Debug, Serialize)]
pub struct GoogleAuthResponse {
    pub account_id: uuid::Uuid,
    pub email: String,
    pub plan: String,
    pub is_new_account: bool,
}

pub async fn google_auth(
    State(state): State<Arc<AppState>>,
    Json(req): Json<GoogleAuthRequest>,
) -> Result<impl IntoResponse, ApiError> {
    if state.config.google_client_id.is_empty() {
        return Err(ApiError::bad_request("Google authentication is not configured"));
    }

    // Verify the ID token with Google
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

    let token_info: GoogleTokenInfo = resp
        .json()
        .await
        .map_err(|e| ApiError::internal(format!("failed to parse Google token info: {e}")))?;

    // Verify audience matches our client ID
    if token_info.aud != state.config.google_client_id {
        return Err(ApiError::bad_request("Token was not issued for this application"));
    }

    // Verify email is verified
    if !token_info.email_verified {
        return Err(ApiError::bad_request("Google email is not verified"));
    }

    let google_id = &token_info.sub;
    let email = &token_info.email;

    // Find or create account
    let (account, is_new_account) = if let Some(account) =
        hh_db::repo::accounts::find_by_google_id(&state.db, google_id).await?
    {
        (account, false)
    } else if let Some(account) =
        hh_db::repo::accounts::find_by_email(&state.db, email).await?
    {
        hh_db::repo::accounts::link_google_id(&state.db, account.id, google_id).await?;
        (account, false)
    } else {
        let account =
            hh_db::repo::accounts::create_with_google(&state.db, email, google_id).await?;
        (account, true)
    };

    // Revoke old sessions, create new one
    hh_db::repo::sessions::delete_for_account(&state.db, account.id).await?;

    let session_token = auth::generate_session_token();
    let token_id = auth::compute_session_token_id(&session_token);
    let expires_at = chrono::Utc::now() + chrono::Duration::days(7);

    hh_db::repo::sessions::create(&state.db, account.id, &token_id, expires_at).await?;

    // Build Set-Cookie header
    let secure_flag = if state.config.listen_addr.contains("localhost") || state.config.listen_addr.starts_with("127.") {
        ""
    } else {
        " Secure;"
    };
    let cookie_value = format!(
        "{}={};{} HttpOnly; SameSite=Lax; Path=/; Max-Age={}",
        auth::session_cookie_name(),
        session_token,
        secure_flag,
        7 * 24 * 3600,
    );

    let body = GoogleAuthResponse {
        account_id: account.id,
        email: email.clone(),
        plan: account.plan,
        is_new_account,
    };

    let mut response = Json(body).into_response();
    response.headers_mut().insert(
        SET_COOKIE,
        HeaderValue::from_str(&cookie_value)
            .map_err(|_| ApiError::internal("failed to build cookie"))?,
    );

    Ok(response)
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    req: axum::extract::Request,
) -> Result<impl IntoResponse, ApiError> {
    // Delete session from DB if cookie present
    if let Some(token) = auth::extract_session_cookie(&req) {
        let token_id = auth::compute_session_token_id(&token);
        hh_db::repo::sessions::delete_by_token_id(&state.db, &token_id).await?;
    }

    // Clear the cookie
    let clear_cookie = format!(
        "{}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure",
        auth::session_cookie_name(),
    );

    let mut response = Json(serde_json::json!({ "logged_out": true })).into_response();
    response.headers_mut().insert(
        SET_COOKIE,
        HeaderValue::from_str(&clear_cookie)
            .map_err(|_| ApiError::internal("failed to build cookie"))?,
    );

    Ok(response)
}
