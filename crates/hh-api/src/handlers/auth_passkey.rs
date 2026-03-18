use axum::extract::State;
use axum::http::header::SET_COOKIE;
use axum::http::HeaderValue;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use url::Url;
use webauthn_rs::prelude::*;
use webauthn_rs::Webauthn;

use crate::auth;
use crate::error::ApiError;
use crate::state::AppState;

fn build_webauthn(state: &AppState) -> Result<Webauthn, ApiError> {
    if state.config.webauthn_rp_id.is_empty() {
        return Err(ApiError::bad_request(
            "Passkey authentication is not configured",
        ));
    }
    let rp_id = &state.config.webauthn_rp_id;
    let rp_origin = Url::parse(&state.config.webauthn_rp_origin)
        .map_err(|_| ApiError::internal("invalid WEBAUTHN_RP_ORIGIN"))?;
    let builder = WebauthnBuilder::new(rp_id, &rp_origin)
        .map_err(|e| ApiError::internal(format!("webauthn builder error: {e}")))?
        .rp_name("HydraHouse");
    builder
        .build()
        .map_err(|e| ApiError::internal(format!("webauthn build error: {e}")))
}

// ─── Registration (authenticated, uses webauthn-rs) ─────────────────────────

#[derive(Serialize)]
pub struct RegisterBeginResponse {
    pub challenge_id: uuid::Uuid,
    pub options: CreationChallengeResponse,
}

pub async fn register_begin(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<auth::AccountId>,
) -> Result<Json<RegisterBeginResponse>, ApiError> {
    let webauthn = build_webauthn(&state)?;

    let account_row = hh_db::repo::accounts::find_by_id(&state.db, account.0)
        .await?
        .ok_or_else(|| ApiError::not_found("Account not found"))?;
    let display_name = account_row.email.as_deref().unwrap_or("HydraHouse User");

    let existing = hh_db::repo::passkeys::list_by_account(&state.db, account.0).await?;
    let exclude: Vec<CredentialID> = existing
        .iter()
        .map(|row| CredentialID::from(row.credential_id.clone()))
        .collect();

    let (ccr, reg_state) = webauthn
        .start_passkey_registration(
            account.0,
            display_name,
            display_name,
            Some(exclude),
        )
        .map_err(|e| ApiError::internal(format!("webauthn registration error: {e}")))?;

    let state_json = serde_json::to_value(&reg_state)
        .map_err(|e| ApiError::internal(format!("failed to serialize reg state: {e}")))?;

    let challenge_key = uuid::Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(120);
    let row = hh_db::repo::auth_challenges::create(
        &state.db,
        &challenge_key,
        &serde_json::json!({
            "type": "passkey_register",
            "account_id": account.0.to_string(),
            "reg_state": state_json,
        }),
        expires_at,
    )
    .await?;

    Ok(Json(RegisterBeginResponse {
        challenge_id: row.id,
        options: ccr,
    }))
}

#[derive(Deserialize)]
pub struct RegisterCompleteRequest {
    pub challenge_id: uuid::Uuid,
    pub credential: RegisterPublicKeyCredential,
    #[serde(default = "default_passkey_name")]
    pub name: String,
}

fn default_passkey_name() -> String {
    "Passkey".to_string()
}

