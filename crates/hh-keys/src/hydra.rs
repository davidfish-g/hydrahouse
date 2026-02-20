use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};

/// Hydra key envelope format (compatible with hydra-node)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydraKeyEnvelope {
    #[serde(rename = "type")]
    pub envelope_type: String,
    pub description: String,
    #[serde(rename = "cborHex")]
    pub cbor_hex: String,
}

#[derive(Debug, Clone)]
pub struct HydraKeyPair {
    pub signing_key: HydraKeyEnvelope,
    pub verification_key: HydraKeyEnvelope,
}

/// Generate a Hydra Ed25519 key pair in the envelope format used by hydra-node.
pub fn generate_key_pair() -> HydraKeyPair {
    let signing = SigningKey::generate(&mut OsRng);
    let verifying = signing.verifying_key();

    let sk_hex = format!("5820{}", hex::encode(signing.to_bytes()));
    let vk_hex = format!("5820{}", hex::encode(verifying.to_bytes()));

    HydraKeyPair {
        signing_key: HydraKeyEnvelope {
            envelope_type: "HydraSigningKey_ed25519".into(),
            description: "Hydra Signing Key".into(),
            cbor_hex: sk_hex,
        },
        verification_key: HydraKeyEnvelope {
            envelope_type: "HydraVerificationKey_ed25519".into(),
            description: "Hydra Verification Key".into(),
            cbor_hex: vk_hex,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_valid_hydra_keypair() {
        let kp = generate_key_pair();
        assert!(kp.signing_key.cbor_hex.starts_with("5820"));
        assert_eq!(kp.signing_key.cbor_hex.len(), 4 + 64);
        assert_eq!(kp.signing_key.envelope_type, "HydraSigningKey_ed25519");
        assert_eq!(
            kp.verification_key.envelope_type,
            "HydraVerificationKey_ed25519"
        );
    }
}
