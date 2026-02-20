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
        }
    }
}
