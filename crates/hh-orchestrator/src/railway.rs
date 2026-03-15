use std::collections::HashMap;

use hh_core::error::HydraHouseError;
use hh_core::head::HeadConfig;
use hh_core::network::Network;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::manager::{HeadDeployment, Orchestrator, ProvisionedNode};

/// Railway-based orchestrator for production deployment.
/// Creates hydra-node services via Railway's GraphQL API.
pub struct RailwayOrchestrator {
    client: reqwest::Client,
    api_token: String,
    project_id: String,
    environment_id: String,
    hydra_node_image: String,
    blockfrost_project_ids: HashMap<Network, String>,
    platform_wallet_sks: HashMap<Network, String>,
    #[allow(dead_code)]
    encryption_key: Option<[u8; 32]>,
}

const RAILWAY_GQL_URL: &str = "https://backboard.railway.com/graphql/v2";

impl RailwayOrchestrator {
    pub fn new(
        api_token: String,
        project_id: String,
        environment_id: String,
        hydra_node_image: String,
        blockfrost_project_ids: HashMap<Network, String>,
        platform_wallet_sks: HashMap<Network, String>,
    ) -> Self {
        let encryption_key = crate::encrypt::encryption_key_from_env();
        if encryption_key.is_some() {
            tracing::info!("key-file encryption enabled (HH_ENCRYPTION_KEY set)");
        }

        Self {
            client: reqwest::Client::new(),
            api_token,
            project_id,
            environment_id,
            hydra_node_image,
            blockfrost_project_ids,
            platform_wallet_sks,
            encryption_key,
        }
    }

    fn service_name(head_id: Uuid, node_index: u32) -> String {
        let short = &head_id.to_string()[..8];
        format!("hh-{short}-node-{node_index}")
    }

    /// Execute a GraphQL query/mutation against the Railway API.
    async fn gql<T: for<'de> Deserialize<'de>>(
        &self,
        query: &str,
        variables: Value,
    ) -> Result<T, HydraHouseError> {
        let body = serde_json::json!({
            "query": query,
            "variables": variables,
        });

        let resp = self
            .client
            .post(RAILWAY_GQL_URL)
            .bearer_auth(&self.api_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| HydraHouseError::Orchestration(format!("Railway API request failed: {e}")))?;

        let status = resp.status();
        let text = resp
            .text()
            .await
            .map_err(|e| HydraHouseError::Orchestration(format!("Railway API read body: {e}")))?;

        if !status.is_success() {
            return Err(HydraHouseError::Orchestration(format!(
                "Railway API error ({status}): {text}"
            )));
        }

        let gql_resp: GqlResponse<T> = serde_json::from_str(&text).map_err(|e| {
            HydraHouseError::Orchestration(format!("Railway API parse response: {e} — body: {text}"))
        })?;

        if let Some(errors) = gql_resp.errors {
            if !errors.is_empty() {
                let msgs: Vec<String> = errors.into_iter().map(|e| e.message).collect();
                return Err(HydraHouseError::Orchestration(format!(
                    "Railway API errors: {}",
                    msgs.join("; ")
                )));
            }
        }

        gql_resp.data.ok_or_else(|| {
            HydraHouseError::Orchestration("Railway API returned no data".into())
        })
    }

    /// Create a Railway service and return its ID.
    async fn create_service(&self, name: &str) -> Result<String, HydraHouseError> {
        let query = r#"
            mutation ServiceCreate($input: ServiceCreateInput!) {
                serviceCreate(input: $input) {
                    id
                }
            }
        "#;

        let variables = serde_json::json!({
            "input": {
                "name": name,
                "projectId": self.project_id,
            }
        });

        let data: ServiceCreateData = self.gql(query, variables).await?;
        Ok(data.service_create.id)
    }

