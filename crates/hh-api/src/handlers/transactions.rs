use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::AccountId;
use crate::error::ApiError;
use crate::state::AppState;

/// Deposit funds into an open Hydra head (incremental commit).
/// Queries Blockfrost for UTxOs sent by the dApp/user to a participant's
/// Cardano address, then calls the hydra-node's /commit endpoint to create
/// a deposit transaction. The deposit tx is signed by the node's key and
/// submitted to L1; once confirmed, the funds appear on L2.
pub async fn deposit(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
    Json(body): Json<DepositRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = super::get_owned_head(&state.db, head_id, account.0).await?;

    if !state.config.stripe_secret_key.is_empty() && !crate::billing::is_free_network(&row.network) {
        crate::billing::check_sufficient_balance(&state, account.0, state.config.cost_api_request_cents).await?;
    }

    if row.status != "open" {
        return Err(ApiError::bad_request(format!(
            "cannot deposit: head is in '{}' state, must be 'open'",
            row.status
        )));
    }

    let participants = hh_db::repo::participants::list_by_head(&state.db, head_id).await?;
    let participant = participants
        .iter()
        .find(|p| p.slot_index == body.slot)
        .ok_or_else(|| ApiError::bad_request(format!("participant slot {} not found", body.slot)))?;

    let node_addr = participant
        .cardano_address
        .as_deref()
        .ok_or_else(|| ApiError::internal("participant has no cardano address"))?;

    let bf_base = crate::lifecycle::blockfrost_base_url(&row.network);
    let bf_project_id = row.network.parse::<hh_core::network::Network>().ok()
        .and_then(|n| state.config.blockfrost_project_id(n))
        .ok_or_else(|| ApiError::internal(format!("no Blockfrost project ID for network {}", row.network)))?;
    let client = reqwest::Client::new();

    let utxos_url = format!("{bf_base}/addresses/{node_addr}/utxos");
    let utxos_resp = client
        .get(&utxos_url)
        .header("project_id", bf_project_id)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to query Blockfrost: {e}")))?;

    if !utxos_resp.status().is_success() {
        return Err(ApiError::internal("failed to query UTxOs from Blockfrost"));
    }

    let utxos: Vec<serde_json::Value> = utxos_resp.json().await.unwrap_or_default();

    // Collect all pure-ADA UTxOs sorted by value, then pick the best one to
    // deposit while ensuring a fuel UTxO remains for the hydra-node. The node
    // needs at least one wallet UTxO for fees and collateral in the deposit tx.
    struct CandidateUtxo {
        tx_hash: String,
        output_index: u64,
        lovelace: u64,
    }

    let mut candidates: Vec<CandidateUtxo> = Vec::new();

    for utxo in &utxos {
        let amounts = utxo.get("amount").and_then(|a| a.as_array());
        let is_pure_ada = amounts
            .map(|arr| arr.len() == 1 && arr[0].get("unit").and_then(|u| u.as_str()) == Some("lovelace"))
            .unwrap_or(false);

        if !is_pure_ada {
            continue;
        }

        let lovelace: u64 = amounts
            .and_then(|arr| arr[0].get("quantity").and_then(|q| q.as_str()))
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        if lovelace < hh_keys::tx::MIN_UTXO_LOVELACE {
            continue;
        }

        let tx_hash = utxo.get("tx_hash").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let output_index = utxo.get("output_index").and_then(|v| v.as_u64()).unwrap_or(0);

        candidates.push(CandidateUtxo { tx_hash, output_index, lovelace });
    }

    candidates.sort_by(|a, b| b.lovelace.cmp(&a.lovelace));

    // We need at least 2 UTxOs: one to deposit and one for fuel/collateral.
    // Pick the SECOND-largest as the deposit target so the largest stays as fuel.
    // If there's only one UTxO, it cannot be deposited (no fuel would remain).
    if candidates.len() < 2 {
        return Err(ApiError::bad_request(format!(
            "need at least 2 UTxOs at {node_addr}: one for deposit and one for fuel. \
             Send ADA to this address first."
        )));
    }

    let deposit_candidate = &candidates[1];
    let key = format!("{}#{}", deposit_candidate.tx_hash, deposit_candidate.output_index);
    let total_lovelace = deposit_candidate.lovelace;

    let mut deposit_utxo = serde_json::Map::new();
    deposit_utxo.insert(
        key,
        json!({
            "address": node_addr,
            "datum": null,
            "datumhash": null,
            "inlineDatum": null,
            "inlineDatumRaw": null,
            "referenceScript": null,
            "value": { "lovelace": total_lovelace }
        }),
    );

    let http_url = crate::lifecycle::node_http_url(&state, head_id, body.slot as u32).await;
    let commit_url = format!("{http_url}/commit");

    let commit_body = serde_json::Value::Object(deposit_utxo);

    let commit_resp = client
        .post(&commit_url)
        .json(&commit_body)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to request deposit tx from hydra-node: {e}")))?;

    if !commit_resp.status().is_success() {
        let status = commit_resp.status();
        let body = commit_resp.text().await.unwrap_or_default();
        return Err(ApiError::internal(format!(
            "hydra-node rejected deposit: {status} {body}"
        )));
    }

    let deposit_tx: serde_json::Value = commit_resp
        .json()
        .await
        .map_err(|e| ApiError::internal(format!("failed to parse deposit tx: {e}")))?;

    let cbor_hex = deposit_tx
        .get("cborHex")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::internal("deposit tx missing cborHex"))?;

    let tx_id = deposit_tx.get("txId").and_then(|v| v.as_str()).unwrap_or("unknown");

    let cbor_bytes = hex::decode(cbor_hex)
        .map_err(|e| ApiError::internal(format!("invalid deposit tx CBOR: {e}")))?;

    let bf_submit = format!("{bf_base}/tx/submit");
    let submit_resp = client
        .post(&bf_submit)
        .header("project_id", bf_project_id)
        .header("Content-Type", "application/cbor")
        .body(cbor_bytes)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to submit deposit tx: {e}")))?;

    if !submit_resp.status().is_success() {
        let body = submit_resp.text().await.unwrap_or_default();
        return Err(ApiError::internal(format!("L1 submit of deposit tx failed: {body}")));
    }

    if let Err(e) = hh_db::repo::head_events::insert(
        &state.db,
        head_id,
        "deposit_submitted",
        &json!({ "slot": body.slot, "lovelace": total_lovelace, "tx_id": tx_id }),
    )
    .await
    {
        tracing::warn!(%head_id, error = %e, "failed to insert deposit_submitted event");
    }

    if let Err(e) = hh_db::repo::usage::record(&state.db, account.0, Some(head_id), "deposit", 1).await {
        tracing::warn!(%head_id, error = %e, "failed to record deposit usage");
    }
    if let Err(e) = crate::billing::charge_api_request(&state, account.0, Some(head_id), &row.network).await {
        tracing::warn!(%head_id, error = %e, "failed to charge for API request");
    }

    Ok(Json(json!({
        "status": "submitted",
        "tx_id": tx_id,
        "slot": body.slot,
        "lovelace": total_lovelace,
        "message": "deposit tx submitted to L1, funds will appear on L2 once confirmed"
    })))
}