pub async fn register_complete(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<auth::AccountId>,
    Json(req): Json<RegisterCompleteRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let webauthn = build_webauthn(&state)?;

    let challenge = hh_db::repo::auth_challenges::find_by_id(&state.db, req.challenge_id)
        .await?
        .ok_or_else(|| ApiError::bad_request("Challenge not found or expired"))?;

    if challenge.expires_at < chrono::Utc::now() {
        hh_db::repo::auth_challenges::delete_by_id(&state.db, challenge.id).await?;
        return Err(ApiError::bad_request("Challenge expired"));
    }

    let stored_account_id = challenge.state["account_id"]
        .as_str()
        .ok_or_else(|| ApiError::internal("missing account_id in challenge state"))?;
    if stored_account_id != account.0.to_string() {
        return Err(ApiError::bad_request(
            "Challenge does not belong to this account",
        ));
    }

    let reg_state: PasskeyRegistration =
        serde_json::from_value(challenge.state["reg_state"].clone())
            .map_err(|e| ApiError::internal(format!("failed to deserialize reg state: {e}")))?;

    let passkey = webauthn
        .finish_passkey_registration(&req.credential, &reg_state)
        .map_err(|e| ApiError::bad_request(format!("Registration verification failed: {e}")))?;

    // Serialize the full Passkey to JSON so we can extract the COSE public key.
    let passkey_json = serde_json::to_value(&passkey)
        .map_err(|e| ApiError::internal(format!("failed to serialize passkey: {e}")))?;

    // Store the COSE public key JSON for manual verification during login.
    let cose_key_json = &passkey_json["cred"]["cred"];
    let cose_key_bytes = serde_json::to_vec(cose_key_json)
        .map_err(|e| ApiError::internal(format!("failed to serialize cose key: {e}")))?;

    let cred_id_value = &passkey_json["cred"]["cred_id"];
    let cred_id_bytes: Vec<u8> = if let Some(s) = cred_id_value.as_str() {
        // webauthn-rs serializes CredentialID as base64url
        base64_url_decode(s)?
    } else if let Some(arr) = cred_id_value.as_array() {
        arr.iter().map(|v| v.as_u64().unwrap_or(0) as u8).collect()
    } else {
        return Err(ApiError::internal("unexpected cred_id format"));
    };

    let counter = passkey_json["cred"]["counter"].as_u64().unwrap_or(0) as i32;

    hh_db::repo::passkeys::create(
        &state.db,
        account.0,
        &cred_id_bytes,
        &cose_key_bytes,
        counter,
        &req.name,
    )
    .await?;

    hh_db::repo::auth_challenges::delete_by_id(&state.db, challenge.id).await?;

    Ok(Json(serde_json::json!({ "registered": true })))
}

// ─── Signup (unauthenticated — creates account + passkey) ───────────────────

pub async fn signup_begin(
    State(state): State<Arc<AppState>>,
) -> Result<Json<RegisterBeginResponse>, ApiError> {
    let webauthn = build_webauthn(&state)?;

    // Create a temporary account ID for the registration ceremony.
    // The actual account is created in signup_complete.
    let temp_id = uuid::Uuid::new_v4();

    let (ccr, reg_state) = webauthn
        .start_passkey_registration(temp_id, "New User", "New User", None)
        .map_err(|e| ApiError::internal(format!("webauthn registration error: {e}")))?;

    let state_json = serde_json::to_value(&reg_state)
        .map_err(|e| ApiError::internal(format!("failed to serialize reg state: {e}")))?;

    let challenge_key = uuid::Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(120);
    let row = hh_db::repo::auth_challenges::create(
        &state.db,
        &challenge_key,
        &serde_json::json!({
            "type": "passkey_signup",
            "temp_id": temp_id.to_string(),
            "reg_state": state_json,
        }),
        expires_at,
    )
    .await?;

    Ok(Json(RegisterBeginResponse {
        challenge_id: row.id,
        options: ccr,
    }))
}

