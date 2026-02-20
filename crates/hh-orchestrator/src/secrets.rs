use k8s_openapi::api::core::v1::Secret;
use k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta;
use k8s_openapi::ByteString;
use kube::api::{Api, DeleteParams, PostParams};
use kube::Client;
use std::collections::BTreeMap;
use uuid::Uuid;

pub fn secret_name(head_id: Uuid, node_index: u32) -> String {
    format!("hh-{}-keys-{}", head_id.as_simple(), node_index)
}

pub fn blockfrost_secret_name(head_id: Uuid) -> String {
    format!("hh-{}-blockfrost", head_id.as_simple())
}

pub fn protocol_params_configmap_name(head_id: Uuid) -> String {
    format!("hh-{}-protocol-params", head_id.as_simple())
}

/// Build a K8s Secret containing all keys for a single hydra-node participant.
pub fn build_keys_secret(
    head_id: Uuid,
    node_index: u32,
    cardano_sk_json: &str,
    cardano_vk_jsons: &[String],
    hydra_sk_json: &str,
    hydra_vk_jsons: &[String],
) -> Secret {
    let mut data = BTreeMap::new();

    data.insert(
        "cardano.sk".into(),
        ByteString(cardano_sk_json.as_bytes().to_vec()),
    );

    for (i, vk) in cardano_vk_jsons.iter().enumerate() {
        data.insert(
            format!("cardano-peer-{i}.vk"),
            ByteString(vk.as_bytes().to_vec()),
        );
    }

    data.insert(
        "hydra.sk".into(),
        ByteString(hydra_sk_json.as_bytes().to_vec()),
    );

    for (i, vk) in hydra_vk_jsons.iter().enumerate() {
        data.insert(
            format!("hydra-peer-{i}.vk"),
            ByteString(vk.as_bytes().to_vec()),
        );
    }

    Secret {
        metadata: ObjectMeta {
            name: Some(secret_name(head_id, node_index)),
            labels: Some(BTreeMap::from([
                ("app".into(), "hydrahouse".into()),
                ("head-id".into(), head_id.to_string()),
            ])),
            ..Default::default()
        },
        data: Some(data),
        ..Default::default()
    }
}

/// Build a K8s Secret containing the Blockfrost project ID.
pub fn build_blockfrost_secret(head_id: Uuid, project_id: &str) -> Secret {
    let mut data = BTreeMap::new();
    data.insert(
        "blockfrost-project.txt".into(),
        ByteString(project_id.as_bytes().to_vec()),
    );

    Secret {
        metadata: ObjectMeta {
            name: Some(blockfrost_secret_name(head_id)),
            labels: Some(BTreeMap::from([
                ("app".into(), "hydrahouse".into()),
                ("head-id".into(), head_id.to_string()),
            ])),
            ..Default::default()
        },
        data: Some(data),
        ..Default::default()
    }
}

pub async fn create_secret(client: &Client, namespace: &str, secret: &Secret) -> anyhow::Result<()> {
    let secrets: Api<Secret> = Api::namespaced(client.clone(), namespace);
    secrets.create(&PostParams::default(), secret).await?;
    Ok(())
}

pub async fn delete_secrets_for_head(
    client: &Client,
    namespace: &str,
    head_id: Uuid,
    node_count: u32,
) -> anyhow::Result<()> {
    let secrets: Api<Secret> = Api::namespaced(client.clone(), namespace);
    let dp = DeleteParams::default();

    for i in 0..node_count {
        let _ = secrets.delete(&secret_name(head_id, i), &dp).await;
    }
    let _ = secrets.delete(&blockfrost_secret_name(head_id), &dp).await;

    Ok(())
}
