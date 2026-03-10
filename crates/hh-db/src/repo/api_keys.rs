use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct ApiKeyRow {
    pub id: Uuid,
    pub account_id: Uuid,
    pub name: String,
    pub key_hash: String,
    pub key_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_used_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub async fn create(
    pool: &PgPool,
    account_id: Uuid,
    name: &str,
    key_hash: &str,
    key_id: &str,
) -> Result<ApiKeyRow, sqlx::Error> {
    sqlx::query_as::<_, ApiKeyRow>(
        "INSERT INTO api_keys (account_id, name, key_hash, key_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, account_id, name, key_hash, key_id, created_at, last_used_at",
    )
    .bind(account_id)
    .bind(name)
    .bind(key_hash)
    .bind(key_id)
    .fetch_one(pool)
    .await
}

pub async fn find_by_key_id(pool: &PgPool, key_id: &str) -> Result<Option<ApiKeyRow>, sqlx::Error> {
    sqlx::query_as::<_, ApiKeyRow>(
        "SELECT id, account_id, name, key_hash, key_id, created_at, last_used_at
         FROM api_keys WHERE key_id = $1",
    )
    .bind(key_id)
    .fetch_optional(pool)
    .await
}

pub async fn list_by_account(pool: &PgPool, account_id: Uuid) -> Result<Vec<ApiKeyRow>, sqlx::Error> {
    sqlx::query_as::<_, ApiKeyRow>(
        "SELECT id, account_id, name, key_hash, key_id, created_at, last_used_at
         FROM api_keys WHERE account_id = $1 ORDER BY created_at",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
}

pub async fn count_by_account(pool: &PgPool, account_id: Uuid) -> Result<i64, sqlx::Error> {
    let (count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM api_keys WHERE account_id = $1")
            .bind(account_id)
            .fetch_one(pool)
            .await?;
    Ok(count)
}

pub async fn delete(pool: &PgPool, id: Uuid, account_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM api_keys WHERE id = $1 AND account_id = $2")
        .bind(id)
        .bind(account_id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn touch_last_used(pool: &PgPool, id: Uuid) {
    let _ = sqlx::query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await;
}
