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

pub struct K8sOrchestrator {
    pub client: kube::Client,
    pub namespace: String,
    pub blockfrost_project_id: String,
    pub hydra_scripts_tx_id: String,
    pub hydra_node_image: String,
}

#[async_trait::async_trait]
impl Orchestrator for K8sOrchestrator {
    async fn provision_head(
        &self,
        head_id: Uuid,
        participant_count: u32,
        network: Network,
        config: &HeadConfig,
    ) -> Result<HeadDeployment, hh_core::error::HydraHouseError> {
        let err = |e: anyhow::Error| hh_core::error::HydraHouseError::Orchestration(e.to_string());

        // 1. Generate all key pairs upfront
        let cardano_keys: Vec<_> = (0..participant_count)
            .map(|_| hh_keys::cardano::generate_key_pair())
            .collect();
        let hydra_keys: Vec<_> = (0..participant_count)
            .map(|_| hh_keys::hydra::generate_key_pair())
            .collect();

        // 2. Create Blockfrost secret (shared across all nodes in this head)
        let bf_secret =
            super::secrets::build_blockfrost_secret(head_id, &self.blockfrost_project_id);
        super::secrets::create_secret(&self.client, &self.namespace, &bf_secret)
            .await
            .map_err(err)?;

        let bf_secret_name = super::secrets::blockfrost_secret_name(head_id);

        // 3. For each participant, create key secret, pod, and service
        let mut nodes = Vec::new();

        for i in 0..participant_count {
            let pod_name = super::pods::pod_name(head_id, i);
            let svc_name = super::pods::service_name(head_id, i);

            // Collect peer verification keys (everyone except self)
            let cardano_peer_vks: Vec<String> = cardano_keys
                .iter()
                .enumerate()
                .filter(|(j, _)| *j as u32 != i)
                .map(|(_, kp)| serde_json::to_string(&kp.verification_key).unwrap())
                .collect();

            let hydra_peer_vks: Vec<String> = hydra_keys
                .iter()
                .enumerate()
                .filter(|(j, _)| *j as u32 != i)
                .map(|(_, kp)| serde_json::to_string(&kp.verification_key).unwrap())
                .collect();

            let cardano_sk_json =
                serde_json::to_string(&cardano_keys[i as usize].signing_key).unwrap();
            let hydra_sk_json =
                serde_json::to_string(&hydra_keys[i as usize].signing_key).unwrap();

            let keys_secret = super::secrets::build_keys_secret(
                head_id,
                i,
                &cardano_sk_json,
                &cardano_peer_vks,
                &hydra_sk_json,
                &hydra_peer_vks,
            );
            let keys_secret_name = super::secrets::secret_name(head_id, i);

            super::secrets::create_secret(&self.client, &self.namespace, &keys_secret)
                .await
                .map_err(err)?;

            // Build hydra-node CLI arguments
            let mut peer_addrs = Vec::new();
            for j in 0..participant_count {
                if j != i {
                    let peer_svc = super::pods::service_name(head_id, j);
                    peer_addrs.push(format!(
                        "{peer_svc}.{ns}.svc.cluster.local:5001",
                        ns = self.namespace
                    ));
                }
            }

            let mut args = vec![
                format!("--node-id={pod_name}"),
                "--api-host=0.0.0.0".into(),
                "--api-port=4001".into(),
                format!(
                    "--listen={svc_name}.{ns}.svc.cluster.local:5001",
                    ns = self.namespace
                ),
                "--monitoring-port=6001".into(),
                "--blockfrost=/blockfrost/blockfrost-project.txt".into(),
                format!("--cardano-signing-key=/keys/cardano.sk"),
                format!("--hydra-signing-key=/keys/hydra.sk"),
            ];

            // Add peer verification keys
            for p in 0..cardano_peer_vks.len() {
                args.push(format!("--cardano-verification-key=/keys/cardano-peer-{p}.vk"));
            }
            for p in 0..hydra_peer_vks.len() {
                args.push(format!("--hydra-verification-key=/keys/hydra-peer-{p}.vk"));
            }

            for peer in &peer_addrs {
                args.push(format!("--peer={peer}"));
            }

            if let Some(magic) = network.testnet_magic() {
                args.push(format!("--testnet-magic={magic}"));
            } else {
                args.push("--mainnet".into());
            }

            args.push(format!(
                "--contestation-period={}s",
                config.contestation_period_secs
            ));

            if !self.hydra_scripts_tx_id.is_empty() {
                args.push(format!(
                    "--hydra-scripts-tx-id={}",
                    self.hydra_scripts_tx_id
                ));
            } else {
                args.push(format!("--network={}", network));
            }

            let pod = super::pods::build_pod(
                head_id,
                i,
                &self.hydra_node_image,
                args,
                &keys_secret_name,
                &bf_secret_name,
            );
            let svc = super::pods::build_service(head_id, i);

            super::pods::create_pod(&self.client, &self.namespace, &pod)
                .await
                .map_err(err)?;
            super::pods::create_service(&self.client, &self.namespace, &svc)
                .await
                .map_err(err)?;

            // Derive a placeholder address from the VK cbor hex
            let cardano_addr = format!(
                "addr_hydrahouse_{}_{i}",
                &head_id.as_simple().to_string()[..8]
            );

            nodes.push(ProvisionedNode {
                pod_name,
                service_name: svc_name,
                api_port: 4001,
                peer_port: 5001,
                cardano_address: cardano_addr,
                keys_secret_ref: keys_secret_name,
            });
        }

        tracing::info!(%head_id, participant_count, "provisioned head");
        Ok(HeadDeployment { head_id, nodes })
    }

    async fn teardown_head(
        &self,
        head_id: Uuid,
        node_count: u32,
    ) -> Result<(), hh_core::error::HydraHouseError> {
        super::pods::delete_head_resources(&self.client, &self.namespace, head_id, node_count)
            .await
            .map_err(|e| hh_core::error::HydraHouseError::Orchestration(e.to_string()))?;
        Ok(())
    }

    async fn get_node_ws_url(
        &self,
        head_id: Uuid,
        node_index: u32,
    ) -> Result<String, hh_core::error::HydraHouseError> {
        let svc_name = super::pods::service_name(head_id, node_index);
        Ok(format!(
            "ws://{svc_name}.{ns}.svc.cluster.local:4001",
            ns = self.namespace
        ))
    }
}
