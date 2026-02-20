use futures_util::StreamExt;
use serde_json::json;
use std::sync::Arc;
use tokio_tungstenite::connect_async;
use uuid::Uuid;

use crate::state::AppState;

/// Resolve the HTTP base URL for a hydra-node from the orchestrator's WS URL.
async fn node_http_url(state: &Arc<AppState>, head_id: Uuid, node_index: u32) -> String {
    match state.orchestrator.get_node_ws_url(head_id, node_index).await {
        Ok(ws_url) => ws_url.replace("ws://", "http://").replace("wss://", "https://"),
        Err(_) => format!("http://127.0.0.1:{}", 14001 + node_index as u16),
    }
}

/// Spawn a background task that connects to a hydra-node's WebSocket and
/// monitors events to advance the head through its lifecycle states.
pub fn spawn_lifecycle_monitor(state: Arc<AppState>, head_id: Uuid, node_index: u32) {
    tokio::spawn(async move {
        if let Err(e) = run_lifecycle_monitor(state, head_id, node_index).await {
            tracing::error!(%head_id, error = %e, "lifecycle monitor exited with error");
        }
    });
}

async fn run_lifecycle_monitor(
    state: Arc<AppState>,
    head_id: Uuid,
    node_index: u32,
) -> anyhow::Result<()> {
    let ws_url = state
        .orchestrator
        .get_node_ws_url(head_id, node_index)
        .await
        .map_err(|e| anyhow::anyhow!(e))?;

    tracing::info!(%head_id, %ws_url, "lifecycle monitor connecting to hydra-node");

    // Retry connection with backoff -- containers can take 30-60s to become ready,
    // and may crash and need to be restarted (e.g. unfunded wallet).
    // 90 retries * 2s = 3 minutes of patience.
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
                break;
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
                        // Send Init via WebSocket
                        tracing::info!(%head_id, "sending Init command via WebSocket");
                        use futures_util::SinkExt;
                        let init_msg = serde_json::json!({"tag": "Init"});
                        if let Err(e) = tx.send(tokio_tungstenite::tungstenite::Message::text(init_msg.to_string())).await {
                            tracing::error!(%head_id, error = %e, "failed to send Init");
                        }
                    }
                    "Initializing" => {
                        // Already initialized, need to commit
                        tracing::info!(%head_id, "node already initializing, sending commit");
                        auto_commit_empty(&state, head_id).await;
                    }
                    "Open" => {
                        tracing::info!(%head_id, "node reports head already open");
                        let _ = hh_db::repo::heads::update_status(&state.db, head_id, "open").await;
                    }
                    _ => {
                        tracing::info!(%head_id, %head_status, "node greeting with status");
                    }
                }
            }

            "HeadIsInitializing" => {
                let _ = hh_db::repo::heads::update_status(&state.db, head_id, "committing")
                    .await;
                let _ = hh_db::repo::head_events::insert(
                    &state.db,
                    head_id,
                    "head_initializing",
                    &event,
                )
                .await;

                tracing::info!(%head_id, "head initializing, auto-committing empty for all participants");
                auto_commit_empty(&state, head_id).await;
            }

            "Committed" => {
                let party = event.get("party").cloned().unwrap_or(json!(null));
                let _ = hh_db::repo::head_events::insert(
                    &state.db,
                    head_id,
                    "participant_committed",
                    &json!({ "party": party }),
                )
                .await;
                tracing::info!(%head_id, "participant committed");
            }

            "HeadIsOpen" => {
                let _ = hh_db::repo::heads::update_status(&state.db, head_id, "open").await;
                let _ = hh_db::repo::head_events::insert(
                    &state.db,
                    head_id,
                    "head_opened",
                    &event,
                )
                .await;

                if let Ok(participants) =
                    hh_db::repo::participants::list_by_head(&state.db, head_id).await
                {
                    for p in &participants {
                        let _ = hh_db::repo::participants::update_commit_status(
                            &state.db,
                            p.id,
                            "committed",
                        )
                        .await;
                    }
                }

                tracing::info!(%head_id, "*** HEAD IS OPEN ***");
            }

            "HeadIsClosed" => {
                let _ = hh_db::repo::heads::update_status(&state.db, head_id, "closed").await;
                let _ = hh_db::repo::head_events::insert(
                    &state.db,
                    head_id,
                    "head_closed",
                    &event,
                )
                .await;
                tracing::info!(%head_id, "head CLOSED, waiting for contestation period");
            }

            "ReadyToFanout" => {
                tracing::info!(%head_id, "contestation period ended, sending Fanout");
                let http_url = node_http_url(&state, head_id, node_index).await;
                let client = reqwest::Client::new();
                let _ = client.post(format!("{http_url}/fanout")).send().await;
            }

            "HeadIsFinalized" => {
                let _ = hh_db::repo::heads::update_status(&state.db, head_id, "fanned_out")
                    .await;
                let _ = hh_db::repo::head_events::insert(
                    &state.db,
                    head_id,
                    "head_finalized",
                    &event,
                )
                .await;
                tracing::info!(%head_id, "head FINALIZED, tearing down resources");

                if let Ok(Some(head)) = hh_db::repo::heads::find_by_id(&state.db, head_id).await {
                    let _ = state
                        .orchestrator
                        .teardown_head(head_id, head.participant_count as u32)
                        .await;
                }

                break;
            }

            "HeadIsAborted" => {
                let _ = hh_db::repo::heads::update_status(&state.db, head_id, "aborted").await;
                let _ = hh_db::repo::head_events::insert(
                    &state.db,
                    head_id,
                    "head_aborted_by_protocol",
                    &event,
                )
                .await;
                tracing::warn!(%head_id, "head ABORTED by protocol");
                break;
            }

            "SnapshotConfirmed" | "TxValid" | "TxInvalid" => {
                let _ = hh_db::repo::head_events::insert(
                    &state.db,
                    head_id,
                    tag,
                    &event,
                )
                .await;
            }

            _ => {
                tracing::trace!(%head_id, tag, "unhandled hydra event");
            }
        }
    }

    tracing::info!(%head_id, "lifecycle monitor exiting");
    Ok(())
}

