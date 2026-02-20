use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum CommitStatus {
    Pending,
    Committed,
    Failed,
}

impl std::fmt::Display for CommitStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommitStatus::Pending => write!(f, "pending"),
            CommitStatus::Committed => write!(f, "committed"),
            CommitStatus::Failed => write!(f, "failed"),
        }
    }
}

impl std::str::FromStr for CommitStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(CommitStatus::Pending),
            "committed" => Ok(CommitStatus::Committed),
            "failed" => Ok(CommitStatus::Failed),
            other => Err(format!("unknown commit status: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Participant {
    pub id: Uuid,
    pub head_id: Uuid,
    pub slot_index: i32,
    pub cardano_address: Option<String>,
    pub keys_secret_ref: Option<String>,
    pub commit_status: CommitStatus,
}
