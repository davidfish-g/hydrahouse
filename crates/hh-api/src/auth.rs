use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use sha2::{Digest, Sha256};
use std::sync::Arc;

use crate::state::AppState;

const API_KEY_PREFIX: &str = "hh_sk_";
const SESSION_COOKIE_NAME: &str = "hh_session";
const SESSION_PREFIX: &str = "hh_session_";

fn extract_api_key(req: &Request) -> Option<String> {
    let header = req.headers().get("authorization")?.to_str().ok()?;
    let token = header.strip_prefix("Bearer ")?;
    if token.starts_with(API_KEY_PREFIX) {
        Some(token.to_string())
    } else {
        None
    }
}

pub fn extract_session_cookie(req: &Request) -> Option<String> {
    let cookie_header = req.headers().get("cookie")?.to_str().ok()?;
    for cookie in cookie_header.split(';') {
        let cookie = cookie.trim();
        if let Some(value) = cookie.strip_prefix("hh_session=") {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// Compute a SHA-256 hex digest for fast, deterministic DB lookup.
/// Used for both API key IDs and session token IDs.
fn sha256_hex(input: &str) -> String {
    let hash = Sha256::digest(input.as_bytes());
    hex::encode(hash)
}

/// Compute a fast, deterministic identifier from an API key for O(1) DB lookup.
pub fn compute_api_key_id(key: &str) -> String {
    sha256_hex(key)
}

/// Compute a SHA-256 token_id from a session token.
pub fn compute_session_token_id(token: &str) -> String {
    sha256_hex(token)
}

/// Hash an API key using Argon2id for secure storage.
pub fn hash_api_key(key: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(key.as_bytes(), &salt)
        .expect("argon2 hashing should not fail")
        .to_string()
}

pub fn verify_api_key(key: &str, stored_hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(stored_hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(key.as_bytes(), &parsed)
        .is_ok()
}

pub async fn require_auth(
    State(state): State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // 1. Try session cookie
    if let Some(token) = extract_session_cookie(&req) {
        let token_id = compute_session_token_id(&token);
        if let Ok(Some(session)) =
            hh_db::repo::sessions::find_by_token_id(&state.db, &token_id).await
        {
            if session.expires_at > chrono::Utc::now() {
                req.extensions_mut().insert(AccountId(session.account_id));
                return Ok(next.run(req).await);
            }
        }
    }

    // 2. Try Bearer API key
    if let Some(api_key) = extract_api_key(&req) {
        let key_id = compute_api_key_id(&api_key);
        let key_row = hh_db::repo::api_keys::find_by_key_id(&state.db, &key_id)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::UNAUTHORIZED)?;

        if !verify_api_key(&api_key, &key_row.key_hash) {
            return Err(StatusCode::UNAUTHORIZED);
        }

        // Fire-and-forget last_used update
        let db = state.db.clone();
        let row_id = key_row.id;
        tokio::spawn(async move {
            hh_db::repo::api_keys::touch_last_used(&db, row_id).await;
        });

        req.extensions_mut().insert(AccountId(key_row.account_id));
        return Ok(next.run(req).await);
    }

    Err(StatusCode::UNAUTHORIZED)
}

pub fn generate_api_key() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let random_bytes: [u8; 24] = rng.gen();
    format!("hh_sk_{}", hex::encode(random_bytes))
}

pub fn generate_session_token() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let random_bytes: [u8; 24] = rng.gen();
    format!("{SESSION_PREFIX}{}", hex::encode(random_bytes))
}

pub fn session_cookie_name() -> &'static str {
    SESSION_COOKIE_NAME
}

#[derive(Debug, Clone)]
pub struct AccountId(pub uuid::Uuid);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn argon2_hash_and_verify() {
        let key = "hh_sk_test123";
        let hash = hash_api_key(key);
        assert!(hash.starts_with("$argon2"));
        assert!(verify_api_key(key, &hash));
        assert!(!verify_api_key("hh_sk_wrong", &hash));
    }
}
