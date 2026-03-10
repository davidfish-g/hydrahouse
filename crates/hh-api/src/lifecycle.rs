use futures_util::StreamExt;
use serde_json::json;
use std::sync::Arc;
use tokio_tungstenite::connect_async;
use uuid::Uuid;

use crate::state::AppState;

/// Resolve the HTTP base URL for a hydra-node from the orchestrator's WS URL.
pub async fn node_http_url(state: &Arc<AppState>, head_id: Uuid, node_index: u32) -> String {
    match state.orchestrator.get_node_ws_url(head_id, node_index).await {
        Ok(ws_url) => ws_url.replace("ws://", "http://").replace("wss://", "https://"),
        Err(_) => format!("http://127.0.0.1:{}", 14001 + node_index as u16),
    }
}

/// Spawn a background task that connects to a hydra-node's WebSocket and
/// monitors events to advance the head through its lifecycle states.
/// Automatically reconnects on disconnect while the head remains active.
pub fn spawn_lifecycle_monitor(state: Arc<AppState>, head_id: Uuid, node_index: u32) {
    tokio::spawn(async move {
        let mut attempt = 0u32;
        loop {
            attempt += 1;
            match run_lifecycle_monitor(state.clone(), head_id, node_index).await {
                Ok(MonitorExit::HeadFinalized) => {
                    tracing::info!(%head_id, "lifecycle monitor: head finalized, stopping");
                    break;
                }
                Ok(MonitorExit::HeadAborted) => {
                    tracing::info!(%head_id, "lifecycle monitor: head aborted, stopping");
                    break;
                }
                Ok(MonitorExit::Disconnected) => {
                    if !is_head_active(&state.db, head_id).await {
                        tracing::info!(%head_id, "lifecycle monitor: head no longer active, stopping");
                        break;
                    }
                    let backoff = std::cmp::min(2u64.pow(attempt.min(5)), 30);
                    tracing::warn!(%head_id, attempt, backoff_secs = backoff, "lifecycle monitor disconnected, reconnecting");
                    tokio::time::sleep(std::time::Duration::from_secs(backoff)).await;
                }
                Err(e) => {
                    if !is_head_active(&state.db, head_id).await {
                        tracing::info!(%head_id, error = %e, "lifecycle monitor error but head inactive, stopping");
                        break;
                    }
                    let backoff = std::cmp::min(2u64.pow(attempt.min(5)), 30);
                    tracing::error!(%head_id, attempt, error = %e, backoff_secs = backoff, "lifecycle monitor error, reconnecting");
                    tokio::time::sleep(std::time::Duration::from_secs(backoff)).await;
                }
            }
        }
    });
}

async fn is_head_active(db: &sqlx::PgPool, head_id: Uuid) -> bool {
    match hh_db::repo::heads::find_by_id(db, head_id).await {
        Ok(Some(h)) => matches!(
            h.status.as_str(),
            "provisioning" | "requested" | "initializing" | "committing" | "open" | "closing" | "closed"
        ),
        _ => false,
    }
}

enum MonitorExit {
    HeadFinalized,
    HeadAborted,
    Disconnected,
}

