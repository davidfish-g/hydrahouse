use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct HeadRow {
    pub id: Uuid,
    pub account_id: Uuid,
    pub network: String,
    pub status: String,
    pub participant_count: i32,
    pub config_json: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub closed_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub async fn create(
    pool: &PgPool,
    account_id: Uuid,
    network: &str,
    participant_count: i32,
    config_json: &serde_json::Value,
) -> Result<HeadRow, sqlx::Error> {
    sqlx::query_as::<_, HeadRow>(
        r#"
        INSERT INTO heads (id, account_id, network, status, participant_count, config_json, created_at)
        VALUES ($1, $2, $3, 'requested', $4, $5, NOW())
        RETURNING id, account_id, network, status, participant_count, config_json, created_at, closed_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(account_id)
    .bind(network)
    .bind(participant_count)
    .bind(config_json)
    .fetch_one(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<HeadRow>, sqlx::Error> {
    sqlx::query_as::<_, HeadRow>(
        "SELECT id, account_id, network, status, participant_count, config_json, created_at, closed_at FROM heads WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_by_account(pool: &PgPool, account_id: Uuid) -> Result<Vec<HeadRow>, sqlx::Error> {
    sqlx::query_as::<_, HeadRow>(
        "SELECT id, account_id, network, status, participant_count, config_json, created_at, closed_at FROM heads WHERE account_id = $1 ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
}

/// Find all heads in active lifecycle states (need a monitor running).
pub async fn find_active(pool: &PgPool) -> Result<Vec<HeadRow>, sqlx::Error> {
    sqlx::query_as::<_, HeadRow>(
        "SELECT id, account_id, network, status, participant_count, config_json, created_at, closed_at FROM heads WHERE status IN ('provisioning', 'requested', 'initializing', 'committing', 'open') ORDER BY created_at",
    )
    .fetch_all(pool)
    .await
}

pub async fn update_status(
    pool: &PgPool,
    id: Uuid,
    new_status: &str,
) -> Result<HeadRow, sqlx::Error> {
    sqlx::query_as::<_, HeadRow>(
        r#"
        UPDATE heads SET status = $2, closed_at = CASE WHEN $2 IN ('closed', 'fanned_out', 'aborted') THEN NOW() ELSE closed_at END
        WHERE id = $1
        RETURNING id, account_id, network, status, participant_count, config_json, created_at, closed_at
        "#,
    )
    .bind(id)
    .bind(new_status)
    .fetch_one(pool)
    .await
}
