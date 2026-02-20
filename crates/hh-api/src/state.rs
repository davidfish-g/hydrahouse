use hh_core::config::AppConfig;
use hh_orchestrator::manager::Orchestrator;
use sqlx::PgPool;
use std::sync::Arc;

pub struct AppState {
    pub db: PgPool,
    pub config: AppConfig,
    pub orchestrator: Box<dyn Orchestrator>,
}

impl AppState {
    pub fn new(db: PgPool, config: AppConfig, orchestrator: Box<dyn Orchestrator>) -> Arc<Self> {
        Arc::new(Self {
            db,
            config,
            orchestrator,
        })
    }
}
