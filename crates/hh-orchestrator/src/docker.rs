use hh_core::error::HydraHouseError;
use hh_core::head::HeadConfig;
use hh_core::network::Network;
use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::manager::{HeadDeployment, Orchestrator, ProvisionedNode};

/// Docker-based orchestrator for local development.
/// Runs hydra-node containers connected to preprod via Blockfrost.
pub struct DockerOrchestrator {
    pub data_dir: PathBuf,
    pub hydra_node_image: String,
    pub blockfrost_project_id: String,
    pub network_name: String,
}

impl DockerOrchestrator {
    pub fn new(
        data_dir: PathBuf,
        hydra_node_image: String,
        blockfrost_project_id: String,
    ) -> Self {
        Self {
            data_dir,
            hydra_node_image,
            blockfrost_project_id,
            network_name: "hydrahouse".into(),
        }
    }

    /// Derive deterministic API base port from head_id (range 20000-59999).
    /// Peer ports start at base + 50.
    fn api_port_for(head_id: Uuid, node_index: u32) -> u16 {
        let bytes = head_id.as_bytes();
        let raw = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        let base = 20000 + (raw % 40000) as u16;
        base + node_index as u16
    }

    fn peer_port_for(head_id: Uuid, node_index: u32) -> u16 {
        Self::api_port_for(head_id, 0) + 50 + node_index as u16
    }

    fn head_dir(&self, head_id: Uuid) -> PathBuf {
        self.data_dir.join(head_id.to_string())
    }

    fn container_name(head_id: Uuid, node_index: u32) -> String {
        format!("hh-{}-node-{}", &head_id.to_string()[..8], node_index)
    }

    fn write_file(dir: &Path, filename: &str, content: &str) -> Result<(), HydraHouseError> {
        std::fs::write(dir.join(filename), content)
            .map_err(|e| HydraHouseError::Orchestration(format!("write {filename}: {e}")))
    }
}