pub async fn signup_complete(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterCompleteRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let webauthn = build_webauthn(&state)?;

    let challenge = hh_db::repo::auth_challenges::find_by_id(&state.db, req.challenge_id)
        .await?
        .ok_or_else(|| ApiError::bad_request("Challenge not found or expired"))?;

    if challenge.expires_at < chrono::Utc::now() {
        hh_db::repo::auth_challenges::delete_by_id(&state.db, challenge.id).await?;
        return Err(ApiError::bad_request("Challenge expired"));
    }

    if challenge.state["type"].as_str() != Some("passkey_signup") {
        return Err(ApiError::bad_request("Invalid challenge type"));
    }

    let reg_state: PasskeyRegistration =
        serde_json::from_value(challenge.state["reg_state"].clone())
            .map_err(|e| ApiError::internal(format!("failed to deserialize reg state: {e}")))?;

    let passkey = webauthn
        .finish_passkey_registration(&req.credential, &reg_state)
        .map_err(|e| ApiError::bad_request(format!("Registration verification failed: {e}")))?;

    let passkey_json = serde_json::to_value(&passkey)
        .map_err(|e| ApiError::internal(format!("failed to serialize passkey: {e}")))?;

    let cose_key_json = &passkey_json["cred"]["cred"];
    let cose_key_bytes = serde_json::to_vec(cose_key_json)
        .map_err(|e| ApiError::internal(format!("failed to serialize cose key: {e}")))?;

    let cred_id_value = &passkey_json["cred"]["cred_id"];
    let cred_id_bytes: Vec<u8> = if let Some(s) = cred_id_value.as_str() {
        base64_url_decode(s)?
    } else if let Some(arr) = cred_id_value.as_array() {
        arr.iter().map(|v| v.as_u64().unwrap_or(0) as u8).collect()
    } else {
        return Err(ApiError::internal("unexpected cred_id format"));
    };

    let counter = passkey_json["cred"]["counter"].as_u64().unwrap_or(0) as i32;

    // Create a new account
    let account = hh_db::repo::accounts::create(&state.db, None).await?;

    // Store the passkey credential
    hh_db::repo::passkeys::create(
        &state.db,
        account.id,
        &cred_id_bytes,
        &cose_key_bytes,
        counter,
        &req.name,
    )
    .await?;

    hh_db::repo::auth_challenges::delete_by_id(&state.db, challenge.id).await?;

    // Create session
    let (_, cookie_value) =
        auth::create_session_cookie(&state.db, account.id, &state.config.listen_addr).await?;

    let body = AuthResponse {
        account_id: account.id,
        email: account.email.clone(),
        plan: account.plan.clone(),
        username: account.username.clone(),
    };

    let mut response = Json(body).into_response();
    response.headers_mut().insert(
        SET_COOKIE,
        HeaderValue::from_str(&cookie_value)
            .map_err(|_| ApiError::internal("failed to build cookie"))?,
    );

    Ok(response)
}

// ─── Login (unauthenticated, manual WebAuthn verification) ──────────────────

#[derive(Serialize)]
pub struct LoginBeginResponse {
    pub challenge_id: uuid::Uuid,
    pub options: serde_json::Value,
}

pub async fn login_begin(
    State(state): State<Arc<AppState>>,
) -> Result<Json<LoginBeginResponse>, ApiError> {
    if state.config.webauthn_rp_id.is_empty() {
        return Err(ApiError::bad_request(
            "Passkey authentication is not configured",
        ));
    }

    let challenge_bytes: [u8; 32] = {
        use rand::Rng;
        rand::thread_rng().gen()
    };
    let challenge_b64 = base64_url_encode(&challenge_bytes);

    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(120);
    let row = hh_db::repo::auth_challenges::create(
        &state.db,
        &challenge_b64,
        &serde_json::json!({
            "type": "passkey_login",
            "challenge_bytes": challenge_bytes.to_vec(),
        }),
        expires_at,
    )
    .await?;

    let options = serde_json::json!({
        "publicKey": {
            "challenge": challenge_b64,
            "rpId": state.config.webauthn_rp_id,
            "timeout": 120000,
            "userVerification": "preferred",
            "allowCredentials": [],
        }
    });

    Ok(Json(LoginBeginResponse {
        challenge_id: row.id,
        options,
    }))
}

#[derive(Deserialize)]
pub struct LoginCompleteRequest {
    pub challenge_id: uuid::Uuid,
    /// Base64url-encoded credential ID
    pub raw_id: String,
    /// Base64url-encoded clientDataJSON
    pub client_data_json: String,
    /// Base64url-encoded authenticatorData
    pub authenticator_data: String,
    /// Base64url-encoded signature
    pub signature: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub account_id: uuid::Uuid,
    pub email: Option<String>,
    pub plan: String,
    pub username: Option<String>,
}

