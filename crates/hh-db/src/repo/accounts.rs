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