#[async_trait::async_trait]
impl Orchestrator for DockerOrchestrator {
    async fn provision_head(
        &self,
        head_id: Uuid,
        participant_count: u32,
        network: Network,
        config: &HeadConfig,
    ) -> Result<HeadDeployment, HydraHouseError> {
        let head_dir = self.head_dir(head_id);
        std::fs::create_dir_all(&head_dir)
            .map_err(|e| HydraHouseError::Orchestration(format!("mkdir: {e}")))?;

        // Ensure docker network exists
        let _ = tokio::process::Command::new("docker")
            .args(["network", "create", &self.network_name])
            .output()
            .await;

        // Generate all keys upfront
        let cardano_keys: Vec<_> = (0..participant_count)
            .map(|_| hh_keys::cardano::generate_key_pair())
            .collect();
        let hydra_keys: Vec<_> = (0..participant_count)
            .map(|_| hh_keys::hydra::generate_key_pair())
            .collect();

        // Use the official Hydra L2 protocol parameters (zero fees, full cost models)
        let protocol_params_path = std::path::Path::new("config/protocol-parameters.json");
        let protocol_params_content = std::fs::read_to_string(protocol_params_path)
            .map_err(|e| HydraHouseError::Orchestration(format!(
                "read config/protocol-parameters.json: {e} (run from the repo root)"
            )))?;

        let contestation_secs = config.contestation_period_secs;

        let mut nodes = Vec::new();

        for i in 0..participant_count {
            let node_dir = head_dir.join(format!("node-{i}"));
            std::fs::create_dir_all(&node_dir)
                .map_err(|e| HydraHouseError::Orchestration(format!("mkdir node: {e}")))?;

            // Write Blockfrost project ID file
            Self::write_file(&node_dir, "blockfrost.txt", &self.blockfrost_project_id)?;

            // Write this node's signing keys
            Self::write_file(
                &node_dir,
                "cardano.sk",
                &serde_json::to_string_pretty(&cardano_keys[i as usize].signing_key).unwrap(),
            )?;
            Self::write_file(
                &node_dir,
                "hydra.sk",
                &serde_json::to_string_pretty(&hydra_keys[i as usize].signing_key).unwrap(),
            )?;

            // Write peer verification keys (all other participants)
            for (j, kp) in cardano_keys.iter().enumerate() {
                if j as u32 != i {
                    Self::write_file(
                        &node_dir,
                        &format!("cardano-peer-{j}.vk"),
                        &serde_json::to_string_pretty(&kp.verification_key).unwrap(),
                    )?;
                }
            }
            for (j, kp) in hydra_keys.iter().enumerate() {
                if j as u32 != i {
                    Self::write_file(
                        &node_dir,
                        &format!("hydra-peer-{j}.vk"),
                        &serde_json::to_string_pretty(&kp.verification_key).unwrap(),
                    )?;
                }
            }

            // Protocol parameters
            Self::write_file(
                &node_dir,
                "protocol-parameters.json",
                &protocol_params_content,
            )?;

            // Persistence directory
            let persist_dir = node_dir.join("persistence");
            std::fs::create_dir_all(&persist_dir)
                .map_err(|e| HydraHouseError::Orchestration(format!("mkdir persist: {e}")))?;

            let container = Self::container_name(head_id, i);
            let api_port = Self::api_port_for(head_id, i);
            let peer_port = Self::peer_port_for(head_id, i);

            // hydra-node v1.2.0 args for online mode with Blockfrost
            let mut args: Vec<String> = vec![
                format!("--node-id={i}"),
                "--api-host=0.0.0.0".into(),
                "--api-port=4001".into(),
                "--listen=0.0.0.0:5001".into(),
                format!("--advertise={container}:5001"),
                "--blockfrost=/data/blockfrost.txt".into(),
                format!("--network={}", network),
                "--cardano-signing-key=/data/cardano.sk".into(),
                "--hydra-signing-key=/data/hydra.sk".into(),
                format!("--contestation-period={contestation_secs}s"),
                "--ledger-protocol-parameters=/data/protocol-parameters.json".into(),
                "--persistence-dir=/data/persistence".into(),
            ];

            // Add peer verification keys
            for j in 0..participant_count {
                if j != i {
                    args.push(format!(
                        "--cardano-verification-key=/data/cardano-peer-{j}.vk"
                    ));
                    args.push(format!(
                        "--hydra-verification-key=/data/hydra-peer-{j}.vk"
                    ));
                }
            }

            // Add peer addresses (other nodes in the Docker network)
            for j in 0..participant_count {
                if j != i {
                    let peer_container = Self::container_name(head_id, j);
                    args.push(format!("--peer={peer_container}:5001"));
                }
            }

            let node_dir_abs = std::fs::canonicalize(&node_dir)
                .map_err(|e| HydraHouseError::Orchestration(format!("canonicalize: {e}")))?;

            // Remove any leftover container with same name
            let _ = tokio::process::Command::new("docker")
                .args(["rm", "-f", &container])
                .output()
                .await;

            let mut cmd = tokio::process::Command::new("docker");
            cmd.args(["run", "-d"]);
            cmd.args(["--name", &container]);
            cmd.args(["--network", &self.network_name]);
            cmd.args(["-p", &format!("{api_port}:4001")]);
            cmd.args(["-p", &format!("{peer_port}:5001")]);
            cmd.args(["-v", &format!("{}:/data", node_dir_abs.display())]);
            cmd.arg(&self.hydra_node_image);
            cmd.args(args.iter().map(|s| s.as_str()));

            tracing::info!(
                %head_id,
                node_index = i,
                %container,
                %api_port,
                %peer_port,
                "starting hydra-node container"
            );

            let output = cmd
                .output()
                .await
                .map_err(|e| HydraHouseError::Orchestration(format!("docker run: {e}")))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(HydraHouseError::Orchestration(format!(
                    "docker run failed for {container}: {stderr}"
                )));
            }

            let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
            tracing::info!(%head_id, %container, container_id = %&container_id[..12], "container started");

            // Store the verification key CBOR hex so the user can derive the address
            // (actual bech32 address derivation needs cardano-cli or a library)
            let vk_cbor = &cardano_keys[i as usize].verification_key.cbor_hex;
            let cardano_addr = format!("vk_cbor:{vk_cbor}");

            nodes.push(ProvisionedNode {
                pod_name: container,
                service_name: format!("localhost:{api_port}"),
                api_port,
                peer_port,
                cardano_address: cardano_addr,
                keys_secret_ref: node_dir_abs.display().to_string(),
            });
        }

        tracing::info!(%head_id, participant_count, "provisioned head via Docker");
        Ok(HeadDeployment { head_id, nodes })
    }

    async fn teardown_head(
        &self,
        head_id: Uuid,
        node_count: u32,
    ) -> Result<(), HydraHouseError> {
        for i in 0..node_count {
            let container = Self::container_name(head_id, i);
            tracing::info!(%head_id, %container, "stopping container");
            let _ = tokio::process::Command::new("docker")
                .args(["rm", "-f", &container])
                .output()
                .await;
        }
        Ok(())
    }

    async fn get_node_ws_url(
        &self,
        head_id: Uuid,
        node_index: u32,
    ) -> Result<String, HydraHouseError> {
        let port = Self::api_port_for(head_id, node_index);
        Ok(format!("ws://127.0.0.1:{port}"))
    }
}