pub async fn login_complete(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginCompleteRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let challenge = hh_db::repo::auth_challenges::find_by_id(&state.db, req.challenge_id)
        .await?
        .ok_or_else(|| ApiError::bad_request("Challenge not found or expired"))?;

    if challenge.expires_at < chrono::Utc::now() {
        hh_db::repo::auth_challenges::delete_by_id(&state.db, challenge.id).await?;
        return Err(ApiError::bad_request("Challenge expired"));
    }

    let stored_challenge = challenge.challenge.clone();

    // Decode the raw credential ID
    let cred_id_bytes = base64_url_decode(&req.raw_id)?;

    // Decode clientDataJSON and verify
    let client_data_bytes = base64_url_decode(&req.client_data_json)?;
    let client_data: serde_json::Value = serde_json::from_slice(&client_data_bytes)
        .map_err(|_| ApiError::bad_request("Invalid clientDataJSON"))?;

    let cd_type = client_data["type"]
        .as_str()
        .ok_or_else(|| ApiError::bad_request("Missing type in clientDataJSON"))?;
    if cd_type != "webauthn.get" {
        return Err(ApiError::bad_request("Invalid clientDataJSON type"));
    }

    let cd_challenge = client_data["challenge"]
        .as_str()
        .ok_or_else(|| ApiError::bad_request("Missing challenge in clientDataJSON"))?;
    if cd_challenge != stored_challenge {
        return Err(ApiError::bad_request("Challenge mismatch"));
    }

    let cd_origin = client_data["origin"]
        .as_str()
        .ok_or_else(|| ApiError::bad_request("Missing origin in clientDataJSON"))?;
    if cd_origin != state.config.webauthn_rp_origin {
        return Err(ApiError::bad_request("Origin mismatch"));
    }

    // Decode authenticatorData
    let auth_data_bytes = base64_url_decode(&req.authenticator_data)?;
    if auth_data_bytes.len() < 37 {
        return Err(ApiError::bad_request("authenticatorData too short"));
    }

    // Verify rpIdHash (first 32 bytes)
    let rp_id_hash = Sha256::digest(state.config.webauthn_rp_id.as_bytes());
    if auth_data_bytes[..32] != rp_id_hash[..] {
        return Err(ApiError::bad_request("rpIdHash mismatch"));
    }

    // Check flags (byte 32): bit 0 = User Present
    let flags = auth_data_bytes[32];
    if flags & 0x01 == 0 {
        return Err(ApiError::bad_request("User not present"));
    }

    // Extract counter (bytes 33-36, big-endian)
    let new_counter = u32::from_be_bytes([
        auth_data_bytes[33],
        auth_data_bytes[34],
        auth_data_bytes[35],
        auth_data_bytes[36],
    ]);

    // Build signed data: authenticatorData || SHA-256(clientDataJSON)
    let client_data_hash = Sha256::digest(&client_data_bytes);
    let mut signed_data = auth_data_bytes.clone();
    signed_data.extend_from_slice(&client_data_hash);

    // Decode signature
    let sig_bytes = base64_url_decode(&req.signature)?;

    // Look up credential
    let passkey_row =
        hh_db::repo::passkeys::find_by_credential_id(&state.db, &cred_id_bytes)
            .await?
            .ok_or_else(|| ApiError::bad_request("Unknown credential"))?;

    // Verify counter (prevent replay)
    if new_counter > 0 && new_counter <= passkey_row.counter as u32 {
        return Err(ApiError::bad_request("Credential counter did not increase"));
    }

    // Verify signature using stored COSE public key
    verify_cose_signature(&passkey_row.public_key, &signed_data, &sig_bytes)?;

    // Update counter
    hh_db::repo::passkeys::update_counter(&state.db, &cred_id_bytes, new_counter as i32).await?;

    hh_db::repo::auth_challenges::delete_by_id(&state.db, challenge.id).await?;

    let account = hh_db::repo::accounts::find_by_id(&state.db, passkey_row.account_id)
        .await?
        .ok_or_else(|| ApiError::internal("Account not found for passkey credential"))?;

    let (_, cookie_value) =
        auth::create_session_cookie(&state.db, account.id, &state.config.listen_addr).await?;

    let body = AuthResponse {
        account_id: account.id,
        email: account.email.clone(),
        plan: account.plan.clone(),
        username: account.username.clone(),
    };

    let mut response = Json(body).into_response();
    response.headers_mut().insert(
        SET_COOKIE,
        HeaderValue::from_str(&cookie_value)
            .map_err(|_| ApiError::internal("failed to build cookie"))?,
    );

    Ok(response)
}

// ─── COSE key signature verification ────────────────────────────────────────