async fn auto_commit_empty(state: &Arc<AppState>, head_id: Uuid) {
    let head = match hh_db::repo::heads::find_by_id(&state.db, head_id).await {
        Ok(Some(h)) => h,
        _ => return,
    };

    let client = reqwest::Client::new();
    for i in 0..head.participant_count as u32 {
        let http_url = node_http_url(state, head_id, i).await;
        let commit_url = format!("{http_url}/commit");

        // Step 1: Get the signed commit transaction from hydra-node
        let commit_resp = match client.post(&commit_url).json(&json!({})).send().await {
            Ok(resp) => resp,
            Err(e) => {
                tracing::error!(%head_id, node_index = i, error = %e, "failed to get commit tx");
                continue;
            }
        };

        if !commit_resp.status().is_success() {
            let status = commit_resp.status();
            let body = commit_resp.text().await.unwrap_or_default();
            tracing::error!(%head_id, node_index = i, %status, %body, "commit endpoint returned error");
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
        tracing::info!(%head_id, node_index = i, %tx_id, "got signed commit tx, submitting to L1");

        // Step 2: Submit the signed tx to Cardano L1 via Blockfrost
        let cbor_bytes = match hex::decode(cbor_hex) {
            Ok(b) => b,
            Err(e) => {
                tracing::error!(%head_id, error = %e, "failed to decode commit tx CBOR hex");
                continue;
            }
        };

        let blockfrost_url = format!(
            "https://cardano-preprod.blockfrost.io/api/v0/tx/submit"
        );

        match client
            .post(&blockfrost_url)
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
                    tracing::info!(%head_id, node_index = i, %tx_id, "commit tx submitted to L1 successfully");
                } else {
                    tracing::error!(%head_id, node_index = i, %status, %body, "failed to submit commit tx to L1");
                }
            }
            Err(e) => {
                tracing::error!(%head_id, node_index = i, error = %e, "failed to submit commit tx to Blockfrost");
            }
        }
    }
}

pub async fn send_hydra_command(
    state: &Arc<AppState>,
    head_id: Uuid,
    command: &str,
) -> anyhow::Result<()> {
    let http_url = node_http_url(state, head_id, 0).await;
    let url = format!("{http_url}/{}", command.to_lowercase());

    let client = reqwest::Client::new();
    let resp = client.post(&url).send().await?;

    tracing::info!(%head_id, command, status = %resp.status(), "sent hydra command");
    Ok(())
}
