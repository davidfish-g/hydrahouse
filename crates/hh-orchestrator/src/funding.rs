//! Auto-funding module: sends ADA from a platform wallet to hydra-node addresses
//! via Blockfrost before nodes are started.

use ed25519_dalek::SigningKey;
use hh_core::network::Network;
use serde::Deserialize;

/// Blockfrost API client for funding operations.
pub struct BlockfrostFunder {
    client: reqwest::Client,
    base_url: String,
    project_id: String,
    signing_key: SigningKey,
    sender_address: String,
}

#[derive(Debug, Deserialize)]
struct BlockfrostUtxo {
    tx_hash: String,
    output_index: u32,
    amount: Vec<BlockfrostAmount>,
}

#[derive(Debug, Deserialize)]
struct BlockfrostAmount {
    unit: String,
    quantity: String,
}

impl BlockfrostFunder {
    /// Create a new funder from a platform wallet signing key (hex-encoded CBOR TextEnvelope cborHex).
    pub fn new(
        network: Network,
        project_id: &str,
        platform_sk_cbor_hex: &str,
    ) -> Result<Self, String> {
        let raw_sk_hex = platform_sk_cbor_hex
            .strip_prefix("5820")
            .ok_or("platform wallet cborHex must start with 5820")?;

        let sk_bytes: [u8; 32] = hex::decode(raw_sk_hex)
            .map_err(|e| format!("invalid platform wallet hex: {e}"))?
            .try_into()
            .map_err(|_| "platform wallet key must be 32 bytes")?;

        let signing_key = SigningKey::from_bytes(&sk_bytes);
        let vk_bytes = signing_key.verifying_key().to_bytes();
        let vk_cbor_hex = format!("5820{}", hex::encode(vk_bytes));
        let is_testnet = network != Network::Mainnet;
        let sender_address = hh_keys::bech32::vk_cbor_to_address(&vk_cbor_hex, is_testnet)
            .map_err(|e| format!("failed to derive platform wallet address: {e}"))?;

        let base_url = blockfrost_base_url(network);

        Ok(Self {
            client: reqwest::Client::new(),
            base_url,
            project_id: project_id.to_string(),
            signing_key,
            sender_address,
        })
    }

