//! AES-256-GCM encryption for key files at rest.
//!
//! When an encryption key is configured (HH_ENCRYPTION_KEY env var), all
//! signing key files written by the Docker orchestrator are encrypted.
//! Files start with a 4-byte magic header ("HHEK") followed by a 12-byte
//! nonce and the AES-256-GCM ciphertext + tag. Plaintext files (no magic)
//! are read as-is for backward compatibility.

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, AeadCore, Nonce};
use blake2::{Blake2s256, Digest};

const MAGIC: &[u8; 4] = b"HHEK";
const NONCE_LEN: usize = 12;

/// Derive a 256-bit AES key from an arbitrary passphrase using BLAKE2b.
pub fn derive_key(passphrase: &str) -> [u8; 32] {
    let mut hasher = Blake2s256::new();
    hasher.update(b"hydrahouse-key-encryption-v1:");
    hasher.update(passphrase.as_bytes());
    hasher.finalize().into()
}

/// Encrypt plaintext bytes and return `MAGIC || nonce || ciphertext`.
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("init cipher: {e}"))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| format!("encrypt: {e}"))?;

    let mut out = Vec::with_capacity(MAGIC.len() + NONCE_LEN + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypt a file produced by `encrypt`. If the data doesn't start with
/// MAGIC, it's assumed to be plaintext and returned as-is (backward compat).
pub fn decrypt(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < MAGIC.len() + NONCE_LEN || &data[..MAGIC.len()] != MAGIC {
        return Ok(data.to_vec());
    }

    let nonce_bytes = &data[MAGIC.len()..MAGIC.len() + NONCE_LEN];
    let ciphertext = &data[MAGIC.len() + NONCE_LEN..];

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("init cipher: {e}"))?;
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("decrypt: {e}"))
}

/// Read a key file from disk and decrypt if necessary.
pub fn read_key_file(path: &std::path::Path) -> Result<String, String> {
    let data = std::fs::read(path)
        .map_err(|e| format!("read {}: {e}", path.display()))?;

    match encryption_key_from_env() {
        Some(key) => {
            let plaintext = decrypt(&key, &data)?;
            String::from_utf8(plaintext)
                .map_err(|e| format!("invalid utf8 in {}: {e}", path.display()))
        }
        None => String::from_utf8(data)
            .map_err(|e| format!("invalid utf8 in {}: {e}", path.display())),
    }
}

/// Read a key file from disk asynchronously and decrypt if necessary.
pub async fn read_key_file_async(path: &std::path::Path) -> Result<String, String> {
    let data = tokio::fs::read(path)
        .await
        .map_err(|e| format!("read {}: {e}", path.display()))?;

    match encryption_key_from_env() {
        Some(key) => {
            let plaintext = decrypt(&key, &data)?;
            String::from_utf8(plaintext)
                .map_err(|e| format!("invalid utf8 in {}: {e}", path.display()))
        }
        None => String::from_utf8(data)
            .map_err(|e| format!("invalid utf8 in {}: {e}", path.display())),
    }
}

/// Returns the encryption key if the env var is configured.
pub fn encryption_key_from_env() -> Option<[u8; 32]> {
    let raw = std::env::var("HH_ENCRYPTION_KEY").ok()?;
    if raw.is_empty() {
        return None;
    }
    Some(derive_key(&raw))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let key = derive_key("test-password");
        let plaintext = b"secret signing key data";
        let encrypted = encrypt(&key, plaintext).unwrap();
        assert_ne!(encrypted, plaintext);
        assert_eq!(&encrypted[..4], MAGIC);
        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn plaintext_passthrough() {
        let key = derive_key("test-password");
        let plaintext = b"not encrypted at all";
        let result = decrypt(&key, plaintext).unwrap();
        assert_eq!(result, plaintext);
    }
}