async fn run_lifecycle_monitor(
    state: Arc<AppState>,
    head_id: Uuid,
    node_index: u32,
) -> anyhow::Result<MonitorExit> {
    let ws_url = state
        .orchestrator
        .get_node_ws_url(head_id, node_index)
        .await
        .map_err(|e| anyhow::anyhow!(e))?;

    tracing::info!(%head_id, %ws_url, "lifecycle monitor connecting to hydra-node");

    let mut retries = 0;
    let ws_stream = loop {
        match connect_async(&ws_url).await {
            Ok((stream, _)) => break stream,
            Err(e) => {
                retries += 1;
                if retries > 90 {
                    anyhow::bail!("failed to connect to hydra-node after {retries} retries: {e}");
                }
                if retries % 10 == 0 {
                    tracing::info!(%head_id, retries, error = %e, "still waiting for hydra-node...");
                } else {
                    tracing::debug!(%head_id, retries, error = %e, "waiting for hydra-node...");
                }
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
        }
    };

    tracing::info!(%head_id, retries, "lifecycle monitor connected to hydra-node");

    let (mut tx, mut rx) = ws_stream.split();

    while let Some(msg) = rx.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!(%head_id, error = %e, "ws read error from hydra-node");
                return Ok(MonitorExit::Disconnected);
            }
        };

        let text = match msg {
            tokio_tungstenite::tungstenite::Message::Text(t) => t.to_string(),
            _ => continue,
        };

        let event: serde_json::Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let tag = event.get("tag").and_then(|t| t.as_str()).unwrap_or("");

        tracing::info!(%head_id, tag, "hydra-node event");

        match tag {
            "Greetings" => {
                let head_status = event
                    .get("headStatus")
                    .and_then(|s| s.as_str())
                    .unwrap_or("unknown");
                tracing::info!(%head_id, %head_status, "received Greetings from hydra-node");

                match head_status {
                    "Idle" => {
                        tracing::info!(%head_id, "sending Init command via WebSocket");
                        use futures_util::SinkExt;
                        let init_msg = json!({"tag": "Init"});
                        if let Err(e) = tx.send(tokio_tungstenite::tungstenite::Message::text(init_msg.to_string())).await {
                            tracing::error!(%head_id, error = %e, "failed to send Init");
                        }
                    }
                    "Initializing" => {
                        tracing::info!(%head_id, "node already initializing, auto-committing");
                        auto_commit(&state, head_id).await;
                    }
                    "Open" => {
                        let db_status = hh_db::repo::heads::find_by_id(&state.db, head_id)
                            .await
                            .ok()
                            .flatten()
                            .map(|h| h.status)
                            .unwrap_or_default();

                        if db_status == "closing" {
                            tracing::warn!(%head_id, "DB says 'closing' but node says 'Open' — re-sending Close");
                            use futures_util::SinkExt;
                            let close_msg = json!({"tag": "Close"});
                            if let Err(e) = tx.send(tokio_tungstenite::tungstenite::Message::text(close_msg.to_string())).await {
                                tracing::error!(%head_id, error = %e, "failed to re-send Close");
                            }
                        } else {
                            tracing::info!(%head_id, "node reports head already open");
                            if let Err(e) = hh_db::repo::heads::update_status(&state.db, head_id, "open").await {
                                tracing::warn!(%head_id, error = %e, "failed to update head status to open");
                            }
                        }
                    }
                    "Closed" => {
                        tracing::info!(%head_id, "node reports head already closed, waiting for contestation");
                        if let Err(e) = hh_db::repo::heads::update_status(&state.db, head_id, "closed").await {
                            tracing::warn!(%head_id, error = %e, "failed to update head status to closed");
                        }
                    }
                    "FanoutPossible" => {
                        tracing::info!(%head_id, "node reports fanout possible, sending Fanout");
                        if let Err(e) = hh_db::repo::heads::update_status(&state.db, head_id, "closed").await {
                            tracing::warn!(%head_id, error = %e, "failed to update head status to closed");
                        }
                        use futures_util::SinkExt;
                        let fanout_msg = json!({"tag": "Fanout"});
                        if let Err(e) = tx.send(tokio_tungstenite::tungstenite::Message::text(fanout_msg.to_string())).await {
                            tracing::error!(%head_id, error = %e, "failed to send Fanout");
                        }
                    }
                    "Final" => {
                        tracing::info!(%head_id, "node reports head already finalized");
                        if let Err(e) = hh_db::repo::heads::update_status(&state.db, head_id, "fanned_out").await {
                            tracing::warn!(%head_id, error = %e, "failed to update head status to fanned_out");
                        }
                        return Ok(MonitorExit::HeadFinalized);
                    }
                    _ => {
                        tracing::info!(%head_id, %head_status, "node greeting with status");
                    }
                }
            }

            "HeadIsInitializing" => {
                if let Err(e) = hh_db::repo::heads::update_status(&state.db, head_id, "committing").await {
                    tracing::warn!(%head_id, error = %e, "failed to update head status to committing");
                }
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, "head_initializing", &event).await {
                    tracing::warn!(%head_id, error = %e, "failed to insert head_initializing event");
                }
                tracing::info!(%head_id, "head initializing, auto-committing empty for all participants");
                auto_commit(&state, head_id).await;
            }

            "Committed" => {
                let party = event.get("party").cloned().unwrap_or(json!(null));
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, "participant_committed", &json!({ "party": party })).await {
                    tracing::warn!(%head_id, error = %e, "failed to insert participant_committed event");
                }
                tracing::info!(%head_id, "participant committed");
            }

            "HeadIsOpen" => {
                if let Err(e) = hh_db::repo::heads::update_status(&state.db, head_id, "open").await {
                    tracing::warn!(%head_id, error = %e, "failed to update head status to open");
                }
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, "head_opened", &event).await {
                    tracing::warn!(%head_id, error = %e, "failed to insert head_opened event");
                }

                if let Ok(participants) = hh_db::repo::participants::list_by_head(&state.db, head_id).await {
                    for p in &participants {
                        if let Err(e) = hh_db::repo::participants::update_commit_status(&state.db, p.id, "committed").await {
                            tracing::warn!(%head_id, participant_id = %p.id, error = %e, "failed to update participant commit status");
                        }
                    }
                }

                if let Ok(Some(h)) = hh_db::repo::heads::find_by_id(&state.db, head_id).await {
                    if let Err(e) = hh_db::repo::usage::record(&state.db, h.account_id, Some(head_id), "commit", h.participant_count as i64).await {
                        tracing::warn!(%head_id, error = %e, "failed to record commit usage");
                    }
                    if let Err(e) = hh_db::repo::usage::record(&state.db, h.account_id, Some(head_id), "head_open", 1).await {
                        tracing::warn!(%head_id, error = %e, "failed to record head_open usage");
                    }
                    if let Err(e) = crate::billing::charge_head_open(&state, h.account_id, head_id).await {
                        tracing::warn!(%head_id, error = %e, "failed to charge head_open fee");
                    }
                }

                tracing::info!(%head_id, "*** HEAD IS OPEN ***");
            }

            "PostTxOnChainFailed" => {
                let post_tx_error = event.get("postTxError").cloned().unwrap_or(json!(null));
                let post_chain_tx = event.get("postChainTx").and_then(|v| v.get("tag")).and_then(|t| t.as_str()).unwrap_or("unknown");
                tracing::warn!(%head_id, %post_chain_tx, "on-chain tx failed, will be retried by hydra-node");
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, "post_tx_failed", &json!({
                    "chain_tx": post_chain_tx,
                    "error": post_tx_error,
                })).await {
                    tracing::warn!(%head_id, error = %e, "failed to insert post_tx_failed event");
                }
            }

            "HeadIsClosed" => {
                if let Err(e) = hh_db::repo::heads::update_status(&state.db, head_id, "closed").await {
                    tracing::warn!(%head_id, error = %e, "failed to update head status to closed");
                }
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, "head_closed", &event).await {
                    tracing::warn!(%head_id, error = %e, "failed to insert head_closed event");
                }
                tracing::info!(%head_id, "head CLOSED, waiting for contestation period");
            }

            "ReadyToFanout" => {
                tracing::info!(%head_id, "contestation period ended, sending Fanout via WebSocket");
                use futures_util::SinkExt;
                let fanout_msg = json!({"tag": "Fanout"});
                if let Err(e) = tx.send(tokio_tungstenite::tungstenite::Message::text(fanout_msg.to_string())).await {
                    tracing::error!(%head_id, error = %e, "failed to send Fanout");
                }
            }

            "HeadIsFinalized" => {
                if let Err(e) = hh_db::repo::heads::update_status(&state.db, head_id, "fanned_out").await {
                    tracing::warn!(%head_id, error = %e, "failed to update head status to fanned_out");
                }
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, "head_finalized", &event).await {
                    tracing::warn!(%head_id, error = %e, "failed to insert head_finalized event");
                }
                tracing::info!(%head_id, "head FINALIZED, tearing down resources");

                if let Ok(Some(head)) = hh_db::repo::heads::find_by_id(&state.db, head_id).await {
                    if let Err(e) = state.orchestrator.teardown_head(head_id, head.participant_count as u32).await {
                        tracing::error!(%head_id, error = %e, "failed to teardown head resources");
                    }
                }
                return Ok(MonitorExit::HeadFinalized);
            }

            "HeadIsAborted" => {
                if let Err(e) = hh_db::repo::heads::update_status(&state.db, head_id, "aborted").await {
                    tracing::warn!(%head_id, error = %e, "failed to update head status to aborted");
                }
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, "head_aborted_by_protocol", &event).await {
                    tracing::warn!(%head_id, error = %e, "failed to insert head_aborted_by_protocol event");
                }
                tracing::warn!(%head_id, "head ABORTED by protocol");
                return Ok(MonitorExit::HeadAborted);
            }

            "CommitRecorded" => {
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, tag, &event).await {
                    tracing::warn!(%head_id, %tag, error = %e, "failed to insert event");
                }
                tracing::info!(%head_id, "commit recorded on L1, triggering snapshot poke");
                let state_clone = state.clone();
                tokio::spawn(async move {
                    trigger_snapshot_poke_after_commit(state_clone, head_id).await;
                });
            }

            "SnapshotConfirmed" | "TxValid" | "TxInvalid" => {
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, tag, &event).await {
                    tracing::warn!(%head_id, %tag, error = %e, "failed to insert event");
                }
            }

            "DecommitApproved" | "DecommitFinalized" => {
                if let Err(e) = hh_db::repo::head_events::insert(&state.db, head_id, tag, &event).await {
                    tracing::warn!(%head_id, %tag, error = %e, "failed to insert event");
                }
                if tag == "DecommitFinalized" {
                    tracing::info!(%head_id, "decommit finalized, funds returned to L1");
                }
            }

            _ => {
                tracing::trace!(%head_id, tag, "unhandled hydra event");
            }
        }
    }

    tracing::info!(%head_id, "lifecycle monitor: WebSocket stream ended");
    Ok(MonitorExit::Disconnected)
}

