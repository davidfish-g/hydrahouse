use clap::Subcommand;
use serde_json::json;

#[derive(Subcommand)]
pub enum Command {
    /// Create a new Hydra head
    Create {
        /// Target network (preprod, preview, mainnet)
        #[arg(short, long, default_value = "preprod")]
        network: String,

        /// Number of participants
        #[arg(short, long, default_value = "2")]
        participants: i32,

        /// Contestation period in seconds
        #[arg(short, long, default_value = "300")]
        contestation_period: u32,
    },

    /// List your Hydra heads
    List,

    /// Get details of a specific head
    Get {
        /// Head ID
        id: String,
    },

    /// Close an open head
    Close {
        /// Head ID
        id: String,
    },

    /// Abort a head
    Abort {
        /// Head ID
        id: String,
    },
}

pub struct ApiClient {
    http: reqwest::Client,
    base_url: String,
    api_key: String,
}

impl ApiClient {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url,
            api_key,
        }
    }

    async fn get(&self, path: &str) -> anyhow::Result<serde_json::Value> {
        let resp = self
            .http
            .get(format!("{}{}", self.base_url, path))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;

        let status = resp.status();
        let body: serde_json::Value = resp.json().await?;

        if !status.is_success() {
            let msg = body
                .get("error")
                .and_then(|e| e.as_str())
                .unwrap_or("unknown error");
            anyhow::bail!("API error ({}): {}", status, msg);
        }

        Ok(body)
    }

    async fn post(&self, path: &str, body: &serde_json::Value) -> anyhow::Result<serde_json::Value> {
        let resp = self
            .http
            .post(format!("{}{}", self.base_url, path))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(body)
            .send()
            .await?;

        let status = resp.status();
        let resp_body: serde_json::Value = resp.json().await?;

        if !status.is_success() {
            let msg = resp_body
                .get("error")
                .and_then(|e| e.as_str())
                .unwrap_or("unknown error");
            anyhow::bail!("API error ({}): {}", status, msg);
        }

        Ok(resp_body)
    }

    async fn delete(&self, path: &str) -> anyhow::Result<serde_json::Value> {
        let resp = self
            .http
            .delete(format!("{}{}", self.base_url, path))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;

        let status = resp.status();
        let body: serde_json::Value = resp.json().await?;

        if !status.is_success() {
            let msg = body
                .get("error")
                .and_then(|e| e.as_str())
                .unwrap_or("unknown error");
            anyhow::bail!("API error ({}): {}", status, msg);
        }

        Ok(body)
    }
}

pub async fn run(client: ApiClient, cmd: Command) -> anyhow::Result<()> {
    match cmd {
        Command::Create {
            network,
            participants,
            contestation_period,
        } => {
            println!("Creating head on {} with {} participants...", network, participants);

            let body = json!({
                "network": network,
                "participants": participants,
                "config": {
                    "contestation_period_secs": contestation_period,
                }
            });

            let resp = client.post("/v1/heads", &body).await?;
            let head_id = resp["head_id"].as_str().unwrap_or("unknown");
            let status = resp["status"].as_str().unwrap_or("unknown");
            let ws_url = resp["ws_url"].as_str().unwrap_or("");

            println!("Head created:");
            println!("  ID:     {}", head_id);
            println!("  Status: {}", status);
            println!("  WS URL: {}", ws_url);

            if let Some(participants) = resp["participants"].as_array() {
                for p in participants {
                    let slot = p["slot_index"].as_i64().unwrap_or(0);
                    let id = p["id"].as_str().unwrap_or("");
                    println!("  Participant {}: {}", slot, id);
                }
            }
        }

        Command::List => {
            let resp = client.get("/v1/heads").await?;

            if let Some(heads) = resp["heads"].as_array() {
                if heads.is_empty() {
                    println!("No heads found.");
                } else {
                    println!("{:<38} {:<12} {:<10} CREATED", "HEAD ID", "NETWORK", "STATUS");
                    for h in heads {
                        println!(
                            "{:<38} {:<12} {:<10} {}",
                            h["head_id"].as_str().unwrap_or(""),
                            h["network"].as_str().unwrap_or(""),
                            h["status"].as_str().unwrap_or(""),
                            h["created_at"].as_str().unwrap_or(""),
                        );
                    }
                }
            }
        }

        Command::Get { id } => {
            let resp = client.get(&format!("/v1/heads/{}", id)).await?;
            println!("{}", serde_json::to_string_pretty(&resp)?);
        }

        Command::Close { id } => {
            println!("Closing head {}...", id);
            let resp = client.post(&format!("/v1/heads/{}/close", id), &json!({})).await?;
            println!("Status: {}", resp["status"].as_str().unwrap_or("unknown"));
        }

        Command::Abort { id } => {
            println!("Aborting head {}...", id);
            let resp = client.delete(&format!("/v1/heads/{}", id)).await?;
            println!("Status: {}", resp["status"].as_str().unwrap_or("unknown"));
        }
    }
    Ok(())
}
