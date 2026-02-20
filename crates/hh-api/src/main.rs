use axum::middleware;
use axum::routing::{delete, get, post};
use axum::Router;
use tracing_subscriber::EnvFilter;

use hh_api::auth;
use hh_api::handlers::{accounts, heads, health, transactions};
use hh_api::openapi;
use hh_api::state::AppState;
use hh_api::ws;
use hh_core::config::{AppConfig, OrchestratorMode};
use hh_orchestrator::docker::DockerOrchestrator;
use hh_orchestrator::manager::{K8sOrchestrator, Orchestrator};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("hh_api=debug".parse()?)
                .add_directive("hh_orchestrator=debug".parse()?),
        )
        .init();

    let config = AppConfig::from_env();

    tracing::info!("connecting to database...");
    let pool = hh_db::connect(&config.database_url).await?;

    tracing::info!("running migrations...");
    hh_db::run_migrations(&pool).await?;

    let orchestrator: Box<dyn Orchestrator> = match config.mode {
        OrchestratorMode::Docker => {
            tracing::info!(data_dir = %config.data_dir, image = %config.hydra_node_image, "using Docker orchestrator");
            Box::new(DockerOrchestrator::new(
                config.data_dir.clone().into(),
                config.hydra_node_image.clone(),
                config.blockfrost_project_id.clone(),
            ))
        }
        OrchestratorMode::Kubernetes => {
            tracing::info!(namespace = %config.k8s_namespace, "using Kubernetes orchestrator");
            let k8s_client = kube::Client::try_default().await?;
            Box::new(K8sOrchestrator {
                client: k8s_client,
                namespace: config.k8s_namespace.clone(),
                blockfrost_project_id: config.blockfrost_project_id.clone(),
                hydra_scripts_tx_id: config.hydra_scripts_tx_id.clone(),
                hydra_node_image: config.hydra_node_image.clone(),
            })
        }
    };

    let state = AppState::new(pool, config.clone(), orchestrator);

    // Respawn lifecycle monitors for any heads that were active before restart
    let active_heads = hh_db::repo::heads::find_active(&state.db).await?;
    if !active_heads.is_empty() {
        tracing::info!(count = active_heads.len(), "reconnecting lifecycle monitors for active heads");
        for head in &active_heads {
            tracing::info!(head_id = %head.id, status = %head.status, "respawning lifecycle monitor");
            hh_api::lifecycle::spawn_lifecycle_monitor(state.clone(), head.id, 0);
        }
    }

    let authed_routes = Router::new()
        .route("/v1/heads", post(heads::create_head))
        .route("/v1/heads", get(heads::list_heads))
        .route("/v1/heads/{id}", get(heads::get_head))
        .route("/v1/heads/{id}/close", post(heads::close_head))
        .route("/v1/heads/{id}", delete(heads::abort_head))
        .route("/v1/heads/{id}/tx", post(transactions::submit_tx))
        .route("/v1/heads/{id}/snapshot", get(transactions::get_snapshot))
        .layer(middleware::from_fn_with_state(state.clone(), auth::require_auth));

    let app = Router::new()
        .route("/healthz", get(health::healthz))
        .route("/api-docs", get(openapi::openapi_spec))
        .route("/v1/accounts", post(accounts::create_account))
        .route("/v1/heads/{id}/ws", get(ws::ws_proxy))
        .merge(authed_routes)
        .with_state(state)
        .layer(tower_http::cors::CorsLayer::permissive())
        .layer(tower_http::trace::TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!(listen_addr = %config.listen_addr, mode = ?config.mode, "HydraHouse API server starting");
    axum::serve(listener, app).await?;

    Ok(())
}
