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

/// Hash an API key for DB storage/lookup.
/// Uses hex encoding of the key bytes (deterministic, reproducible from any language).
/// From bash: printf '%s' "hh_sk_mykey" | od -A n -t x1 | tr -d ' \n'
/// In prod, replace with argon2/bcrypt.
pub fn hash_api_key(key: &str) -> String {
    key.as_bytes().iter().map(|b| format!("{b:02x}")).collect()
}

pub async fn require_auth(
    State(state): State<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let api_key = extract_api_key(&req).ok_or(StatusCode::UNAUTHORIZED)?;
    let key_hash = hash_api_key(&api_key);

    let account = hh_db::repo::accounts::find_by_api_key_hash(&state.db, &key_hash)
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
    fn hash_is_deterministic() {
        let h1 = hash_api_key("hh_sk_test123");
        let h2 = hash_api_key("hh_sk_test123");
        assert_eq!(h1, h2);
    }

    #[test]
    fn hash_is_different_for_different_keys() {
        let h1 = hash_api_key("hh_sk_key1");
        let h2 = hash_api_key("hh_sk_key2");
        assert_ne!(h1, h2);
    }
}
