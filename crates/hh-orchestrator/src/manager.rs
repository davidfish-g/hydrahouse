use hh_core::head::HeadConfig;
use hh_core::network::Network;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ProvisionedNode {
    pub pod_name: String,
    pub service_name: String,
    pub api_port: u16,
    pub peer_port: u16,
    pub cardano_address: String,
    pub keys_secret_ref: String,
}

#[derive(Debug, Clone)]
pub struct HeadDeployment {
    pub head_id: Uuid,
    pub nodes: Vec<ProvisionedNode>,
}

#[async_trait::async_trait]
pub trait Orchestrator: Send + Sync {
    async fn provision_head(
        &self,
        head_id: Uuid,
        participant_count: u32,
        network: Network,
        config: &HeadConfig,
    ) -> Result<HeadDeployment, hh_core::error::HydraHouseError>;

    async fn teardown_head(
        &self,
        head_id: Uuid,
        node_count: u32,
    ) -> Result<(), hh_core::error::HydraHouseError>;

    async fn get_node_ws_url(
        &self,
        head_id: Uuid,
        node_index: u32,
    ) -> Result<String, hh_core::error::HydraHouseError>;
}
