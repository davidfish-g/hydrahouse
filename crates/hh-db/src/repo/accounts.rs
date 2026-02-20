use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct AccountRow {
    pub id: Uuid,
    pub email: Option<String>,
    pub api_key_hash: String,
    pub plan: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn find_by_api_key_hash(pool: &PgPool, key_hash: &str) -> Result<Option<AccountRow>, sqlx::Error> {
    sqlx::query_as::<_, AccountRow>(
        "SELECT id, email, api_key_hash, plan, created_at FROM accounts WHERE api_key_hash = $1"
    )
    .bind(key_hash)
    .fetch_optional(pool)
    .await
}

/// Look up an account by API key with Argon2 + legacy hex support.
///
/// Strategy: try deterministic hex lookup first (legacy), then scan Argon2 rows.
/// On successful legacy match, upgrades the stored hash to Argon2 in-place.
pub async fn find_and_verify_api_key(
    pool: &PgPool,
    api_key: &str,
    verify_fn: fn(&str, &str) -> bool,
    hash_fn: fn(&str) -> String,
) -> Result<Option<AccountRow>, sqlx::Error> {
    let legacy_hex: String = api_key.as_bytes().iter().map(|b| format!("{b:02x}")).collect();
    if let Some(account) = find_by_api_key_hash(pool, &legacy_hex).await? {
        let new_hash = hash_fn(api_key);
        let _ = update_api_key_hash(pool, account.id, &new_hash).await;
        return Ok(Some(account));
    }

    let rows = sqlx::query_as::<_, AccountRow>(
        "SELECT id, email, api_key_hash, plan, created_at FROM accounts WHERE api_key_hash LIKE '$argon2%'"
    )
    .fetch_all(pool)
    .await?;

    for row in rows {
        if verify_fn(api_key, &row.api_key_hash) {
            return Ok(Some(row));
        }
    }

    Ok(None)
}

pub async fn update_api_key_hash(pool: &PgPool, id: Uuid, new_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE accounts SET api_key_hash = $1 WHERE id = $2")
        .bind(new_hash)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn create(pool: &PgPool, email: Option<&str>, api_key_hash: &str) -> Result<AccountRow, sqlx::Error> {
    sqlx::query_as::<_, AccountRow>(
        r#"
        INSERT INTO accounts (id, email, api_key_hash, plan, created_at)
        VALUES ($1, $2, $3, 'free', NOW())
        RETURNING id, email, api_key_hash, plan, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(api_key_hash)
    .fetch_one(pool)
    .await
}
