use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::network::Network;
use crate::participant::Participant;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum HeadStatus {
    Requested,
    Provisioning,
    Initializing,
    Committing,
    Open,
    Closing,
    Closed,
    FannedOut,
    Aborted,
}

impl HeadStatus {
    pub fn can_transition_to(&self, next: HeadStatus) -> bool {
        use HeadStatus::*;
        matches!(
            (self, next),
            (Requested, Provisioning)
                | (Provisioning, Initializing)
                | (Provisioning, Aborted)
                | (Initializing, Committing)
                | (Initializing, Aborted)
                | (Committing, Open)
                | (Committing, Aborted)
                | (Open, Closing)
                | (Open, Aborted)
                | (Closing, Closed)
                | (Closed, FannedOut)
        )
    }
}

impl std::fmt::Display for HeadStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = serde_json::to_value(self)
            .ok()
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| format!("{:?}", self));
        write!(f, "{s}")
    }
}

impl std::str::FromStr for HeadStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        serde_json::from_value(serde_json::Value::String(s.to_string()))
            .map_err(|_| format!("unknown head status: {s}"))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HeadConfig {
    pub contestation_period_secs: u32,
    #[serde(default = "default_deposit_period_secs")]
    pub deposit_period_secs: u32,
}

fn default_deposit_period_secs() -> u32 {
    120
}

impl Default for HeadConfig {
    fn default() -> Self {
        Self {
            contestation_period_secs: 300,
            deposit_period_secs: 120,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Head {
    pub id: Uuid,
    pub account_id: Uuid,
    pub network: Network,
    pub status: HeadStatus,
    pub participant_count: i32,
    pub config: HeadConfig,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub closed_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HeadDetail {
    #[serde(flatten)]
    pub head: Head,
    pub participants: Vec<Participant>,
    pub ws_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateHeadRequest {
    pub network: Network,
    #[serde(default = "default_participants")]
    pub participants: i32,
    #[serde(default)]
    pub config: Option<HeadConfig>,
}

fn default_participants() -> i32 {
    2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_transitions() {
        assert!(HeadStatus::Requested.can_transition_to(HeadStatus::Provisioning));
        assert!(HeadStatus::Provisioning.can_transition_to(HeadStatus::Initializing));
        assert!(HeadStatus::Initializing.can_transition_to(HeadStatus::Committing));
        assert!(HeadStatus::Committing.can_transition_to(HeadStatus::Open));
        assert!(HeadStatus::Open.can_transition_to(HeadStatus::Closing));
        assert!(HeadStatus::Closing.can_transition_to(HeadStatus::Closed));
        assert!(HeadStatus::Closed.can_transition_to(HeadStatus::FannedOut));
    }

    #[test]
    fn invalid_transitions() {
        assert!(!HeadStatus::Requested.can_transition_to(HeadStatus::Open));
        assert!(!HeadStatus::Open.can_transition_to(HeadStatus::Provisioning));
        assert!(!HeadStatus::FannedOut.can_transition_to(HeadStatus::Open));
    }

    #[test]
    fn abort_transitions() {
        assert!(HeadStatus::Provisioning.can_transition_to(HeadStatus::Aborted));
        assert!(HeadStatus::Initializing.can_transition_to(HeadStatus::Aborted));
        assert!(HeadStatus::Committing.can_transition_to(HeadStatus::Aborted));
        assert!(HeadStatus::Open.can_transition_to(HeadStatus::Aborted));
        assert!(!HeadStatus::FannedOut.can_transition_to(HeadStatus::Aborted));
    }
}
