pub mod accounts;
pub mod api_keys;
pub mod auth_google;
pub mod auth_link;
pub mod auth_passkey;
pub mod heads;
pub mod health;
pub mod transactions;

use crate::error::ApiError;
use hh_db::repo::heads::HeadRow;
use uuid::Uuid;

pub async fn get_owned_head(
    db: &sqlx::PgPool,
    head_id: Uuid,
    account_id: Uuid,
) -> Result<HeadRow, ApiError> {
    let row = hh_db::repo::heads::find_by_id(db, head_id)
        .await?
        .ok_or_else(|| ApiError::not_found(format!("head {head_id} not found")))?;
    if row.account_id != account_id {
        return Err(ApiError::not_found(format!("head {head_id} not found")));
    }
    Ok(row)
}