/// Verify a WebAuthn assertion signature using a stored COSE public key.
///
/// webauthn-rs serializes COSEKey as:
///   `{"key":{"EC_EC2":{"curve":"SECP256R1","x":"<b64url>","y":"<b64url>"}},"type_":"ES256"}`
/// or for EdDSA:
///   `{"key":{"EC_OKP":{"curve":"ED25519","x":"<b64url>"}},"type_":"EDDSA"}`
fn verify_cose_signature(
    cose_key_json: &[u8],
    signed_data: &[u8],
    signature: &[u8],
) -> Result<(), ApiError> {
    let cose: serde_json::Value = serde_json::from_slice(cose_key_json)
        .map_err(|_| ApiError::internal("Invalid stored COSE key"))?;

    let type_field = cose["type_"].as_str().unwrap_or("");
    let key = &cose["key"];

    if let Some(ec2) = key.get("EC_EC2") {
        verify_es256(ec2, signed_data, signature)
    } else if let Some(okp) = key.get("EC_OKP") {
        verify_eddsa(okp, signed_data, signature)
    } else if type_field == "ES256" {
        // Fallback: try top-level EC2 structure
        if let Some(ec2) = key.get("EC2").or_else(|| cose.get("EC2")) {
            verify_es256(ec2, signed_data, signature)
        } else {
            Err(ApiError::bad_request("Unsupported credential key type"))
        }
    } else {
        Err(ApiError::bad_request(format!(
            "Unsupported credential key type: {type_field}"
        )))
    }
}

fn verify_es256(
    ec2: &serde_json::Value,
    signed_data: &[u8],
    signature: &[u8],
) -> Result<(), ApiError> {
    use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};
    use p256::EncodedPoint;

    // x and y are base64url-encoded strings
    let x_str = ec2["x"]
        .as_str()
        .ok_or_else(|| ApiError::internal("Missing x coordinate in EC key"))?;
    let y_str = ec2["y"]
        .as_str()
        .ok_or_else(|| ApiError::internal("Missing y coordinate in EC key"))?;

    let x_bytes = base64_url_decode(x_str)?;
    let y_bytes = base64_url_decode(y_str)?;

    if x_bytes.len() != 32 || y_bytes.len() != 32 {
        return Err(ApiError::bad_request("Invalid EC key coordinates"));
    }

    let point = EncodedPoint::from_affine_coordinates(
        p256::FieldBytes::from_slice(&x_bytes),
        p256::FieldBytes::from_slice(&y_bytes),
        false,
    );

    let verifying_key = VerifyingKey::from_encoded_point(&point)
        .map_err(|_| ApiError::bad_request("Invalid P-256 public key"))?;

    let sig = Signature::from_der(signature)
        .map_err(|_| ApiError::bad_request("Invalid ECDSA signature encoding"))?;

    verifying_key
        .verify(signed_data, &sig)
        .map_err(|_| ApiError::bad_request("Passkey signature verification failed"))?;

    Ok(())
}

fn verify_eddsa(
    okp: &serde_json::Value,
    signed_data: &[u8],
    signature: &[u8],
) -> Result<(), ApiError> {
    use ed25519_dalek::{Signature, Verifier, VerifyingKey};

    let x_str = okp["x"]
        .as_str()
        .ok_or_else(|| ApiError::internal("Missing x coordinate in OKP key"))?;

    let x_bytes = base64_url_decode(x_str)?;
    if x_bytes.len() != 32 {
        return Err(ApiError::bad_request("Invalid Ed25519 public key length"));
    }

    let verifying_key = VerifyingKey::from_bytes(&x_bytes.try_into().unwrap())
        .map_err(|_| ApiError::bad_request("Invalid Ed25519 public key"))?;

    if signature.len() != 64 {
        return Err(ApiError::bad_request("Invalid Ed25519 signature length"));
    }

    let sig = Signature::from_bytes(&signature.try_into().unwrap());

    verifying_key
        .verify(signed_data, &sig)
        .map_err(|_| ApiError::bad_request("Passkey signature verification failed"))?;

    Ok(())
}

fn base64_url_encode(data: &[u8]) -> String {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    URL_SAFE_NO_PAD.encode(data)
}

fn base64_url_decode(s: &str) -> Result<Vec<u8>, ApiError> {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    URL_SAFE_NO_PAD
        .decode(s)
        .map_err(|_| ApiError::bad_request("Invalid base64url encoding"))
}
