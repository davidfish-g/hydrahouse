use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct ParticipantRow {
    pub id: Uuid,
    pub head_id: Uuid,
    pub slot_index: i32,
    pub cardano_address: Option<String>,
    pub keys_secret_ref: Option<String>,
    pub commit_status: String,
}

pub async fn create(
    pool: &PgPool,
    head_id: Uuid,
    slot_index: i32,
) -> Result<ParticipantRow, sqlx::Error> {
    sqlx::query_as::<_, ParticipantRow>(
        r#"
        INSERT INTO participants (id, head_id, slot_index, commit_status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id, head_id, slot_index, cardano_address, keys_secret_ref, commit_status
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(head_id)
    .bind(slot_index)
    .fetch_one(pool)
    .await
}

pub async fn list_by_head(pool: &PgPool, head_id: Uuid) -> Result<Vec<ParticipantRow>, sqlx::Error> {
    sqlx::query_as::<_, ParticipantRow>(
        "SELECT id, head_id, slot_index, cardano_address, keys_secret_ref, commit_status FROM participants WHERE head_id = $1 ORDER BY slot_index",
    )
    .bind(head_id)
    .fetch_all(pool)
    .await
}

pub async fn update_keys(
    pool: &PgPool,
    id: Uuid,
    cardano_address: &str,
    keys_secret_ref: &str,
) -> Result<ParticipantRow, sqlx::Error> {
    sqlx::query_as::<_, ParticipantRow>(
        r#"
        UPDATE participants SET cardano_address = $2, keys_secret_ref = $3
        WHERE id = $1
        RETURNING id, head_id, slot_index, cardano_address, keys_secret_ref, commit_status
        "#,
    )
    .bind(id)
    .bind(cardano_address)
    .bind(keys_secret_ref)
    .fetch_one(pool)
    .await
}

pub async fn update_commit_status(
    pool: &PgPool,
    id: Uuid,
    status: &str,
) -> Result<ParticipantRow, sqlx::Error> {
    sqlx::query_as::<_, ParticipantRow>(
        r#"
        UPDATE participants SET commit_status = $2
        WHERE id = $1
        RETURNING id, head_id, slot_index, cardano_address, keys_secret_ref, commit_status
        "#,
    )
    .bind(id)
    .bind(status)
    .fetch_one(pool)
    .await
}
