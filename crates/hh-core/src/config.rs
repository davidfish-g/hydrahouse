use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrchestratorMode {
    Docker,
    Kubernetes,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub database_url: String,

    #[serde(default = "default_listen_addr")]
    pub listen_addr: String,

    #[serde(default = "default_ws_base_url")]
    pub ws_base_url: String,

    #[serde(default = "default_mode")]
    pub mode: OrchestratorMode,

    #[serde(default = "default_k8s_namespace")]
    pub k8s_namespace: String,

    #[serde(default = "default_data_dir")]
    pub data_dir: String,

    #[serde(default)]
    pub blockfrost_project_id: String,

    #[serde(default = "default_hydra_node_image")]
    pub hydra_node_image: String,

    /// Platform wallet signing key cborHex (e.g. "5820abcd...") for auto-funding node addresses.
    /// If empty, auto-funding is disabled and nodes must be funded manually.
    #[serde(default)]
    pub platform_wallet_sk: String,

    /// Stripe secret key (sk_...). If empty, billing is disabled.
    #[serde(default)]
    pub stripe_secret_key: String,

    /// Stripe webhook signing secret (whsec_...). Required for webhook verification.
    #[serde(default)]
    pub stripe_webhook_secret: String,

    /// Cost in cents to open a head ($5.00).
    pub cost_head_open_cents: i64,

    /// Cost in cents per API request ($0.01).
    pub cost_api_request_cents: i64,

    /// Google OAuth Client ID. If empty, Google auth is disabled.
    #[serde(default)]
    pub google_client_id: String,

    /// Comma-separated list of allowed CORS origins. Falls back to localhost for dev.
    #[serde(default)]
    pub cors_origins: Vec<String>,
}

fn default_listen_addr() -> String {
    "0.0.0.0:3000".into()
}

fn default_ws_base_url() -> String {
    "ws://localhost:3000".into()
}

fn default_mode() -> OrchestratorMode {
    OrchestratorMode::Docker
}

fn default_k8s_namespace() -> String {
    "hydrahouse".into()
}

fn default_data_dir() -> String {
    ".hydrahouse-data".into()
}

fn default_hydra_node_image() -> String {
    "ghcr.io/cardano-scaling/hydra-node:1.2.0".into()
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            listen_addr: std::env::var("HH_LISTEN_ADDR")
                .unwrap_or_else(|_| default_listen_addr()),
            ws_base_url: std::env::var("HH_WS_BASE_URL")
                .unwrap_or_else(|_| default_ws_base_url()),
            mode: std::env::var("HH_MODE")
                .ok()
                .and_then(|m| match m.to_lowercase().as_str() {
                    "docker" => Some(OrchestratorMode::Docker),
                    "kubernetes" | "k8s" => Some(OrchestratorMode::Kubernetes),
                    _ => None,
                })
                .unwrap_or_else(default_mode),
            k8s_namespace: std::env::var("HH_K8S_NAMESPACE")
                .unwrap_or_else(|_| default_k8s_namespace()),
            data_dir: std::env::var("HH_DATA_DIR")
                .unwrap_or_else(|_| default_data_dir()),
            blockfrost_project_id: std::env::var("HH_BLOCKFROST_PROJECT_ID")
                .unwrap_or_default(),
            hydra_node_image: std::env::var("HH_HYDRA_NODE_IMAGE")
                .unwrap_or_else(|_| default_hydra_node_image()),
            platform_wallet_sk: std::env::var("HH_PLATFORM_WALLET_SK")
                .unwrap_or_default(),
            stripe_secret_key: std::env::var("STRIPE_SECRET_KEY").unwrap_or_default(),
            stripe_webhook_secret: std::env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default(),
            cost_head_open_cents: 500,
            cost_api_request_cents: 1,
            google_client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
            cors_origins: std::env::var("HH_CORS_ORIGINS")
                .ok()
                .map(|s| s.split(',').map(|o| o.trim().to_string()).filter(|o| !o.is_empty()).collect())
                .unwrap_or_default(),
        }
    }
}
