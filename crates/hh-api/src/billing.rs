//! Prepaid balance billing: top-up via Stripe Checkout, balance deduction on usage.

use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::AccountId;
use crate::error::ApiError;
use crate::state::AppState;

const STRIPE_API_BASE: &str = "https://api.stripe.com/v1";
const MIN_TOPUP_CENTS: i64 = 500; // $5 minimum top-up

#[derive(Debug, Deserialize)]
pub struct TopUpRequest {
    pub amount_cents: i64,
    pub success_url: String,
    pub cancel_url: String,
}

#[derive(Debug, Serialize)]
pub struct TopUpResponse {
    pub url: String,
}

/// Create a Stripe Checkout session for a one-time balance top-up.
pub async fn create_topup(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Json(req): Json<TopUpRequest>,
) -> Result<Json<TopUpResponse>, ApiError> {
    let config = &state.config;
    if config.stripe_secret_key.is_empty() {
        return Err(ApiError::bad_request("billing is not configured"));
    }
    if req.amount_cents < MIN_TOPUP_CENTS {
        return Err(ApiError::bad_request(format!(
            "minimum top-up is ${:.2}",
            MIN_TOPUP_CENTS as f64 / 100.0
        )));
    }

    let account_row = hh_db::repo::accounts::find_by_id(&state.db, account.0)
        .await?
        .ok_or_else(|| ApiError::not_found("account not found"))?;

    let client = Client::new();
    let auth = format!("Bearer {}", config.stripe_secret_key);

    let mut params: Vec<(String, String)> = vec![
        ("mode".into(), "payment".into()),
        ("success_url".into(), req.success_url),
        ("cancel_url".into(), req.cancel_url),
        ("client_reference_id".into(), account.0.to_string()),
        ("line_items[0][price_data][currency]".into(), "usd".into()),
        ("line_items[0][price_data][unit_amount]".into(), req.amount_cents.to_string()),
        ("line_items[0][price_data][product_data][name]".into(), "HydraHouse Balance Top-Up".into()),
        ("line_items[0][quantity]".into(), "1".into()),
    ];

    if let Some(ref cid) = account_row.stripe_customer_id {
        params.push(("customer".into(), cid.clone()));
    } else if let Some(ref email) = account_row.email {
        if !email.is_empty() {
            params.push(("customer_email".into(), email.clone()));
        }
    }

    let body = params
        .iter()
        .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");

    let resp = client
        .post(format!("{}/checkout/sessions", STRIPE_API_BASE))
        .header("Authorization", auth)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| ApiError::internal(e.to_string()))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| ApiError::internal(e.to_string()))?;
    if !status.is_success() {
        tracing::warn!(status = %status, body = %text, "Stripe checkout session create failed");
        return Err(ApiError::internal("failed to create checkout session"));
    }

    let session: serde_json::Value = serde_json::from_str(&text).map_err(|e| ApiError::internal(e.to_string()))?;
    let url = session
        .get("url")
        .and_then(|u| u.as_str())
        .ok_or_else(|| ApiError::internal("Stripe did not return session URL"))?
        .to_string();

    Ok(Json(TopUpResponse { url }))
}

/// Get balance transaction history.
pub async fn get_balance_history(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let txns = hh_db::repo::accounts::list_balance_transactions(&state.db, account.0, 50).await?;
    let items: Vec<serde_json::Value> = txns
        .iter()
        .map(|t| json!({
            "id": t.id,
            "amount_cents": t.amount_cents,
            "balance_after": t.balance_after,
            "description": t.description,
            "created_at": t.created_at,
        }))
        .collect();
    Ok(Json(json!({ "transactions": items })))
}

/// Stripe webhook handler.
pub async fn stripe_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: String,
) -> Result<axum::http::StatusCode, ApiError> {
    let config = &state.config;
    if config.stripe_webhook_secret.is_empty() {
        return Err(ApiError::internal("webhook secret not configured"));
    }

    let signature = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::bad_request("missing stripe-signature"))?;

    if !verify_stripe_signature(signature, body.as_bytes(), &config.stripe_webhook_secret) {
        return Err(ApiError::bad_request("invalid webhook signature"));
    }

    let event: StripeEvent = serde_json::from_str(&body).map_err(|e| ApiError::bad_request(e.to_string()))?;

    if event.type_ == "checkout.session.completed" {
        handle_checkout_completed(&state, &event).await?;
    }

    Ok(axum::http::StatusCode::OK)
}