#[derive(Debug, Deserialize, Serialize)]
pub struct DepositRequest {
    pub slot: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct DecommitRequest {
    pub slot: i32,
    pub lovelace: u64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TransferRequest {
    pub from: i32,
    pub to: i32,
    pub lovelace: u64,
}

/// Transfer ADA between participants on L2.
/// In the custodial model, HydraHouse holds all signing keys and can build
/// and sign the L2 transaction on behalf of participants.
pub async fn transfer(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
    Json(req): Json<TransferRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = super::get_owned_head(&state.db, head_id, account.0).await?;

    if !state.config.stripe_secret_key.is_empty() && !crate::billing::is_free_network(&row.network) {
        crate::billing::check_sufficient_balance(&state, account.0, state.config.cost_api_request_cents).await?;
    }

    if row.status != "open" {
        return Err(ApiError::bad_request(format!(
            "cannot transfer: head is in '{}' state, must be 'open'",
            row.status
        )));
    }

    if req.from == req.to {
        return Err(ApiError::bad_request("from and to must be different participants"));
    }

    if req.lovelace == 0 {
        return Err(ApiError::bad_request("lovelace must be greater than 0"));
    }

    let participants = hh_db::repo::participants::list_by_head(&state.db, head_id).await?;

    let sender = participants
        .iter()
        .find(|p| p.slot_index == req.from)
        .ok_or_else(|| ApiError::bad_request(format!("participant slot {} not found", req.from)))?;

    let receiver = participants
        .iter()
        .find(|p| p.slot_index == req.to)
        .ok_or_else(|| ApiError::bad_request(format!("participant slot {} not found", req.to)))?;

    let sender_addr = sender
        .cardano_address
        .as_deref()
        .ok_or_else(|| ApiError::internal("sender has no cardano address"))?;

    let receiver_addr = receiver
        .cardano_address
        .as_deref()
        .ok_or_else(|| ApiError::internal("receiver has no cardano address"))?;

    let keys_dir = sender
        .keys_secret_ref
        .as_deref()
        .ok_or_else(|| ApiError::internal("sender keys not available"))?;

    let sk_path = std::path::Path::new(keys_dir).join("cardano.sk");
    let sk_json: serde_json::Value = {
        let content = hh_orchestrator::encrypt::read_key_file_async(&sk_path)
            .await
            .map_err(|e| ApiError::internal(format!("failed to read signing key: {e}")))?;
        serde_json::from_str(&content)
            .map_err(|e| ApiError::internal(format!("invalid signing key JSON: {e}")))?
    };

    let cbor_hex = sk_json
        .get("cborHex")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::internal("signing key missing cborHex"))?;

    // Text envelope cborHex is "5820" + 32 bytes hex
    let sk_hex = cbor_hex.strip_prefix("5820").unwrap_or(cbor_hex);
    let sk_bytes: [u8; 32] = hex::decode(sk_hex)
        .map_err(|e| ApiError::internal(format!("invalid signing key hex: {e}")))?
        .try_into()
        .map_err(|_| ApiError::internal("signing key wrong length"))?;

    let signing_key = ed25519_dalek::SigningKey::from_bytes(&sk_bytes);

    let http_url = crate::lifecycle::node_http_url(&state, head_id, 0).await;
    let snapshot_url = format!("{http_url}/snapshot/utxo");
    let client = reqwest::Client::new();

    let utxo_resp = client
        .get(&snapshot_url)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to query L2 snapshot: {e}")))?;

    if !utxo_resp.status().is_success() {
        return Err(ApiError::internal("failed to query L2 UTxO snapshot"));
    }

    let utxo_map: serde_json::Map<String, serde_json::Value> = utxo_resp
        .json()
        .await
        .map_err(|e| ApiError::internal(format!("failed to parse L2 snapshot: {e}")))?;

    // Find UTxOs owned by the sender
    let sender_addr_bytes = hh_keys::bech32::bech32_decode_address(sender_addr)
        .map_err(|e| ApiError::internal(format!("decode sender address: {e}")))?;
    let receiver_addr_bytes = hh_keys::bech32::bech32_decode_address(receiver_addr)
        .map_err(|e| ApiError::internal(format!("decode receiver address: {e}")))?;

    let mut inputs = Vec::new();
    let mut total_input: u64 = 0;

    for (utxo_ref, utxo_val) in &utxo_map {
        let utxo_addr = utxo_val.get("address").and_then(|a| a.as_str()).unwrap_or("");
        if utxo_addr != sender_addr {
            continue;
        }

        let lovelace = utxo_val
            .get("value")
            .and_then(|v| v.get("lovelace"))
            .and_then(|l| l.as_u64().or_else(|| l.as_str().and_then(|s| s.parse().ok())))
            .unwrap_or(0);

        let parts: Vec<&str> = utxo_ref.splitn(2, '#').collect();
        if parts.len() != 2 {
            continue;
        }
        let tx_hash_hex = parts[0];
        let tx_idx: u32 = parts[1].parse().unwrap_or(0);
        let tx_hash: [u8; 32] = hex::decode(tx_hash_hex)
            .ok()
            .and_then(|b| b.try_into().ok())
            .unwrap_or([0u8; 32]);

        inputs.push(hh_keys::tx::TxIn {
            tx_hash,
            output_index: tx_idx,
        });
        total_input += lovelace;

        if total_input >= req.lovelace + hh_keys::tx::ESTIMATED_FEE_LOVELACE {
            break;
        }
    }

    if total_input < req.lovelace + hh_keys::tx::ESTIMATED_FEE_LOVELACE {
        return Err(ApiError::bad_request(format!(
            "insufficient L2 balance: sender has {} lovelace, need {} + fee",
            total_input, req.lovelace
        )));
    }

    let fee = hh_keys::tx::estimate_fee(inputs.len(), 2);
    if total_input < req.lovelace + fee {
        return Err(ApiError::bad_request(format!(
            "insufficient L2 balance after fee: have {}, need {} + {} fee",
            total_input, req.lovelace, fee
        )));
    }

    let mut outputs = vec![hh_keys::tx::TxOut {
        address: receiver_addr_bytes,
        lovelace: req.lovelace,
    }];

    let change = total_input - req.lovelace - fee;
    if change > 0 {
        outputs.push(hh_keys::tx::TxOut {
            address: sender_addr_bytes,
            lovelace: change,
        });
    }

    let tx_bytes = hh_keys::tx::build_and_sign_tx(&inputs, &outputs, fee, &signing_key);
    let tx_hex = hex::encode(&tx_bytes);

    let hydra_response = crate::lifecycle::send_hydra_newtx(&state, head_id, &tx_hex)
        .await
        .map_err(|e| ApiError::bad_request(format!("hydra-node rejected L2 transfer: {e}")))?;

    if let Err(e) = hh_db::repo::head_events::insert(
        &state.db,
        head_id,
        "l2_transfer",
        &json!({
            "from": req.from,
            "to": req.to,
            "lovelace": req.lovelace,
        }),
    )
    .await
    {
        tracing::warn!(%head_id, error = %e, "failed to insert l2_transfer event");
    }

    if let Err(e) = hh_db::repo::usage::record(&state.db, account.0, Some(head_id), "l2_tx", 1).await {
        tracing::warn!(%head_id, error = %e, "failed to record l2_tx usage");
    }
    if let Err(e) = crate::billing::charge_api_request(&state, account.0, Some(head_id), &row.network).await {
        tracing::warn!(%head_id, error = %e, "failed to charge for API request");
    }

    Ok(Json(json!({
        "status": "submitted",
        "from": req.from,
        "to": req.to,
        "lovelace": req.lovelace,
        "fee": fee,
        "tx_hex_prefix": &tx_hex[..std::cmp::min(32, tx_hex.len())],
        "hydra_response": hydra_response,
    })))
}

/// Submit a transaction to the L2 head via hydra-node's HTTP API.
/// Accepts `{"cborHex": "<hex-encoded signed tx>"}` or `{"type": "Tx ConwayEra", "cborHex": "..."}`.
pub async fn submit_tx(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = super::get_owned_head(&state.db, head_id, account.0).await?;

    if !state.config.stripe_secret_key.is_empty() && !crate::billing::is_free_network(&row.network) {
        crate::billing::check_sufficient_balance(&state, account.0, state.config.cost_api_request_cents).await?;
    }

    if row.status != "open" {
        return Err(ApiError::bad_request(format!(
            "cannot submit tx: head is in '{}' state, must be 'open'",
            row.status
        )));
    }

    let cbor_hex = body
        .get("cborHex")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::bad_request("missing 'cborHex' field"))?;