    /// Set environment variables on a Railway service.
    async fn set_variables(
        &self,
        service_id: &str,
        variables: HashMap<String, String>,
    ) -> Result<(), HydraHouseError> {
        let query = r#"
            mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
                variableCollectionUpsert(input: $input)
            }
        "#;

        let gql_variables = serde_json::json!({
            "input": {
                "projectId": self.project_id,
                "environmentId": self.environment_id,
                "serviceId": service_id,
                "variables": variables,
            }
        });

        let _: VariableUpsertData = self.gql(query, gql_variables).await?;
        Ok(())
    }

    /// Set the source image on a Railway service and trigger a deploy.
    async fn deploy_service(&self, service_id: &str) -> Result<(), HydraHouseError> {
        // Set the source image
        let query = r#"
            mutation ServiceInstanceUpdate($serviceId: String!, $input: ServiceInstanceUpdateInput!) {
                serviceInstanceUpdate(serviceId: $serviceId, input: $input)
            }
        "#;

        let variables = serde_json::json!({
            "serviceId": service_id,
            "input": {
                "source": {
                    "image": self.hydra_node_image,
                },
            }
        });

        let _: ServiceInstanceUpdateData = self.gql(query, variables).await?;

        // Trigger deploy
        let deploy_query = r#"
            mutation ServiceInstanceDeploy($serviceId: String!, $environmentId: String!) {
                serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
            }
        "#;

        let deploy_variables = serde_json::json!({
            "serviceId": service_id,
            "environmentId": self.environment_id,
        });

        let _: ServiceInstanceDeployData = self.gql(deploy_query, deploy_variables).await?;
        Ok(())
    }

    /// Delete a Railway service by ID.
    async fn delete_service(&self, service_id: &str) -> Result<(), HydraHouseError> {
        let query = r#"
            mutation ServiceDelete($id: String!) {
                serviceDelete(id: $id)
            }
        "#;

        let variables = serde_json::json!({ "id": service_id });
        let _: ServiceDeleteData = self.gql(query, variables).await?;
        Ok(())
    }

    /// Find Railway services in this project matching a name prefix.
    async fn find_services_by_prefix(
        &self,
        prefix: &str,
    ) -> Result<Vec<RailwayService>, HydraHouseError> {
        let query = r#"
            query Project($id: String!) {
                project(id: $id) {
                    services {
                        edges {
                            node {
                                id
                                name
                            }
                        }
                    }
                }
            }
        "#;

        let variables = serde_json::json!({ "id": self.project_id });
        let data: ProjectData = self.gql(query, variables).await?;

        let services: Vec<RailwayService> = data
            .project
            .services
            .edges
            .into_iter()
            .map(|e| e.node)
            .filter(|s| s.name.starts_with(prefix))
            .collect();

        Ok(services)
    }
}