/// Derive the Blockfrost API base URL from the head's network.
pub fn blockfrost_base_url(network: &str) -> String {
    match network {
        "mainnet" => "https://cardano-mainnet.blockfrost.io/api/v0".into(),
        "preview" => "https://cardano-preview.blockfrost.io/api/v0".into(),
        _ => "https://cardano-preprod.blockfrost.io/api/v0".into(),
    }
}

/// After a commit is recorded on L1, send a minimal self-transfer on L2 to trigger
/// the snapshot leader to include the pending deposit in the next ReqSn.
async fn trigger_snapshot_poke_after_commit(state: Arc<AppState>, head_id: Uuid) {
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    if let Err(e) = trigger_snapshot_poke_inner(&state, head_id).await {
        tracing::debug!(%head_id, error = %e, "snapshot poke skipped");
    }
}

async fn trigger_snapshot_poke_inner(state: &Arc<AppState>, head_id: Uuid) -> anyhow::Result<()> {
    let head = hh_db::repo::heads::find_by_id(&state.db, head_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("head not found"))?;
    if head.status != "open" {
        anyhow::bail!("head not open");
    }

    let participants = hh_db::repo::participants::list_by_head(&state.db, head_id).await?;
    let p0 = participants
        .iter()
        .find(|p| p.slot_index == 0)
        .ok_or_else(|| anyhow::anyhow!("no participant 0"))?;
    let sender_addr = p0
        .cardano_address
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("no cardano address"))?;
    let keys_dir = p0
        .keys_secret_ref
        .as_deref()
        .ok_or_else(|| anyhow::anyhow!("no keys"))?;

    let sk_path = std::path::Path::new(keys_dir).join("cardano.sk");
    let content = hh_orchestrator::encrypt::read_key_file_async(&sk_path).await.map_err(|e| anyhow::anyhow!(e))?;
    let sk_json: serde_json::Value = serde_json::from_str(&content)?;
    let cbor_hex = sk_json
        .get("cborHex")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("missing cborHex"))?;
    let sk_hex = cbor_hex.strip_prefix("5820").unwrap_or(cbor_hex);
    let sk_bytes: [u8; 32] = hex::decode(sk_hex)?
        .try_into()
        .map_err(|_| anyhow::anyhow!("wrong key length"))?;
    let signing_key = ed25519_dalek::SigningKey::from_bytes(&sk_bytes);
    let sender_addr_bytes = hh_keys::bech32::bech32_decode_address(sender_addr).map_err(|e| anyhow::anyhow!(e))?;

    let http_url = node_http_url(state, head_id, 0).await;
    let snapshot_url = format!("{http_url}/snapshot/utxo");
    let client = reqwest::Client::new();
    let utxo_resp = client
        .get(&snapshot_url)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("UTxO fetch failed: {e}"))?;
    if !utxo_resp.status().is_success() {
        anyhow::bail!("UTxO endpoint returned {}", utxo_resp.status());
    }
    let utxo_map: serde_json::Map<String, serde_json::Value> = utxo_resp
        .json()
        .await
        .map_err(|e| anyhow::anyhow!("UTxO parse failed: {e}"))?;

    let mut total_input: u64 = 0;
    let mut inputs = Vec::new();
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
        if total_input >= hh_keys::tx::ESTIMATED_FEE_LOVELACE {
            break;
        }
    }
    if total_input < hh_keys::tx::ESTIMATED_FEE_LOVELACE {
        anyhow::bail!("no UTxO for participant 0 yet");
    }

    let fee = hh_keys::tx::estimate_fee(inputs.len(), 1);
    if total_input <= fee {
        anyhow::bail!("insufficient funds for fee");
    }
    let change = total_input - fee;
    let outputs = vec![hh_keys::tx::TxOut {
        address: sender_addr_bytes,
        lovelace: change,
    }];
    let tx_bytes = hh_keys::tx::build_and_sign_tx(&inputs, &outputs, fee, &signing_key);
    let tx_hex = hex::encode(&tx_bytes);

    send_hydra_newtx(state, head_id, &tx_hex).await?;
    tracing::info!(%head_id, "snapshot poke: sent self-transfer to trigger ReqSn");
    Ok(())
}

