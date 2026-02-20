use k8s_openapi::api::core::v1::{
    Container, ContainerPort, Pod, PodSpec, SecretVolumeSource, Service, ServicePort, ServiceSpec,
    Volume, VolumeMount,
};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::ObjectMeta;
use k8s_openapi::apimachinery::pkg::util::intstr::IntOrString;
use kube::api::{Api, DeleteParams, PostParams};
use kube::Client;
use std::collections::BTreeMap;
use uuid::Uuid;

pub const API_PORT: i32 = 4001;
pub const PEER_PORT: i32 = 5001;
pub const MONITORING_PORT: i32 = 6001;

pub fn pod_name(head_id: Uuid, node_index: u32) -> String {
    format!("hh-{}-node-{}", head_id.as_simple(), node_index)
}

pub fn service_name(head_id: Uuid, node_index: u32) -> String {
    format!("hh-{}-svc-{}", head_id.as_simple(), node_index)
}

fn labels(head_id: Uuid, node_index: u32) -> BTreeMap<String, String> {
    BTreeMap::from([
        ("app".into(), "hydrahouse".into()),
        ("head-id".into(), head_id.to_string()),
        ("node-index".into(), node_index.to_string()),
    ])
}

pub fn build_pod(
    head_id: Uuid,
    node_index: u32,
    image: &str,
    args: Vec<String>,
    keys_secret_name: &str,
    blockfrost_secret_name: &str,
) -> Pod {
    Pod {
        metadata: ObjectMeta {
            name: Some(pod_name(head_id, node_index)),
            labels: Some(labels(head_id, node_index)),
            ..Default::default()
        },
        spec: Some(PodSpec {
            containers: vec![Container {
                name: "hydra-node".into(),
                image: Some(image.into()),
                args: Some(args),
                ports: Some(vec![
                    ContainerPort {
                        container_port: API_PORT,
                        name: Some("api".into()),
                        ..Default::default()
                    },
                    ContainerPort {
                        container_port: PEER_PORT,
                        name: Some("peer".into()),
                        ..Default::default()
                    },
                    ContainerPort {
                        container_port: MONITORING_PORT,
                        name: Some("metrics".into()),
                        ..Default::default()
                    },
                ]),
                volume_mounts: Some(vec![
                    VolumeMount {
                        name: "keys".into(),
                        mount_path: "/keys".into(),
                        read_only: Some(true),
                        ..Default::default()
                    },
                    VolumeMount {
                        name: "blockfrost".into(),
                        mount_path: "/blockfrost".into(),
                        read_only: Some(true),
                        ..Default::default()
                    },
                ]),
                ..Default::default()
            }],
            volumes: Some(vec![
                Volume {
                    name: "keys".into(),
                    secret: Some(SecretVolumeSource {
                        secret_name: Some(keys_secret_name.into()),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
                Volume {
                    name: "blockfrost".into(),
                    secret: Some(SecretVolumeSource {
                        secret_name: Some(blockfrost_secret_name.into()),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
            ]),
            restart_policy: Some("Always".into()),
            ..Default::default()
        }),
        ..Default::default()
    }
}

pub fn build_service(head_id: Uuid, node_index: u32) -> Service {
    Service {
        metadata: ObjectMeta {
            name: Some(service_name(head_id, node_index)),
            labels: Some(labels(head_id, node_index)),
            ..Default::default()
        },
        spec: Some(ServiceSpec {
            selector: Some(labels(head_id, node_index)),
            ports: Some(vec![
                ServicePort {
                    name: Some("api".into()),
                    port: API_PORT,
                    target_port: Some(IntOrString::Int(API_PORT)),
                    ..Default::default()
                },
                ServicePort {
                    name: Some("peer".into()),
                    port: PEER_PORT,
                    target_port: Some(IntOrString::Int(PEER_PORT)),
                    ..Default::default()
                },
            ]),
            ..Default::default()
        }),
        ..Default::default()
    }
}

pub async fn create_pod(client: &Client, namespace: &str, pod: &Pod) -> anyhow::Result<()> {
    let pods: Api<Pod> = Api::namespaced(client.clone(), namespace);
    pods.create(&PostParams::default(), pod).await?;
    Ok(())
}

pub async fn create_service(client: &Client, namespace: &str, svc: &Service) -> anyhow::Result<()> {
    let services: Api<Service> = Api::namespaced(client.clone(), namespace);
    services.create(&PostParams::default(), svc).await?;
    Ok(())
}

pub async fn delete_head_resources(
    client: &Client,
    namespace: &str,
    head_id: Uuid,
    node_count: u32,
) -> anyhow::Result<()> {
    let pods: Api<Pod> = Api::namespaced(client.clone(), namespace);
    let services: Api<Service> = Api::namespaced(client.clone(), namespace);
    let dp = DeleteParams::default();

    for i in 0..node_count {
        let _ = pods.delete(&pod_name(head_id, i), &dp).await;
        let _ = services.delete(&service_name(head_id, i), &dp).await;
    }

    super::secrets::delete_secrets_for_head(client, namespace, head_id, node_count).await?;

    Ok(())
}