#[async_trait::async_trait]
impl Orchestrator for RailwayOrchestrator {
    async fn provision_head(
        &self,
        head_id: Uuid,
        participant_count: u32,
        network: Network,
        config: &HeadConfig,
    ) -> Result<HeadDeployment, HydraHouseError> {
        let blockfrost_project_id = self
            .blockfrost_project_ids
            .get(&network)
            .ok_or_else(|| {
                HydraHouseError::Orchestration(format!(
                    "no Blockfrost project ID configured for network {network}"
                ))
            })?;

        // Generate all key pairs upfront
        let cardano_keys: Vec<_> = (0..participant_count)
            .map(|_| hh_keys::cardano::generate_key_pair())
            .collect();
        let hydra_keys: Vec<_> = (0..participant_count)
            .map(|_| hh_keys::hydra::generate_key_pair())
            .collect();

        // Read protocol parameters
        let network_pp_path = format!("config/protocol-parameters-{network}.json");
        let protocol_params_path = if std::path::Path::new(&network_pp_path).exists() {
            network_pp_path
        } else {
            "config/protocol-parameters.json".to_string()
        };
        let protocol_params_content = std::fs::read_to_string(&protocol_params_path).map_err(
            |e| {
                HydraHouseError::Orchestration(format!(
                    "read {protocol_params_path}: {e} (run from the repo root)"
                ))
            },
        )?;

        // Derive addresses and auto-fund
        let is_testnet = network != Network::Mainnet;
        let node_addresses: Vec<String> = cardano_keys
            .iter()
            .map(|kp| {
                hh_keys::bech32::vk_cbor_to_address(&kp.verification_key.cbor_hex, is_testnet)
                    .unwrap_or_else(|e| {
                        tracing::warn!(%head_id, error = %e, "failed to derive address");
                        format!("vk_cbor:{}", kp.verification_key.cbor_hex)
                    })
            })
            .collect();

        if let Some(wallet_sk) = self.platform_wallet_sks.get(&network) {
            tracing::info!(%head_id, %network, "auto-funding node addresses with L1 fuel");

            let funder = crate::funding::BlockfrostFunder::new(
                network,
                blockfrost_project_id,
                wallet_sk,
            )
            .map_err(|e| HydraHouseError::Orchestration(format!("init funder: {e}")))?;

            funder
                .fund_addresses(&node_addresses)
                .await
                .map_err(|e| HydraHouseError::Orchestration(format!("auto-fund: {e}")))?;

            tracing::info!(%head_id, "auto-funding complete");
        } else {
            tracing::warn!(%head_id, %network, "no platform wallet configured — nodes must be funded manually");
        }

        let contestation_secs = config.contestation_period_secs;
        let deposit_period_secs = config.deposit_period_secs;

        let mut nodes = Vec::new();

        for i in 0..participant_count {
            let svc_name = Self::service_name(head_id, i);

            // Collect peer verification keys (all other participants)
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

            // Build hydra-node args
            let mut args: Vec<String> = vec![
                format!("--node-id={svc_name}"),
                "--api-host=0.0.0.0".into(),
                "--api-port=4001".into(),
                "--listen=0.0.0.0:5001".into(),
                format!("--advertise={svc_name}.railway.internal:5001"),
                "--blockfrost=/data/blockfrost.txt".into(),
                format!("--network={network}"),
                "--cardano-signing-key=/data/cardano.sk".into(),
                "--hydra-signing-key=/data/hydra.sk".into(),
                format!("--contestation-period={contestation_secs}s"),
                format!("--deposit-period={deposit_period_secs}s"),
                "--ledger-protocol-parameters=/data/protocol-parameters.json".into(),
                "--persistence-dir=/data/persistence".into(),
            ];

            for p in 0..cardano_peer_vks.len() {
                args.push(format!("--cardano-verification-key=/data/cardano-peer-{p}.vk"));
            }
            for p in 0..hydra_peer_vks.len() {
                args.push(format!("--hydra-verification-key=/data/hydra-peer-{p}.vk"));
            }

            // Add peer addresses (other nodes in Railway internal network)
            for j in 0..participant_count {
                if j != i {
                    let peer_svc = Self::service_name(head_id, j);
                    args.push(format!("--peer={peer_svc}.railway.internal:5001"));
                }
            }

            // 1. Create Railway service
            let service_id = self.create_service(&svc_name).await?;
            tracing::info!(%head_id, %svc_name, %service_id, "created Railway service");

            // 2. Set environment variables
            let mut env_vars = HashMap::new();
            env_vars.insert("CARDANO_SK".into(), cardano_sk_json.clone());
            env_vars.insert("HYDRA_SK".into(), hydra_sk_json.clone());
            env_vars.insert("BLOCKFROST_PROJECT_ID".into(), blockfrost_project_id.clone());
            env_vars.insert("PROTOCOL_PARAMS".into(), protocol_params_content.clone());
            env_vars.insert("HYDRA_NODE_ARGS".into(), args.join(" "));

            for (p, vk) in cardano_peer_vks.iter().enumerate() {
                env_vars.insert(format!("CARDANO_PEER_VK_{p}"), vk.clone());
            }
            for (p, vk) in hydra_peer_vks.iter().enumerate() {
                env_vars.insert(format!("HYDRA_PEER_VK_{p}"), vk.clone());
            }

            self.set_variables(&service_id, env_vars).await?;

            // 3. Deploy (set image + trigger)
            self.deploy_service(&service_id).await?;
            tracing::info!(%head_id, %svc_name, "deployed Railway service");

            let cardano_addr = node_addresses[i as usize].clone();

            nodes.push(ProvisionedNode {
                pod_name: svc_name.clone(),
                service_name: format!("{svc_name}.railway.internal:4001"),
                api_port: 4001,
                peer_port: 5001,
                cardano_address: cardano_addr,
                keys_secret_ref: service_id,
            });
        }

        tracing::info!(%head_id, participant_count, "provisioned head via Railway");
        Ok(HeadDeployment { head_id, nodes })
    }