/// Submit empty commits for all participants so the head can open immediately.
/// Funds are added later via incremental deposits (POST /deposit).
async fn auto_commit(state: &Arc<AppState>, head_id: Uuid) {
    let head = match hh_db::repo::heads::find_by_id(&state.db, head_id).await {
        Ok(Some(h)) => h,
        _ => return,
    };

    let bf_base = blockfrost_base_url(&head.network);
    let bf_submit = format!("{bf_base}/tx/submit");
    let client = reqwest::Client::new();

    for i in 0..head.participant_count as u32 {
        let http_url = node_http_url(state, head_id, i).await;
        let commit_url = format!("{http_url}/commit");

        let mut committed = false;
        for attempt in 1..=5u32 {
            if attempt > 1 {
                let delay = std::cmp::min(5 * attempt, 20);
                tracing::info!(%head_id, node_index = i, attempt, delay_secs = delay, "retrying commit");
                tokio::time::sleep(std::time::Duration::from_secs(delay as u64)).await;
            }

            tracing::info!(%head_id, node_index = i, attempt, "sending empty commit");

            let commit_resp = match client.post(&commit_url).json(&json!({})).send().await {
                Ok(resp) => resp,
                Err(e) => {
                    tracing::error!(%head_id, node_index = i, error = %e, "failed to request commit tx");
                    continue;
                }
            };

            if !commit_resp.status().is_success() {
                let status = commit_resp.status();
                let _body = commit_resp.text().await.unwrap_or_default();
                tracing::warn!(%head_id, node_index = i, attempt, %status, "commit request failed, will retry");
                continue;
            }

            let commit_tx: serde_json::Value = match commit_resp.json().await {
                Ok(v) => v,
                Err(e) => {
                    tracing::error!(%head_id, node_index = i, error = %e, "failed to parse commit tx");
                    continue;
                }
            };

            let cbor_hex = match commit_tx.get("cborHex").and_then(|v| v.as_str()) {
                Some(hex) => hex,
                None => {
                    tracing::error!(%head_id, node_index = i, "commit tx missing cborHex");
                    continue;
                }
            };

            let tx_id = commit_tx.get("txId").and_then(|v| v.as_str()).unwrap_or("unknown");
            tracing::info!(%head_id, node_index = i, %tx_id, "got commit tx, submitting to L1");

            let cbor_bytes = match hex::decode(cbor_hex) {
                Ok(b) => b,
                Err(e) => {
                    tracing::error!(%head_id, error = %e, "failed to decode commit tx CBOR hex");
                    continue;
                }
            };

            match client
                .post(&bf_submit)
                .header("project_id", &state.config.blockfrost_project_id)
                .header("Content-Type", "application/cbor")
                .body(cbor_bytes)
                .send()
                .await
            {
                Ok(resp) => {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();
                    if status.is_success() {
                        tracing::info!(%head_id, node_index = i, %tx_id, "commit tx submitted to L1");
                        committed = true;
                        break;
                    } else {
                        tracing::warn!(%head_id, node_index = i, %status, %body, "L1 submit failed, will retry");
                    }
                }
                Err(e) => {
                    tracing::error!(%head_id, node_index = i, error = %e, "failed to submit commit tx to Blockfrost");
                }
            }
        }

        if !committed {
            tracing::error!(%head_id, node_index = i, "commit failed after all retries");
        }
    }
}

