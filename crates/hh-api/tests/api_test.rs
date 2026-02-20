// Integration tests require a running Postgres instance.
// Run with: DATABASE_URL=postgres://... cargo test -p hh-api --test api_test
//
// These tests are skipped when the DB is not available.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::middleware;
use axum::routing::{delete, get, post};
use axum::Router;
use hh_api::auth;
use hh_api::handlers::{heads, health};
use hh_api::state::AppState;
use hh_core::config::AppConfig;
use hh_core::error::HydraHouseError;
use hh_core::head::HeadConfig;
use hh_core::network::Network;
use hh_orchestrator::manager::{HeadDeployment, Orchestrator, ProvisionedNode};
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

/// A mock orchestrator that doesn't require Kubernetes.
struct MockOrchestrator;

#[async_trait::async_trait]
impl Orchestrator for MockOrchestrator {
    async fn provision_head(
        &self,
        head_id: Uuid,
        participant_count: u32,
        _network: Network,
        _config: &HeadConfig,
    ) -> Result<HeadDeployment, HydraHouseError> {
        let nodes = (0..participant_count)
            .map(|i| ProvisionedNode {
                pod_name: format!("mock-pod-{i}"),
                service_name: format!("mock-svc-{i}"),
                api_port: 4001,
                peer_port: 5001,
                cardano_address: format!("addr_test_mock_{i}"),
                keys_secret_ref: format!("mock-secret-{i}"),
            })
            .collect();

        Ok(HeadDeployment { head_id, nodes })
    }

    async fn teardown_head(&self, _head_id: Uuid, _node_count: u32) -> Result<(), HydraHouseError> {
        Ok(())
    }

    async fn get_node_ws_url(&self, head_id: Uuid, node_index: u32) -> Result<String, HydraHouseError> {
        Ok(format!("ws://mock-{head_id}-{node_index}:4001"))
    }
}

fn test_config() -> AppConfig {
    AppConfig {
        database_url: std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://hydrahouse:hydrahouse@localhost:5432/hydrahouse".into()),
        listen_addr: "0.0.0.0:0".into(),
        ws_base_url: "ws://test:3000".into(),
        mode: hh_core::config::OrchestratorMode::Docker,
        k8s_namespace: "test".into(),
        data_dir: "/tmp/hh-test".into(),
        blockfrost_project_id: "test-project".into(),
        hydra_scripts_tx_id: "test-scripts-tx".into(),
        hydra_node_image: "test-image:latest".into(),
    }
}

async fn setup_app() -> Option<(Router, Arc<AppState>)> {
    let config = test_config();
    let pool = match tokio::time::timeout(
        std::time::Duration::from_secs(3),
        hh_db::connect(&config.database_url),
    )
    .await
    {
        Ok(Ok(pool)) => pool,
        _ => {
            eprintln!("SKIP: Postgres not available, skipping integration test");
            return None;
        }
    };

    if let Err(e) = hh_db::run_migrations(&pool).await {
        eprintln!("SKIP: Migration failed ({e}), skipping integration test");
        return None;
    }

    // Create a test account
    let api_key = "hh_sk_test_key_12345";
    let key_hash = hh_api::auth::hash_api_key(api_key);
    let _ = hh_db::repo::accounts::create(&pool, Some("test@test.com"), &key_hash).await;

    let state = AppState::new(pool, config, Box::new(MockOrchestrator));

    let authed_routes = Router::new()
        .route("/v1/heads", post(heads::create_head))
        .route("/v1/heads", get(heads::list_heads))
        .route("/v1/heads/{id}", get(heads::get_head))
        .route("/v1/heads/{id}/close", post(heads::close_head))
        .route("/v1/heads/{id}", delete(heads::abort_head))
        .layer(middleware::from_fn_with_state(state.clone(), auth::require_auth));

    let app = Router::new()
        .route("/healthz", get(health::healthz))
        .merge(authed_routes)
        .with_state(state.clone());

    Some((app, state))
}

#[tokio::test]
async fn test_health_check() {
    let Some((app, _)) = setup_app().await else { return };

    let resp = app
        .oneshot(Request::builder().uri("/healthz").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_unauthorized_without_key() {
    let Some((app, _)) = setup_app().await else { return };

    let resp = app
        .oneshot(
            Request::builder()
                .uri("/v1/heads")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_create_and_get_head() {
    let Some((app, _)) = setup_app().await else { return };

    let create_req = Request::builder()
        .uri("/v1/heads")
        .method("POST")
        .header("Content-Type", "application/json")
        .header("Authorization", "Bearer hh_sk_test_key_12345")
        .body(Body::from(
            serde_json::to_string(&serde_json::json!({
                "network": "preprod",
                "participants": 2
            }))
            .unwrap(),
        ))
        .unwrap();

    let resp = app.clone().oneshot(create_req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    let head_id = json["head_id"].as_str().unwrap();
    assert_eq!(json["status"], "provisioning");
    assert_eq!(json["network"], "preprod");
    assert_eq!(json["participant_count"], 2);
    assert!(json["ws_url"].as_str().unwrap().contains(head_id));

    // Give background provisioning a moment
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    let get_req = Request::builder()
        .uri(&format!("/v1/heads/{}", head_id))
        .method("GET")
        .header("Authorization", "Bearer hh_sk_test_key_12345")
        .body(Body::empty())
        .unwrap();

    let resp = app.clone().oneshot(get_req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["head_id"], head_id);
    assert!(json["participants"].as_array().unwrap().len() == 2);
}

#[tokio::test]
async fn test_list_heads() {
    let Some((app, _)) = setup_app().await else { return };

    let req = Request::builder()
        .uri("/v1/heads")
        .method("GET")
        .header("Authorization", "Bearer hh_sk_test_key_12345")
        .body(Body::empty())
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json["heads"].as_array().is_some());
}

#[tokio::test]
async fn test_create_head_invalid_participants() {
    let Some((app, _)) = setup_app().await else { return };

    let req = Request::builder()
        .uri("/v1/heads")
        .method("POST")
        .header("Content-Type", "application/json")
        .header("Authorization", "Bearer hh_sk_test_key_12345")
        .body(Body::from(
            serde_json::to_string(&serde_json::json!({
                "network": "preprod",
                "participants": 0
            }))
            .unwrap(),
        ))
        .unwrap();

    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}