fn verify_stripe_signature(signature: &str, payload: &[u8], secret: &str) -> bool {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    let parts: Vec<&str> = signature.split(',').collect();
    let mut timestamp = None;
    let mut v1_sig = None;
    for part in parts {
        let (k, v) = match part.split_once('=') {
            Some(p) => p,
            None => continue,
        };
        match k {
            "t" => timestamp = Some(v),
            "v1" => v1_sig = Some(v),
            _ => {}
        }
    }
    let (timestamp, v1_sig) = match (timestamp, v1_sig) {
        (Some(t), Some(s)) => (t, s),
        _ => return false,
    };

    let signed = format!("{}.{}", timestamp, std::str::from_utf8(payload).unwrap_or(""));
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
        Ok(m) => m,
        Err(_) => return false,
    };
    mac.update(signed.as_bytes());
    let result = mac.finalize();
    let expected = hex::encode(result.into_bytes());
    constant_time_eq(expected.as_bytes(), v1_sig.as_bytes())
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b.iter()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[derive(Debug, Deserialize)]
struct StripeEvent {
    #[serde(rename = "type")]
    type_: String,
    data: StripeEventData,
}

#[derive(Debug, Deserialize)]
struct StripeEventData {
    object: serde_json::Value,
}

async fn handle_checkout_completed(state: &AppState, event: &StripeEvent) -> Result<(), ApiError> {
    let session = &event.data.object;

    let client_reference_id = session.get("client_reference_id").and_then(|c| c.as_str());
    let account_id = match client_reference_id {
        Some(id) => Uuid::parse_str(id).map_err(|_| ApiError::internal("invalid client_reference_id"))?,
        None => return Err(ApiError::internal("missing client_reference_id")),
    };

    // Credit balance with the amount paid
    let amount_cents = session
        .get("amount_total")
        .and_then(|a| a.as_i64())
        .unwrap_or(0);
    let session_id = session.get("id").and_then(|s| s.as_str()).unwrap_or("");

    if amount_cents > 0 {
        match hh_db::repo::accounts::credit_balance(
            &state.db,
            account_id,
            amount_cents,
            &format!("Top-up ${:.2}", amount_cents as f64 / 100.0),
            Some(session_id),
        )
        .await
        {
            Ok(new_balance) => {
                tracing::info!(%account_id, amount_cents, new_balance, "balance topped up");
            }
            Err(e) => {
                // Unique constraint violation = duplicate webhook, safe to ignore
                if e.to_string().contains("idx_balance_tx_stripe_session") {
                    tracing::debug!(%account_id, session_id, "duplicate webhook, ignoring");
                } else {
                    return Err(e.into());
                }
            }
        }
    }

    // Link Stripe customer if not already set
    if let Some(customer_id) = session.get("customer").and_then(|c| c.as_str()) {
        hh_db::repo::accounts::update_stripe_customer_id(&state.db, account_id, customer_id).await?;
    }

    Ok(())
}

// --- Billing helpers used by handlers ---

/// Testnet networks (preprod, preview) are free to use.
pub fn is_free_network(network: &str) -> bool {
    matches!(network, "preprod" | "preview")
}

/// Check that the account has sufficient balance. Returns ApiError with 402 if not.
pub async fn check_sufficient_balance(state: &AppState, account_id: Uuid, required_cents: i64) -> Result<(), ApiError> {
    let account = hh_db::repo::accounts::find_by_id(&state.db, account_id)
        .await?
        .ok_or_else(|| ApiError::not_found("account not found"))?;
    if account.balance_cents < required_cents {
        return Err(ApiError::payment_required(format!(
            "insufficient balance (${:.2} available, ${:.2} required); top up at Billing",
            account.balance_cents as f64 / 100.0,
            required_cents as f64 / 100.0,
        )));
    }
    Ok(())
}

/// Charge for opening a head. Returns Ok(()) or logs warning if deduction fails.
/// Testnets (preprod, preview) are free.
pub async fn charge_head_open(state: &AppState, account_id: Uuid, head_id: Uuid, network: &str) -> Result<(), ApiError> {
    if state.config.stripe_secret_key.is_empty() || is_free_network(network) {
        return Ok(());
    }
    let cost = state.config.cost_head_open_cents;
    match hh_db::repo::accounts::deduct_balance(
        &state.db,
        account_id,
        cost,
        &format!("Head open (${:.2})", cost as f64 / 100.0),
        Some(head_id),
    )
    .await?
    {
        Some(_) => Ok(()),
        None => Err(ApiError::payment_required("insufficient balance for head open")),
    }
}

/// Charge for an API request. Testnets (preprod, preview) are free.
pub async fn charge_api_request(state: &AppState, account_id: Uuid, head_id: Option<Uuid>, network: &str) -> Result<(), ApiError> {
    if state.config.stripe_secret_key.is_empty() || is_free_network(network) {
        return Ok(());
    }
    let cost = state.config.cost_api_request_cents;
    match hh_db::repo::accounts::deduct_balance(
        &state.db,
        account_id,
        cost,
        "API request",
        head_id,
    )
    .await?
    {
        Some(_) => Ok(()),
        None => Err(ApiError::payment_required("insufficient balance")),
    }
}
