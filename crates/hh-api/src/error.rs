use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: msg.into(),
        }
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: msg.into(),
        }
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: msg.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = json!({ "error": self.message });
        (self.status, axum::Json(body)).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        tracing::error!(error = %e, "database error");
        Self::internal("database error")
    }
}

impl From<hh_core::error::HydraHouseError> for ApiError {
    fn from(e: hh_core::error::HydraHouseError) -> Self {
        match &e {
            hh_core::error::HydraHouseError::HeadNotFound(_) => Self::not_found(e.to_string()),
            hh_core::error::HydraHouseError::BadRequest(_) => Self::bad_request(e.to_string()),
            hh_core::error::HydraHouseError::AuthFailed => Self {
                status: StatusCode::UNAUTHORIZED,
                message: e.to_string(),
            },
            _ => Self::internal(e.to_string()),
        }
    }
}
