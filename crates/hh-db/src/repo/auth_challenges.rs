use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct AuthChallengeRow {
    pub id: Uuid,
    pub challenge: String,
    pub state: serde_json::Value,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn create(
    pool: &PgPool,
    challenge: &str,
    state: &serde_json::Value,
    expires_at: chrono::DateTime<chrono::Utc>,
) -> Result<AuthChallengeRow, sqlx::Error> {
    sqlx::query_as::<_, AuthChallengeRow>(
        "INSERT INTO auth_challenges (challenge, state, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, challenge, state, expires_at, created_at",
    )
    .bind(challenge)
    .bind(state)
    .bind(expires_at)
    .fetch_one(pool)
    .await
}

pub async fn find_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<AuthChallengeRow>, sqlx::Error> {
    sqlx::query_as::<_, AuthChallengeRow>(
        "SELECT id, challenge, state, expires_at, created_at
         FROM auth_challenges WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_challenge(
    pool: &PgPool,
    challenge: &str,
) -> Result<Option<AuthChallengeRow>, sqlx::Error> {
    sqlx::query_as::<_, AuthChallengeRow>(
        "SELECT id, challenge, state, expires_at, created_at
         FROM auth_challenges WHERE challenge = $1",
    )
    .bind(challenge)
    .fetch_optional(pool)
    .await
}

pub async fn delete_by_id(pool: &PgPool, id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM auth_challenges WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_expired(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM auth_challenges WHERE expires_at < NOW()")
        .execute(pool)
        .await?;
    Ok(())
}