    let _ = hex::decode(cbor_hex)
        .map_err(|e| ApiError::bad_request(format!("invalid hex in cborHex: {e}")))?;

    let http_url = crate::lifecycle::node_http_url(&state, head_id, 0).await;
    let url = format!("{http_url}/cardano-transaction");

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&json!({
            "type": "Tx ConwayEra",
            "cborHex": cbor_hex,
        }))
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to reach hydra-node: {e}")))?;

    let status = resp.status();
    let resp_body: serde_json::Value = resp
        .json()
        .await
        .unwrap_or_else(|_| json!({"status": status.as_u16()}));

    if status.is_success() {
        if let Err(e) = hh_db::repo::head_events::insert(
            &state.db,
            head_id,
            "tx_submitted",
            &json!({"cborHex_prefix": &cbor_hex[..std::cmp::min(32, cbor_hex.len())]}),
        )
        .await
        {
            tracing::warn!(%head_id, error = %e, "failed to insert tx_submitted event");
        }

        if let Err(e) = hh_db::repo::usage::record(
            &state.db,
            account.0,
            Some(head_id),
            "l2_tx",
            1,
        )
        .await
        {
            tracing::warn!(%head_id, error = %e, "failed to record l2_tx usage");
        }
        if let Err(e) = crate::billing::charge_api_request(&state, account.0, Some(head_id), &row.network).await {
            tracing::warn!(%head_id, error = %e, "failed to charge for API request");
        }

        Ok(Json(json!({
            "status": "submitted",
            "hydra_response": resp_body,
        })))
    } else {
        Err(ApiError::bad_request(format!(
            "hydra-node rejected transaction: {}",
            resp_body
        )))
    }
}

