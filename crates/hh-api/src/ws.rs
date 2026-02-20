use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Path, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio_tungstenite::connect_async;
use uuid::Uuid;

use crate::state::AppState;

/// WebSocket upgrade handler that proxies to the underlying hydra-node.
pub async fn ws_proxy(
    State(state): State<Arc<AppState>>,
    Path(head_id): Path<Uuid>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws_proxy(state, head_id, socket))
}

async fn handle_ws_proxy(state: Arc<AppState>, head_id: Uuid, client_ws: WebSocket) {
    let head = match hh_db::repo::heads::find_by_id(&state.db, head_id).await {
        Ok(Some(h)) => h,
        _ => {
            tracing::warn!(%head_id, "ws proxy: head not found");
            return;
        }
    };

    if head.status != "open" && head.status != "committing" && head.status != "initializing" {
        tracing::warn!(%head_id, status = %head.status, "ws proxy: head not in connectable state");
        return;
    }

    // Resolve the internal URL from the orchestrator
    let hydra_url = match state.orchestrator.get_node_ws_url(head_id, 0).await {
        Ok(url) => url,
        Err(e) => {
            tracing::error!(%head_id, error = %e, "ws proxy: failed to resolve node URL");
            return;
        }
    };

    let hydra_conn = match connect_async(&hydra_url).await {
        Ok((ws, _)) => ws,
        Err(e) => {
            tracing::error!(%head_id, error = %e, "ws proxy: failed to connect to hydra-node");
            return;
        }
    };

    let (mut client_tx, mut client_rx) = client_ws.split();
    let (mut hydra_tx, mut hydra_rx) = hydra_conn.split();

    let client_to_hydra = async {
        while let Some(Ok(msg)) = client_rx.next().await {
            let tung_msg = match msg {
                Message::Text(t) => {
                    tokio_tungstenite::tungstenite::Message::text(t.to_string())
                }
                Message::Binary(b) => {
                    tokio_tungstenite::tungstenite::Message::binary(b.to_vec())
                }
                Message::Ping(p) => tokio_tungstenite::tungstenite::Message::Ping(p),
                Message::Pong(p) => tokio_tungstenite::tungstenite::Message::Pong(p),
                Message::Close(_) => break,
            };
            if hydra_tx.send(tung_msg).await.is_err() {
                break;
            }
        }
    };

    let hydra_to_client = async {
        while let Some(Ok(msg)) = hydra_rx.next().await {
            let axum_msg = match msg {
                tokio_tungstenite::tungstenite::Message::Text(t) => {
                    Message::Text(t.to_string().into())
                }
                tokio_tungstenite::tungstenite::Message::Binary(b) => {
                    Message::Binary(b.to_vec().into())
                }
                tokio_tungstenite::tungstenite::Message::Ping(p) => Message::Ping(p),
                tokio_tungstenite::tungstenite::Message::Pong(p) => Message::Pong(p),
                tokio_tungstenite::tungstenite::Message::Close(_) => break,
                _ => continue,
            };
            if client_tx.send(axum_msg).await.is_err() {
                break;
            }
        }
    };

    tokio::select! {
        _ = client_to_hydra => {},
        _ = hydra_to_client => {},
    }

    tracing::info!(%head_id, "ws proxy: connection closed");
}
