use thiserror::Error;

#[derive(Debug, Error)]
pub enum HydraHouseError {
    #[error("head not found: {0}")]
    HeadNotFound(String),

    #[error("invalid head state transition from {from} to {to}")]
    InvalidStateTransition { from: String, to: String },

    #[error("authentication failed")]
    AuthFailed,

    #[error("invalid request: {0}")]
    BadRequest(String),

    #[error("orchestration error: {0}")]
    Orchestration(String),

    #[error("key generation error: {0}")]
    KeyGen(String),

    #[error("database error: {0}")]
    Database(String),

    #[error("internal error: {0}")]
    Internal(String),
}