/// Send a command to the hydra-node via WebSocket and wait for acknowledgment.
/// Waits up to 5 seconds for the node to echo back a response confirming it
/// processed the command, preventing the connection from dropping prematurely.
/// Send a NewTx command to the hydra-node via WebSocket for L2 transaction submission.
/// Returns the response message from the node (e.g. TxValid, TxInvalid).
pub async fn send_hydra_newtx(
    state: &Arc<AppState>,
    head_id: Uuid,
    tx_cbor_hex: &str,
) -> anyhow::Result<serde_json::Value> {
    let ws_url = state
        .orchestrator
        .get_node_ws_url(head_id, 0)
        .await
        .map_err(|e| anyhow::anyhow!(e))?;

    let (ws_stream, _) = connect_async(&ws_url).await?;
    let (mut tx, mut rx) = ws_stream.split();

    let _ = tokio::time::timeout(std::time::Duration::from_secs(5), rx.next()).await;

    use futures_util::SinkExt;
    let msg = json!({
        "tag": "NewTx",
        "transaction": {
            "cborHex": tx_cbor_hex
        }
    });
    tx.send(tokio_tungstenite::tungstenite::Message::text(msg.to_string()))
        .await?;

    tracing::info!(%head_id, "sent NewTx via WebSocket");

    let timeout = tokio::time::timeout(std::time::Duration::from_secs(10), rx.next()).await;

    match timeout {
        Ok(Some(Ok(resp_msg))) => {
            let text = resp_msg.to_text().unwrap_or("");
            let parsed: serde_json::Value = serde_json::from_str(text).unwrap_or_default();
            let tag = parsed.get("tag").and_then(|t| t.as_str()).unwrap_or("");
            if tag == "TxInvalid" || tag == "CommandFailed" {
                tracing::error!(%head_id, response = %parsed, "hydra-node rejected NewTx");
                anyhow::bail!("hydra-node rejected transaction: {parsed}");
            }
            tracing::info!(%head_id, tag, "hydra-node acknowledged NewTx");
            Ok(parsed)
        }
        Ok(Some(Err(e))) => {
            anyhow::bail!("WebSocket error after NewTx: {e}");
        }
        Ok(None) => {
            anyhow::bail!("WebSocket closed after NewTx");
        }
        Err(_) => {
            tracing::info!(%head_id, "no immediate response to NewTx (may still succeed)");
            Ok(json!({"status": "submitted_no_ack"}))
        }
    }
}

