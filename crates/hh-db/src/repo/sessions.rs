use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct SessionRow {
    pub id: Uuid,
    pub account_id: Uuid,
    pub token_id: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn create(
    pool: &PgPool,
    account_id: Uuid,
    token_id: &str,
    expires_at: chrono::DateTime<chrono::Utc>,
) -> Result<SessionRow, sqlx::Error> {
    sqlx::query_as::<_, SessionRow>(
        "INSERT INTO sessions (account_id, token_id, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, account_id, token_id, expires_at, created_at",
    )
    .bind(account_id)
    .bind(token_id)
    .bind(expires_at)
    .fetch_one(pool)
    .await
}

pub async fn find_by_token_id(pool: &PgPool, token_id: &str) -> Result<Option<SessionRow>, sqlx::Error> {
    sqlx::query_as::<_, SessionRow>(
        "SELECT id, account_id, token_id, expires_at, created_at
         FROM sessions WHERE token_id = $1",
    )
    .bind(token_id)
    .fetch_optional(pool)
    .await
}

pub async fn delete_for_account(pool: &PgPool, account_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM sessions WHERE account_id = $1")
        .bind(account_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_by_token_id(pool: &PgPool, token_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM sessions WHERE token_id = $1")
        .bind(token_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_expired(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM sessions WHERE expires_at < NOW()")
        .execute(pool)
        .await?;
    Ok(())
}