    /// Fund multiple node addresses with fuel for L1 transaction fees.
    /// Each node gets THREE UTxOs: Init tx consumes 1-2, commit tx needs
    /// both a regular input and a separate pure-ADA collateral UTxO.
    pub async fn fund_addresses(
        &self,
        addresses: &[String],
    ) -> Result<String, String> {
        if addresses.is_empty() {
            return Ok("no addresses to fund".into());
        }

        let fuel_per_utxo: u64 = 10_000_000; // 10 ADA per UTxO
        let utxos_per_node: usize = 3; // init, commit, and deposit each need a fuel/collateral UTxO
        let fuel_per_node = fuel_per_utxo * utxos_per_node as u64;

        tracing::info!(
            sender = %self.sender_address,
            recipients = addresses.len(),
            fuel_per_node,
            utxos_per_node,
            "funding node addresses with L1 fuel from platform wallet"
        );

        let utxos = self.query_utxos(&self.sender_address).await?;
        if utxos.is_empty() {
            return Err(format!(
                "platform wallet {} has no UTxOs — fund it first",
                self.sender_address
            ));
        }

        let total_needed = fuel_per_node * addresses.len() as u64;
        let output_count = addresses.len() * utxos_per_node + 1; // three per node + change
        let estimated_fee = hh_keys::tx::estimate_fee(utxos.len().min(3), output_count);
        let total_with_fee = total_needed + estimated_fee;

        let mut selected = Vec::new();
        let mut selected_total: u64 = 0;
        for utxo in &utxos {
            let lovelace = utxo
                .amount
                .iter()
                .find(|a| a.unit == "lovelace")
                .and_then(|a| a.quantity.parse::<u64>().ok())
                .unwrap_or(0);
            if lovelace == 0 {
                continue;
            }
            selected.push((utxo, lovelace));
            selected_total += lovelace;
            if selected_total >= total_with_fee {
                break;
            }
        }

        if selected_total < total_with_fee {
            return Err(format!(
                "platform wallet has {} lovelace but needs {} ({} fuel + {} fee)",
                selected_total, total_with_fee, total_needed, estimated_fee
            ));
        }

        let inputs: Vec<hh_keys::tx::TxIn> = selected
            .iter()
            .map(|(utxo, _)| {
                let mut tx_hash = [0u8; 32];
                if let Ok(bytes) = hex::decode(&utxo.tx_hash) {
                    tx_hash[..bytes.len().min(32)].copy_from_slice(&bytes[..bytes.len().min(32)]);
                }
                hh_keys::tx::TxIn {
                    tx_hash,
                    output_index: utxo.output_index,
                }
            })
            .collect();

        let sender_bytes = hh_keys::bech32::bech32_decode_address(&self.sender_address)
            .map_err(|e| format!("decode sender address: {e}"))?;

        let mut outputs: Vec<hh_keys::tx::TxOut> = Vec::with_capacity(addresses.len() * utxos_per_node + 1);
        for addr in addresses {
            let addr_bytes = hh_keys::bech32::bech32_decode_address(addr)
                .map_err(|e| format!("decode address {addr}: {e}"))?;
            for _ in 0..utxos_per_node {
                outputs.push(hh_keys::tx::TxOut {
                    address: addr_bytes.clone(),
                    lovelace: fuel_per_utxo,
                });
            }
        }

        let fee = hh_keys::tx::estimate_fee(inputs.len(), outputs.len() + 1);
        let change = selected_total - total_needed - fee;

        // Only add change output if it meets min UTxO (1 ADA)
        if change >= 1_000_000 {
            outputs.push(hh_keys::tx::TxOut {
                address: sender_bytes,
                lovelace: change,
            });
        }

        let tx_bytes = hh_keys::tx::build_and_sign_tx(&inputs, &outputs, fee, &self.signing_key);
        tracing::info!(
            fee,
            change,
            inputs = inputs.len(),
            outputs = outputs.len(),
            tx_size = tx_bytes.len(),
            "submitting funding transaction"
        );

        let tx_hash = self.submit_tx(&tx_bytes).await?;
        tracing::info!(%tx_hash, "funding transaction submitted successfully");

        // Wait for confirmation
        self.wait_for_confirmation(&tx_hash).await?;
        tracing::info!(%tx_hash, "funding transaction confirmed");

        Ok(tx_hash)
    }

    /// Fund a single address with a specific amount of lovelace.
    pub async fn fund_single_address(
        &self,
        address: &str,
        lovelace: u64,
    ) -> Result<String, String> {
        tracing::info!(target = address, lovelace, "funding single address from platform wallet");

        let utxos = self.query_utxos(&self.sender_address).await?;
        if utxos.is_empty() {
            return Err(format!(
                "platform wallet {} has no UTxOs — fund it first",
                self.sender_address
            ));
        }

        let estimated_fee = hh_keys::tx::estimate_fee(2, 2);
        let total_needed = lovelace + estimated_fee;

        let mut selected = Vec::new();
        let mut selected_total: u64 = 0;
        for utxo in &utxos {
            let utxo_lovelace = utxo
                .amount
                .iter()
                .find(|a| a.unit == "lovelace")
                .and_then(|a| a.quantity.parse::<u64>().ok())
                .unwrap_or(0);
            if utxo_lovelace == 0 {
                continue;
            }
            selected.push((utxo, utxo_lovelace));
            selected_total += utxo_lovelace;
            if selected_total >= total_needed {
                break;
            }
        }

        if selected_total < total_needed {
            return Err(format!(
                "platform wallet has {} lovelace but needs {}",
                selected_total, total_needed
            ));
        }

        let inputs: Vec<hh_keys::tx::TxIn> = selected
            .iter()
            .map(|(utxo, _)| {
                let mut tx_hash = [0u8; 32];
                if let Ok(bytes) = hex::decode(&utxo.tx_hash) {
                    tx_hash[..bytes.len().min(32)].copy_from_slice(&bytes[..bytes.len().min(32)]);
                }
                hh_keys::tx::TxIn {
                    tx_hash,
                    output_index: utxo.output_index,
                }
            })
            .collect();

        let target_bytes = hh_keys::bech32::bech32_decode_address(address)
            .map_err(|e| format!("decode target address: {e}"))?;
        let sender_bytes = hh_keys::bech32::bech32_decode_address(&self.sender_address)
            .map_err(|e| format!("decode sender address: {e}"))?;

        let fee = hh_keys::tx::estimate_fee(inputs.len(), 2);
        let change = selected_total - lovelace - fee;

        let mut outputs = vec![hh_keys::tx::TxOut {
            address: target_bytes,
            lovelace,
        }];
        if change >= 1_000_000 {
            outputs.push(hh_keys::tx::TxOut {
                address: sender_bytes,
                lovelace: change,
            });
        }

        let tx_bytes = hh_keys::tx::build_and_sign_tx(&inputs, &outputs, fee, &self.signing_key);
        let tx_hash = self.submit_tx(&tx_bytes).await?;
        tracing::info!(%tx_hash, "funding tx submitted");
        Ok(tx_hash)
    }