/// Send a Decommit command to the hydra-node to withdraw a UTxO from L2 back to L1.
pub async fn send_hydra_decommit(
    state: &Arc<AppState>,
    head_id: Uuid,
    utxo_to_decommit: &serde_json::Value,
) -> anyhow::Result<serde_json::Value> {
    let ws_url = state
        .orchestrator
        .get_node_ws_url(head_id, 0)
        .await
        .map_err(|e| anyhow::anyhow!(e))?;

    let (ws_stream, _) = connect_async(&ws_url).await?;
    let (mut tx, mut rx) = ws_stream.split();

    let _ = tokio::time::timeout(std::time::Duration::from_secs(5), rx.next()).await;

    use futures_util::SinkExt;
    let msg = json!({
        "tag": "Decommit",
        "utxoToDecommit": utxo_to_decommit
    });
    tx.send(tokio_tungstenite::tungstenite::Message::text(msg.to_string()))
        .await?;

    tracing::info!(%head_id, "sent Decommit via WebSocket");

    let timeout = tokio::time::timeout(std::time::Duration::from_secs(15), rx.next()).await;

    match timeout {
        Ok(Some(Ok(resp_msg))) => {
            let text = resp_msg.to_text().unwrap_or("");
            let parsed: serde_json::Value = serde_json::from_str(text).unwrap_or_default();
            let tag = parsed.get("tag").and_then(|t| t.as_str()).unwrap_or("");
            if tag == "DecommitInvalid" || tag == "CommandFailed" {
                tracing::error!(%head_id, response = %parsed, "hydra-node rejected Decommit");
                anyhow::bail!("hydra-node rejected decommit: {parsed}");
            }
            if tag == "DecommitApproved" {
                tracing::info!(%head_id, "hydra-node approved Decommit");
            }
            Ok(parsed)
        }
        Ok(Some(Err(e))) => {
            anyhow::bail!("WebSocket error after Decommit: {e}");
        }
        Ok(None) => {
            anyhow::bail!("WebSocket closed after Decommit");
        }
        Err(_) => {
            tracing::info!(%head_id, "no immediate response to Decommit (may still succeed)");
            Ok(json!({"status": "submitted_no_ack"}))
        }
    }
}

