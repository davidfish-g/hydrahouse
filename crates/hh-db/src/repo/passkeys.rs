use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct PasskeyCredentialRow {
    pub id: Uuid,
    pub account_id: Uuid,
    pub credential_id: Vec<u8>,
    pub public_key: Vec<u8>,
    pub counter: i32,
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn create(
    pool: &PgPool,
    account_id: Uuid,
    credential_id: &[u8],
    public_key: &[u8],
    counter: i32,
    name: &str,
) -> Result<PasskeyCredentialRow, sqlx::Error> {
    sqlx::query_as::<_, PasskeyCredentialRow>(
        "INSERT INTO passkey_credentials (account_id, credential_id, public_key, counter, name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, account_id, credential_id, public_key, counter, name, created_at",
    )
    .bind(account_id)
    .bind(credential_id)
    .bind(public_key)
    .bind(counter)
    .bind(name)
    .fetch_one(pool)
    .await
}

pub async fn find_by_credential_id(
    pool: &PgPool,
    credential_id: &[u8],
) -> Result<Option<PasskeyCredentialRow>, sqlx::Error> {
    sqlx::query_as::<_, PasskeyCredentialRow>(
        "SELECT id, account_id, credential_id, public_key, counter, name, created_at
         FROM passkey_credentials WHERE credential_id = $1",
    )
    .bind(credential_id)
    .fetch_optional(pool)
    .await
}

pub async fn list_by_account(
    pool: &PgPool,
    account_id: Uuid,
) -> Result<Vec<PasskeyCredentialRow>, sqlx::Error> {
    sqlx::query_as::<_, PasskeyCredentialRow>(
        "SELECT id, account_id, credential_id, public_key, counter, name, created_at
         FROM passkey_credentials WHERE account_id = $1 ORDER BY created_at",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
}

pub async fn update_counter(
    pool: &PgPool,
    credential_id: &[u8],
    counter: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE passkey_credentials SET counter = $1 WHERE credential_id = $2")
        .bind(counter)
        .bind(credential_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete(pool: &PgPool, id: Uuid, account_id: Uuid) -> Result<bool, sqlx::Error> {
    let result =
        sqlx::query("DELETE FROM passkey_credentials WHERE id = $1 AND account_id = $2")
            .bind(id)
            .bind(account_id)
            .execute(pool)
            .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn delete_all_by_account(pool: &PgPool, account_id: Uuid) -> Result<u64, sqlx::Error> {
    let result =
        sqlx::query("DELETE FROM passkey_credentials WHERE account_id = $1")
            .bind(account_id)
            .execute(pool)
            .await?;
    Ok(result.rows_affected())
}

pub async fn count_by_account(pool: &PgPool, account_id: Uuid) -> Result<i64, sqlx::Error> {
    let (count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM passkey_credentials WHERE account_id = $1")
            .bind(account_id)
            .fetch_one(pool)
            .await?;
    Ok(count)
}
