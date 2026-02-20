use clap::Parser;

mod commands;

#[derive(Parser)]
#[command(name = "hydrahouse", about = "HydraHouse CLI — manage Hydra heads")]
struct Cli {
    /// API server URL
    #[arg(long, env = "HYDRAHOUSE_API_URL", default_value = "http://localhost:3000")]
    api_url: String,

    /// API key for authentication
    #[arg(long, env = "HYDRAHOUSE_API_KEY")]
    api_key: Option<String>,

    #[command(subcommand)]
    command: commands::Command,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    let client = commands::ApiClient::new(
        cli.api_url,
        cli.api_key.unwrap_or_default(),
    );

    commands::run(client, cli.command).await
}