    async fn teardown_head(
        &self,
        head_id: Uuid,
        node_count: u32,
    ) -> Result<(), HydraHouseError> {
        // Find services matching the head's name pattern
        let short = &head_id.to_string()[..8];
        let prefix = format!("hh-{short}-node-");

        let services = self.find_services_by_prefix(&prefix).await?;

        if services.is_empty() {
            tracing::warn!(%head_id, "no Railway services found for head teardown");
            return Ok(());
        }

        for svc in &services {
            tracing::info!(%head_id, service_name = %svc.name, service_id = %svc.id, "deleting Railway service");
            if let Err(e) = self.delete_service(&svc.id).await {
                tracing::warn!(%head_id, service_name = %svc.name, error = %e, "failed to delete Railway service");
            }
        }

        tracing::info!(%head_id, deleted = services.len(), expected = node_count, "Railway teardown complete");
        Ok(())
    }

    async fn get_node_ws_url(
        &self,
        head_id: Uuid,
        node_index: u32,
    ) -> Result<String, HydraHouseError> {
        let svc_name = Self::service_name(head_id, node_index);
        Ok(format!("ws://{svc_name}.railway.internal:4001"))
    }
}

// --- GraphQL response types ---

#[derive(Deserialize)]
struct GqlResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GqlError>>,
}

#[derive(Deserialize)]
struct GqlError {
    message: String,
}

#[derive(Deserialize)]
struct ServiceCreateData {
    #[serde(rename = "serviceCreate")]
    service_create: ServiceCreateResult,
}

#[derive(Deserialize)]
struct ServiceCreateResult {
    id: String,
}

#[derive(Deserialize)]
struct VariableUpsertData {
    #[serde(rename = "variableCollectionUpsert")]
    #[allow(dead_code)]
    variable_collection_upsert: bool,
}

#[derive(Deserialize)]
struct ServiceInstanceUpdateData {
    #[serde(rename = "serviceInstanceUpdate")]
    #[allow(dead_code)]
    service_instance_update: bool,
}

#[derive(Deserialize)]
struct ServiceInstanceDeployData {
    #[serde(rename = "serviceInstanceDeploy")]
    #[allow(dead_code)]
    service_instance_deploy: bool,
}

#[derive(Deserialize)]
struct ServiceDeleteData {
    #[serde(rename = "serviceDelete")]
    #[allow(dead_code)]
    service_delete: bool,
}

#[derive(Deserialize)]
struct ProjectData {
    project: ProjectServices,
}

#[derive(Deserialize)]
struct ProjectServices {
    services: ServiceConnection,
}

#[derive(Deserialize)]
struct ServiceConnection {
    edges: Vec<ServiceEdge>,
}

#[derive(Deserialize)]
struct ServiceEdge {
    node: RailwayService,
}

#[derive(Deserialize)]
struct RailwayService {
    id: String,
    name: String,
}
