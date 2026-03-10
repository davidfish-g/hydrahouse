use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct HeadEventRow {
    pub id: Uuid,
    pub head_id: Uuid,
    pub event_type: String,
    pub payload_json: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn insert(
    pool: &PgPool,
    head_id: Uuid,
    event_type: &str,
    payload: &serde_json::Value,
) -> Result<HeadEventRow, sqlx::Error> {
    sqlx::query_as::<_, HeadEventRow>(
        r#"
        INSERT INTO head_events (id, head_id, event_type, payload_json, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, head_id, event_type, payload_json, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(head_id)
    .bind(event_type)
    .bind(payload)
    .fetch_one(pool)
    .await
}

pub async fn list_by_head(pool: &PgPool, head_id: Uuid) -> Result<Vec<HeadEventRow>, sqlx::Error> {
    list_by_head_paginated(pool, head_id, 50, 0).await
}

pub async fn list_by_head_paginated(
    pool: &PgPool,
    head_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<HeadEventRow>, sqlx::Error> {
    sqlx::query_as::<_, HeadEventRow>(
        "SELECT id, head_id, event_type, payload_json, created_at FROM head_events WHERE head_id = $1 ORDER BY created_at LIMIT $2 OFFSET $3",
    )
    .bind(head_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
}