pub async fn send_hydra_command(
    state: &Arc<AppState>,
    head_id: Uuid,
    command: &str,
) -> anyhow::Result<()> {
    let ws_url = state
        .orchestrator
        .get_node_ws_url(head_id, 0)
        .await
        .map_err(|e| anyhow::anyhow!(e))?;

    let (ws_stream, _) = connect_async(&ws_url).await?;
    let (mut tx, mut rx) = ws_stream.split();

    // Consume the initial Greetings message
    let _ = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        rx.next(),
    ).await;

    use futures_util::SinkExt;
    let msg = json!({"tag": command});
    tx.send(tokio_tungstenite::tungstenite::Message::text(msg.to_string()))
        .await?;

    tracing::info!(%head_id, command, "sent hydra command via WebSocket");

    // Wait for the node to respond (confirms it processed our command).
    // The hydra-node emits a CommandFailed or relevant state event.
    let timeout = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        rx.next(),
    ).await;

    match timeout {
        Ok(Some(Ok(resp_msg))) => {
            let text = resp_msg.to_text().unwrap_or("");
            if text.contains("CommandFailed") {
                let parsed: serde_json::Value = serde_json::from_str(text).unwrap_or_default();
                tracing::error!(%head_id, command, response = %parsed, "hydra-node rejected command");
                anyhow::bail!("hydra-node rejected {command}: {parsed}");
            }
            tracing::info!(%head_id, command, "hydra-node acknowledged command");
        }
        Ok(Some(Err(e))) => {
            tracing::warn!(%head_id, command, error = %e, "WS error after sending command");
        }
        Ok(None) => {
            tracing::warn!(%head_id, command, "WS closed after sending command");
        }
        Err(_) => {
            tracing::info!(%head_id, command, "no immediate response (tx likely being built)");
        }
    }

    Ok(())
}
