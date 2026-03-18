use axum::middleware;
use axum::routing::{delete, get, patch, post};
use axum::Router;
use tower_http::cors::CorsLayer;
use tracing_subscriber::EnvFilter;

use hh_api::auth;
use hh_api::billing;
use hh_api::handlers::{accounts, api_keys, auth_google, auth_link, auth_passkey, heads, health, transactions};
use hh_api::openapi;
use hh_api::state::AppState;
use hh_api::ws;
use hh_core::config::AppConfig;
use hh_orchestrator::docker::DockerOrchestrator;
use hh_orchestrator::manager::Orchestrator;
use hh_orchestrator::railway::RailwayOrchestrator;

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

    let configured_networks = config.configured_networks();
    if configured_networks.is_empty() {
        tracing::warn!("no networks have a Blockfrost project ID configured — head creation will fail");
    } else {
        tracing::info!(networks = ?configured_networks, "network support enabled");
    }

    let orchestrator: Box<dyn Orchestrator> = if !config.railway_api_token.is_empty() {
        tracing::info!("using Railway orchestrator");
        Box::new(RailwayOrchestrator::new(
            config.railway_api_token.clone(),
            config.railway_project_id.clone(),
            config.railway_environment_id.clone(),
            config.hydra_node_image.clone(),
            config.blockfrost_project_ids.clone(),
            config.platform_wallet_sks.clone(),
        ))
    } else {
        tracing::info!(data_dir = %config.data_dir, image = %config.hydra_node_image, "using Docker orchestrator (local dev)");
        Box::new(DockerOrchestrator::new(
            config.data_dir.clone().into(),
            config.hydra_node_image.clone(),
            config.blockfrost_project_ids.clone(),
            config.platform_wallet_sks.clone(),
        ))
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

    // Periodic cleanup of expired sessions
    {
        let cleanup_pool = state.db.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(6 * 3600));
            interval.tick().await; // skip immediate first tick
            loop {
                interval.tick().await;
                if let Err(e) = hh_db::repo::sessions::delete_expired(&cleanup_pool).await {
                    tracing::warn!(error = %e, "failed to clean up expired sessions");
                }
                if let Err(e) = hh_db::repo::auth_challenges::delete_expired(&cleanup_pool).await {
                    tracing::warn!(error = %e, "failed to clean up expired auth challenges");
                }
            }
        });
    }

    let authed_routes = Router::new()
        .route("/v1/heads", post(heads::create_head))
        .route("/v1/heads", get(heads::list_heads))
        .route("/v1/heads/{id}", get(heads::get_head))
        .route("/v1/heads/{id}/close", post(heads::close_head))
        .route("/v1/heads/{id}/deposit", post(transactions::deposit))
        .route("/v1/heads/{id}/decommit", post(transactions::decommit))
        .route("/v1/heads/{id}/events", get(heads::get_head_events))
        .route("/v1/heads/{id}", delete(heads::abort_head))
        .route("/v1/heads/{id}/tx", post(transactions::submit_tx))
        .route("/v1/heads/{id}/transfer", post(transactions::transfer))
        .route("/v1/heads/{id}/snapshot", get(transactions::get_snapshot))
        .route("/v1/account", get(accounts::get_account).delete(accounts::delete_account))
        .route("/v1/account/username", patch(accounts::update_username))
        .route("/v1/account/usage", get(accounts::get_usage))
        .route("/v1/account/keys", post(api_keys::create_api_key))
        .route("/v1/account/keys", get(api_keys::list_api_keys))
        .route("/v1/account/keys/{id}", delete(api_keys::delete_api_key))
        .route("/v1/billing/topup", post(billing::create_topup))
        .route("/v1/account/balance/history", get(billing::get_balance_history))
        // Auth method management (requires login) — under /v1/account/auth to avoid
        // path conflicts with the public /v1/auth routes during router merge.
        .route("/v1/account/auth/passkey/register/begin", post(auth_passkey::register_begin))
        .route("/v1/account/auth/passkey/register/complete", post(auth_passkey::register_complete))
        .route("/v1/account/auth/passkey/{id}", delete(auth_link::unlink_passkey))
        .route("/v1/account/auth/google", delete(auth_link::unlink_google))
        .route("/v1/account/auth/google/link", post(auth_link::link_google))
        .route("/v1/account/auth/methods", get(auth_link::list_auth_methods))
        .layer(middleware::from_fn_with_state(state.clone(), auth::require_auth));

    let rate_limiter = hh_api::ratelimit::RateLimiter::new(500);

    let origins: Vec<axum::http::HeaderValue> = if config.cors_origins.is_empty() {
        tracing::info!("HH_CORS_ORIGINS not set, allowing localhost origins (dev mode)");
        vec![
            "http://localhost:5173".parse().unwrap(),
            "http://localhost:3000".parse().unwrap(),
        ]
    } else {
        let mut parsed = Vec::new();
        for origin in &config.cors_origins {
            match origin.parse() {
                Ok(v) => parsed.push(v),
                Err(_) => {
                    tracing::error!(origin = %origin, "invalid CORS origin, skipping");
                }
            }
        }
        if parsed.is_empty() {
            tracing::error!("HH_CORS_ORIGINS set but all origins invalid, falling back to localhost");
            vec![
                "http://localhost:5173".parse().unwrap(),
                "http://localhost:3000".parse().unwrap(),
            ]
        } else {
            parsed
        }
    };

    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
        ]);

    let app = Router::new()
        .route("/healthz", get(health::healthz))
        .route("/api-docs", get(openapi::openapi_spec))
        .route("/v1/accounts", post(accounts::create_account))
        .route("/v1/auth/google", post(auth_google::google_auth))
        .route("/v1/auth/logout", post(auth_google::logout))
        // Passkey (unauthenticated)
        .route("/v1/auth/passkey/login/begin", post(auth_passkey::login_begin))
        .route("/v1/auth/passkey/login/complete", post(auth_passkey::login_complete))
        .route("/v1/auth/passkey/signup/begin", post(auth_passkey::signup_begin))
        .route("/v1/auth/passkey/signup/complete", post(auth_passkey::signup_complete))
        .route("/v1/heads/{id}/ws", get(ws::ws_proxy))
        .route("/v1/webhooks/stripe", post(billing::stripe_webhook))
        .merge(authed_routes)
        .with_state(state)
        .layer(axum::Extension(rate_limiter))
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!(listen_addr = %config.listen_addr, "HydraHouse API server starting");
    axum::serve(listener, app).await?;

    Ok(())
}
