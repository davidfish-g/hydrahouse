use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};

/// Cardano text envelope format (compatible with cardano-cli)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEnvelope {
    #[serde(rename = "type")]
    pub envelope_type: String,
    pub description: String,
    #[serde(rename = "cborHex")]
    pub cbor_hex: String,
}

#[derive(Debug, Clone)]
pub struct CardanoKeyPair {
    pub signing_key: TextEnvelope,
    pub verification_key: TextEnvelope,
}

/// Generate a Cardano Ed25519 key pair in the text envelope format
/// used by cardano-cli.
///
/// The CBOR encoding wraps the raw 32-byte key in a CBOR byte string tag:
/// - Signing key: 5820 + 32 bytes hex
/// - Verification key: 5820 + 32 bytes hex
pub fn generate_key_pair() -> CardanoKeyPair {
    let signing = SigningKey::generate(&mut OsRng);
    let verifying = signing.verifying_key();

    let sk_hex = format!("5820{}", hex::encode(signing.to_bytes()));
    let vk_hex = format!("5820{}", hex::encode(verifying.to_bytes()));

    CardanoKeyPair {
        signing_key: TextEnvelope {
            envelope_type: "PaymentSigningKeyShelley_ed25519".into(),
            description: "Payment Signing Key".into(),
            cbor_hex: sk_hex,
        },
        verification_key: TextEnvelope {
            envelope_type: "PaymentVerificationKeyShelley_ed25519".into(),
            description: "Payment Verification Key".into(),
            cbor_hex: vk_hex,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_valid_keypair() {
        let kp = generate_key_pair();
        assert!(kp.signing_key.cbor_hex.starts_with("5820"));
        assert_eq!(kp.signing_key.cbor_hex.len(), 4 + 64); // "5820" + 32 bytes hex
        assert!(kp.verification_key.cbor_hex.starts_with("5820"));
        assert_eq!(kp.verification_key.cbor_hex.len(), 4 + 64);
    }
}
