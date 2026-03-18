use std::collections::HashMap;

use serde::Deserialize;

use crate::network::Network;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub database_url: String,

    #[serde(default = "default_listen_addr")]
    pub listen_addr: String,

    #[serde(default = "default_ws_base_url")]
    pub ws_base_url: String,

    #[serde(default = "default_data_dir")]
    pub data_dir: String,

    /// Per-network Blockfrost project IDs.
    #[serde(default)]
    pub blockfrost_project_ids: HashMap<Network, String>,

    #[serde(default = "default_hydra_node_image")]
    pub hydra_node_image: String,

    /// Per-network platform wallet signing keys (cborHex) for auto-funding node addresses.
    /// Networks without a key will require manual funding.
    #[serde(default)]
    pub platform_wallet_sks: HashMap<Network, String>,

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

    /// Railway API token. If set, Railway orchestrator is used instead of Docker.
    #[serde(default)]
    pub railway_api_token: String,

    /// Railway project ID for deploying hydra-node services.
    #[serde(default)]
    pub railway_project_id: String,

    /// Railway environment ID for deploying hydra-node services.
    #[serde(default)]
    pub railway_environment_id: String,

    /// WebAuthn Relying Party ID (e.g. "hydrahouse.io"). If empty, passkey auth is disabled.
    #[serde(default)]
    pub webauthn_rp_id: String,

    /// WebAuthn Relying Party origin (e.g. "https://hydrahouse.io"). Must match RP ID.
    #[serde(default)]
    pub webauthn_rp_origin: String,
}

fn default_listen_addr() -> String {
    "0.0.0.0:3000".into()
}

fn default_ws_base_url() -> String {
    "ws://localhost:3000".into()
}

fn default_data_dir() -> String {
    ".hydrahouse-data".into()
}

fn default_hydra_node_image() -> String {
    "ghcr.io/cardano-scaling/hydra-node:1.2.0".into()
}

/// Read per-network env vars with `_PREPROD`, `_PREVIEW`, `_MAINNET` suffixes.
fn read_per_network_env(prefix: &str) -> HashMap<Network, String> {
    let mut map = HashMap::new();
    for (suffix, network) in [
        ("_PREPROD", Network::Preprod),
        ("_PREVIEW", Network::Preview),
        ("_MAINNET", Network::Mainnet),
    ] {
        if let Ok(val) = std::env::var(format!("{prefix}{suffix}")) {
            if !val.is_empty() {
                map.insert(network, val);
            }
        }
    }
    map
}

impl AppConfig {
    pub fn blockfrost_project_id(&self, network: Network) -> Option<&str> {
        self.blockfrost_project_ids.get(&network).map(|s| s.as_str())
    }

    pub fn platform_wallet_sk(&self, network: Network) -> Option<&str> {
        self.platform_wallet_sks.get(&network).map(|s| s.as_str())
    }

    /// Returns the list of networks that have both a Blockfrost project ID and a platform wallet SK configured.
    pub fn configured_networks(&self) -> Vec<Network> {
        [Network::Preprod, Network::Preview, Network::Mainnet]
            .into_iter()
            .filter(|n| self.blockfrost_project_ids.contains_key(n))
            .collect()
    }

    pub fn from_env() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            listen_addr: std::env::var("HH_LISTEN_ADDR")
                .unwrap_or_else(|_| default_listen_addr()),
            ws_base_url: std::env::var("HH_WS_BASE_URL")
                .unwrap_or_else(|_| default_ws_base_url()),
            data_dir: std::env::var("HH_DATA_DIR")
                .unwrap_or_else(|_| default_data_dir()),
            blockfrost_project_ids: read_per_network_env("HH_BLOCKFROST_PROJECT_ID"),
            hydra_node_image: std::env::var("HH_HYDRA_NODE_IMAGE")
                .unwrap_or_else(|_| default_hydra_node_image()),
            platform_wallet_sks: read_per_network_env("HH_PLATFORM_WALLET_SK"),
            stripe_secret_key: std::env::var("STRIPE_SECRET_KEY").unwrap_or_default(),
            stripe_webhook_secret: std::env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default(),
            cost_head_open_cents: 500,
            cost_api_request_cents: 1,
            google_client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
            cors_origins: std::env::var("HH_CORS_ORIGINS")
                .ok()
                .map(|s| s.split(',').map(|o| o.trim().to_string()).filter(|o| !o.is_empty()).collect())
                .unwrap_or_default(),
            railway_api_token: std::env::var("RAILWAY_API_TOKEN").unwrap_or_default(),
            railway_project_id: std::env::var("RAILWAY_PROJECT_ID").unwrap_or_default(),
            railway_environment_id: std::env::var("RAILWAY_ENVIRONMENT_ID").unwrap_or_default(),
            webauthn_rp_id: std::env::var("WEBAUTHN_RP_ID").unwrap_or_default(),
            webauthn_rp_origin: std::env::var("WEBAUTHN_RP_ORIGIN").unwrap_or_default(),
        }
    }
}
