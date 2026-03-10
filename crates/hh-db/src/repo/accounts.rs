use sqlx::PgPool;
use uuid::Uuid;

const ACCOUNT_COLUMNS: &str = "id, email, plan, created_at, stripe_customer_id, balance_cents, google_id";

#[derive(Debug, sqlx::FromRow)]
pub struct AccountRow {
    pub id: Uuid,
    pub email: Option<String>,
    pub plan: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub stripe_customer_id: Option<String>,
    pub balance_cents: i64,
    pub google_id: Option<String>,
}

pub async fn create(pool: &PgPool, email: Option<&str>) -> Result<AccountRow, sqlx::Error> {
    sqlx::query_as::<_, AccountRow>(
        &format!(
            "INSERT INTO accounts (id, email, plan, created_at)
             VALUES ($1, $2, 'free', NOW())
             RETURNING {ACCOUNT_COLUMNS}"
        ),
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .fetch_one(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<AccountRow>, sqlx::Error> {
    sqlx::query_as::<_, AccountRow>(
        &format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE id = $1"),
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_stripe_customer_id(pool: &PgPool, stripe_customer_id: &str) -> Result<Option<AccountRow>, sqlx::Error> {
    sqlx::query_as::<_, AccountRow>(
        &format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE stripe_customer_id = $1"),
    )
    .bind(stripe_customer_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_google_id(pool: &PgPool, google_id: &str) -> Result<Option<AccountRow>, sqlx::Error> {
    sqlx::query_as::<_, AccountRow>(
        &format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE google_id = $1"),
    )
    .bind(google_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<AccountRow>, sqlx::Error> {
    sqlx::query_as::<_, AccountRow>(
        &format!("SELECT {ACCOUNT_COLUMNS} FROM accounts WHERE email = $1"),
    )
    .bind(email)
    .fetch_optional(pool)
    .await
}

pub async fn link_google_id(pool: &PgPool, account_id: Uuid, google_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE accounts SET google_id = $1 WHERE id = $2")
        .bind(google_id)
        .bind(account_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn create_with_google(
    pool: &PgPool,
    email: &str,
    google_id: &str,
) -> Result<AccountRow, sqlx::Error> {
    sqlx::query_as::<_, AccountRow>(
        &format!(
            "INSERT INTO accounts (id, email, google_id, plan, created_at)
             VALUES ($1, $2, $3, 'free', NOW())
             RETURNING {ACCOUNT_COLUMNS}"
        ),
    )
    .bind(Uuid::new_v4())
    .bind(email)
    .bind(google_id)
    .fetch_one(pool)
    .await
}

pub async fn update_stripe_customer_id(pool: &PgPool, id: Uuid, stripe_customer_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE accounts SET stripe_customer_id = $1 WHERE id = $2")
        .bind(stripe_customer_id)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Atomically deduct from balance. Returns new balance, or None if insufficient funds.
pub async fn deduct_balance(
    pool: &PgPool,
    id: Uuid,
    amount_cents: i64,
    description: &str,
    head_id: Option<Uuid>,
) -> Result<Option<i64>, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let row: Option<(i64,)> = sqlx::query_as(
        "UPDATE accounts SET balance_cents = balance_cents - $2 WHERE id = $1 AND balance_cents >= $2 RETURNING balance_cents"
    )
    .bind(id)
    .bind(amount_cents)
    .fetch_optional(&mut *tx)
    .await?;

    let new_balance = match row {
        Some((b,)) => b,
        None => {
            tx.rollback().await?;
            return Ok(None);
        }
    };

    sqlx::query(
        "INSERT INTO balance_transactions (id, account_id, amount_cents, balance_after, description, head_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())"
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(-amount_cents)
    .bind(new_balance)
    .bind(description)
    .bind(head_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Some(new_balance))
}

/// Credit balance (e.g. from Stripe top-up). Returns new balance.
pub async fn credit_balance(
    pool: &PgPool,
    id: Uuid,
    amount_cents: i64,
    description: &str,
    stripe_session_id: Option<&str>,
) -> Result<i64, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let (new_balance,): (i64,) = sqlx::query_as(
        "UPDATE accounts SET balance_cents = balance_cents + $2 WHERE id = $1 RETURNING balance_cents"
    )
    .bind(id)
    .bind(amount_cents)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO balance_transactions (id, account_id, amount_cents, balance_after, description, stripe_session_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())"
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(amount_cents)
    .bind(new_balance)
    .bind(description)
    .bind(stripe_session_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(new_balance)
}

#[derive(Debug, sqlx::FromRow)]
pub struct BalanceTransactionRow {
    pub id: Uuid,
    pub amount_cents: i64,
    pub balance_after: i64,
    pub description: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn list_balance_transactions(
    pool: &PgPool,
    account_id: Uuid,
    limit: i64,
) -> Result<Vec<BalanceTransactionRow>, sqlx::Error> {
    sqlx::query_as::<_, BalanceTransactionRow>(
        "SELECT id, amount_cents, balance_after, description, created_at
         FROM balance_transactions WHERE account_id = $1
         ORDER BY created_at DESC LIMIT $2"
    )
    .bind(account_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}