    /// Wait for a transaction to be confirmed on-chain. Public so CLI can use it.
    pub async fn wait_for_tx_confirmation(&self, tx_hash: &str) -> Result<(), String> {
        self.wait_for_confirmation(tx_hash).await
    }

    async fn query_utxos(&self, address: &str) -> Result<Vec<BlockfrostUtxo>, String> {
        let url = format!("{}/addresses/{}/utxos", self.base_url, address);
        let resp = self
            .client
            .get(&url)
            .header("project_id", &self.project_id)
            .send()
            .await
            .map_err(|e| format!("blockfrost utxo query failed: {e}"))?;

        if resp.status() == 404 {
            return Ok(Vec::new());
        }

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("blockfrost utxo query error: {body}"));
        }

        resp.json()
            .await
            .map_err(|e| format!("parse utxo response: {e}"))
    }

    async fn submit_tx(&self, tx_bytes: &[u8]) -> Result<String, String> {
        let url = format!("{}/tx/submit", self.base_url);
        let resp = self
            .client
            .post(&url)
            .header("project_id", &self.project_id)
            .header("Content-Type", "application/cbor")
            .body(tx_bytes.to_vec())
            .send()
            .await
            .map_err(|e| format!("blockfrost tx submit failed: {e}"))?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        if status.is_success() {
            let tx_hash = body.trim().trim_matches('"').to_string();
            Ok(tx_hash)
        } else {
            Err(format!("blockfrost tx submit rejected ({}): {}", status, body))
        }
    }

    async fn wait_for_confirmation(&self, tx_hash: &str) -> Result<(), String> {
        let url = format!("{}/txs/{}", self.base_url, tx_hash);
        for attempt in 1..=60 {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            let resp = self
                .client
                .get(&url)
                .header("project_id", &self.project_id)
                .send()
                .await
                .map_err(|e| format!("confirmation check failed: {e}"))?;

            if resp.status().is_success() {
                return Ok(());
            }
            if attempt % 6 == 0 {
                tracing::info!(%tx_hash, attempt, "still waiting for funding tx confirmation...");
            }
        }
        Err(format!("funding tx {} not confirmed after 5 minutes", tx_hash))
    }
}

/// Get the Blockfrost API base URL for a given network.
pub fn blockfrost_base_url(network: Network) -> String {
    match network {
        Network::Mainnet => "https://cardano-mainnet.blockfrost.io/api/v0".into(),
        Network::Preprod => "https://cardano-preprod.blockfrost.io/api/v0".into(),
        Network::Preview => "https://cardano-preview.blockfrost.io/api/v0".into(),
    }
}