/// Query the L2 UTxO snapshot from the hydra-node.
pub async fn get_snapshot(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = super::get_owned_head(&state.db, head_id, account.0).await?;

    if row.status != "open" {
        return Err(ApiError::bad_request(format!(
            "cannot query snapshot: head is in '{}' state, must be 'open'",
            row.status
        )));
    }

    let http_url = crate::lifecycle::node_http_url(&state, head_id, 0).await;
    let url = format!("{http_url}/snapshot/utxo");

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to reach hydra-node: {e}")))?;

    let status = resp.status();
    let utxo: serde_json::Value = resp
        .json()
        .await
        .unwrap_or_else(|_| json!({"error": "failed to parse response"}));

    if status.is_success() {
        Ok(Json(json!({
            "head_id": head_id,
            "utxo": utxo,
        })))
    } else {
        Err(ApiError::internal(format!(
            "hydra-node snapshot query failed: {}",
            utxo
        )))
    }
}

/// Withdraw (decommit) funds from L2 back to L1 for a participant.
/// Picks a UTxO from the L2 snapshot for the given slot that has at least `lovelace`,
/// sends Decommit to the hydra-node, and records the event.
pub async fn decommit(
    State(state): State<Arc<AppState>>,
    axum::Extension(account): axum::Extension<AccountId>,
    Path(head_id): Path<Uuid>,
    Json(body): Json<DecommitRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let row = super::get_owned_head(&state.db, head_id, account.0).await?;

    if row.status != "open" {
        return Err(ApiError::bad_request(format!(
            "cannot withdraw: head is in '{}' state, must be 'open'",
            row.status
        )));
    }

    if body.lovelace == 0 {
        return Err(ApiError::bad_request("lovelace must be positive"));
    }

    let participants = hh_db::repo::participants::list_by_head(&state.db, head_id).await?;
    let participant = participants
        .iter()
        .find(|p| p.slot_index == body.slot)
        .ok_or_else(|| ApiError::bad_request(format!("participant slot {} not found", body.slot)))?;

    let participant_addr = participant
        .cardano_address
        .as_deref()
        .ok_or_else(|| ApiError::internal("participant has no cardano address"))?;

    let http_url = crate::lifecycle::node_http_url(&state, head_id, 0).await;
    let snapshot_url = format!("{http_url}/snapshot/utxo");
    let client = reqwest::Client::new();
    let utxo_resp = client
        .get(&snapshot_url)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("failed to query L2 snapshot: {e}")))?;

    if !utxo_resp.status().is_success() {
        return Err(ApiError::internal("failed to query L2 UTxO snapshot"));
    }

    let utxo_map: serde_json::Map<String, serde_json::Value> = utxo_resp
        .json()
        .await
        .map_err(|e| ApiError::internal(format!("failed to parse L2 snapshot: {e}")))?;

    let mut candidate: Option<(String, u64, &serde_json::Value)> = None;
    for (utxo_ref, utxo_val) in &utxo_map {
        let addr = utxo_val.get("address").and_then(|a| a.as_str()).unwrap_or("");
        if addr != participant_addr {
            continue;
        }
        let lovelace = utxo_val
            .get("value")
            .and_then(|v| v.get("lovelace"))
            .and_then(|l| l.as_u64().or_else(|| l.as_str().and_then(|s| s.parse().ok())))
            .unwrap_or(0);
        if lovelace >= body.lovelace {
            let take = match &candidate {
                None => true,
                Some((_, l, _)) => *l > lovelace,
            };
            if take {
                candidate = Some((utxo_ref.clone(), lovelace, utxo_val));
            }
        }
    }

    let (utxo_ref, _lovelace, utxo_val) = candidate
        .ok_or_else(|| ApiError::bad_request(format!(
            "no L2 UTxO for participant slot {} with at least {} lovelace",
            body.slot, body.lovelace
        )))?;

    let mut utxo_map_decommit = serde_json::Map::new();
    utxo_map_decommit.insert(utxo_ref.clone(), utxo_val.clone());
    let utxo_to_decommit = serde_json::Value::Object(utxo_map_decommit);

    let hydra_response = crate::lifecycle::send_hydra_decommit(&state, head_id, &utxo_to_decommit)
        .await
        .map_err(|e| ApiError::bad_request(format!("hydra-node rejected decommit: {e}")))?;

    hh_db::repo::head_events::insert(
        &state.db,
        head_id,
        "decommit_submitted",
        &json!({
            "slot": body.slot,
            "lovelace": body.lovelace,
            "utxo_ref": utxo_ref,
            "hydra_response": hydra_response,
        }),
    )
    .await?;

    Ok(Json(json!({
        "status": "submitted",
        "slot": body.slot,
        "lovelace": body.lovelace,
        "utxo_ref": utxo_ref,
        "message": "withdrawal submitted; funds will return to L1 after decommit is finalized",
        "hydra_response": hydra_response,
    })))
}
