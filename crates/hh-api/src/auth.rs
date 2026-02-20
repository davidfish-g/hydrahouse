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
use std::sync::Arc;

use crate::state::AppState;

const API_KEY_PREFIX: &str = "hh_sk_";

fn extract_api_key(req: &Request) -> Option<String> {
    let header = req.headers().get("authorization")?.to_str().ok()?;
    let token = header.strip_prefix("Bearer ")?;
    if token.starts_with(API_KEY_PREFIX) {
        Some(token.to_string())
    } else {
        None
    }
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

/// Verify an API key against a stored hash.
/// Supports both Argon2id hashes (prefixed with `$argon2`) and legacy hex hashes.
pub fn verify_api_key(key: &str, stored_hash: &str) -> bool {
    if stored_hash.starts_with("$argon2") {
        let Ok(parsed) = PasswordHash::new(stored_hash) else {
            return false;
        };
        Argon2::default()
            .verify_password(key.as_bytes(), &parsed)
            .is_ok()
    } else {
        let legacy_hash: String = key.as_bytes().iter().map(|b| format!("{b:02x}")).collect();
        legacy_hash == stored_hash
    }
}

pub async fn require_auth(
    State(state): State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let api_key = extract_api_key(&req).ok_or(StatusCode::UNAUTHORIZED)?;

    let account = hh_db::repo::accounts::find_and_verify_api_key(
        &state.db,
        &api_key,
        verify_api_key,
        hash_api_key,
    )
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::UNAUTHORIZED)?;

    req.extensions_mut().insert(AccountId(account.id));
    Ok(next.run(req).await)
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

    #[test]
    fn legacy_hex_verify() {
        let key = "hh_sk_test123";
        let legacy_hash: String = key.as_bytes().iter().map(|b| format!("{b:02x}")).collect();
        assert!(verify_api_key(key, &legacy_hash));
        assert!(!verify_api_key("hh_sk_wrong", &legacy_hash));
    }
}
