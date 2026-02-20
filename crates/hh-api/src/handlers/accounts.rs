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
    let api_key = generate_api_key();
    let key_hash = auth::hash_api_key(&api_key);

    let account = hh_db::repo::accounts::create(
        &state.db,
        req.email.as_deref(),
        &key_hash,
    )
    .await?;

    Ok(Json(json!({
        "account_id": account.id,
        "api_key": api_key,
        "email": account.email,
        "plan": account.plan,
        "created_at": account.created_at,
    })))
}

fn generate_api_key() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let random_bytes: [u8; 24] = rng.gen();
    let encoded: String = random_bytes.iter().map(|b| format!("{b:02x}")).collect();
    format!("hh_sk_{encoded}")
}
