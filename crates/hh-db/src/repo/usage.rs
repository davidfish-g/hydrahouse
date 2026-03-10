use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct UsageRow {
    pub id: Uuid,
    pub account_id: Uuid,
    pub head_id: Option<Uuid>,
    pub metric: String,
    pub quantity: i64,
    pub recorded_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct UsageSummary {
    pub metric: String,
    pub total: i64,
}

pub async fn record(
    pool: &PgPool,
    account_id: Uuid,
    head_id: Option<Uuid>,
    metric: &str,
    quantity: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO usage_records (id, account_id, head_id, metric, quantity, recorded_at) VALUES ($1, $2, $3, $4, $5, NOW())"
    )
    .bind(Uuid::new_v4())
    .bind(account_id)
    .bind(head_id)
    .bind(metric)
    .bind(quantity)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn summary_for_account(
    pool: &PgPool,
    account_id: Uuid,
) -> Result<Vec<UsageSummary>, sqlx::Error> {
    sqlx::query_as::<_, UsageSummary>(
        "SELECT metric, COALESCE(SUM(quantity), 0)::bigint as total FROM usage_records WHERE account_id = $1 GROUP BY metric",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
}
