//! Minimal Cardano transaction builder for simple ADA payments.
//! Supports Babbage-era transactions with pure-ADA inputs and outputs.
//! Only handles the subset needed for platform wallet funding operations.

use blake2::digest::{Update, VariableOutput};
use ed25519_dalek::{Signer, SigningKey};

/// Estimated fee for simple transactions (used for pre-checks before exact calculation).
pub const ESTIMATED_FEE_LOVELACE: u64 = 200_000;

/// Minimum UTxO value on Cardano (protocol parameter).
pub const MIN_UTXO_LOVELACE: u64 = 2_000_000;

/// A UTxO reference (transaction hash + output index).
#[derive(Debug, Clone)]
pub struct TxIn {
    pub tx_hash: [u8; 32],
    pub output_index: u32,
}

/// A transaction output (address + lovelace amount).
#[derive(Debug, Clone)]
pub struct TxOut {
    pub address: Vec<u8>,
    pub lovelace: u64,
}

/// Build and sign a simple ADA payment transaction.
/// Returns the CBOR-encoded signed transaction bytes.
pub fn build_and_sign_tx(
    inputs: &[TxIn],
    outputs: &[TxOut],
    fee: u64,
    signing_key: &SigningKey,
) -> Vec<u8> {
    let body_bytes = encode_tx_body(inputs, outputs, fee);
    let body_hash = blake2b_256(&body_bytes);
    let signature = signing_key.sign(&body_hash);
    let vkey = signing_key.verifying_key();

    let mut tx = Vec::with_capacity(body_bytes.len() + 128);
    cbor_array(&mut tx, 4);
    tx.extend_from_slice(&body_bytes);

    // Witnesses: { 0: [[vkey, signature]] }
    cbor_map(&mut tx, 1);
    cbor_uint(&mut tx, 0);
    cbor_array(&mut tx, 1);
    cbor_array(&mut tx, 2);
    cbor_bytes(&mut tx, vkey.as_bytes());
    cbor_bytes(&mut tx, &signature.to_bytes());

    tx.push(0xf5); // true (is_valid)
    tx.push(0xf6); // null (auxiliary data)

    tx
}

fn encode_tx_body(inputs: &[TxIn], outputs: &[TxOut], fee: u64) -> Vec<u8> {
    let mut body = Vec::with_capacity(256);
    cbor_map(&mut body, 3);

    // key 0: inputs (set<transaction_input>) -- tag 258 + array
    cbor_uint(&mut body, 0);
    // CBOR tag 258 for set
    body.extend_from_slice(&[0xd9, 0x01, 0x02]);
    cbor_array(&mut body, inputs.len() as u64);
    for input in inputs {
        cbor_array(&mut body, 2);
        cbor_bytes(&mut body, &input.tx_hash);
        cbor_uint(&mut body, input.output_index as u64);
    }

    // key 1: outputs
    cbor_uint(&mut body, 1);
    cbor_array(&mut body, outputs.len() as u64);
    for output in outputs {
        encode_output(&mut body, output);
    }

    // key 2: fee
    cbor_uint(&mut body, 2);
    cbor_uint(&mut body, fee);

    body
}

fn encode_output(buf: &mut Vec<u8>, output: &TxOut) {
    // Babbage-era post-alonzo output format: map { 0: address, 1: value }
    // But legacy format (array) also accepted: [address, value]
    // Use legacy format for simplicity.
    cbor_array(buf, 2);
    cbor_bytes(buf, &output.address);
    cbor_uint(buf, output.lovelace);
}

fn blake2b_256(data: &[u8]) -> [u8; 32] {
    let mut hasher = blake2::Blake2bVar::new(32).unwrap();
    hasher.update(data);
    let mut hash = [0u8; 32];
    hasher.finalize_variable(&mut hash).unwrap();
    hash
}

/// Estimate the fee for a transaction.
/// Cardano fee formula: fee = a * tx_size + b
pub fn estimate_fee(input_count: usize, output_count: usize) -> u64 {
    let a: u64 = 44;
    let b: u64 = 155_381;
    let estimated_size = 50 + input_count * 44 + output_count * 65 + 102;
    a * estimated_size as u64 + b
}

// --- Minimal CBOR encoder (only the subset needed for Cardano transactions) ---

fn cbor_uint(buf: &mut Vec<u8>, value: u64) {
    encode_type_and_value(buf, 0, value);
}

fn cbor_bytes(buf: &mut Vec<u8>, data: &[u8]) {
    encode_type_and_value(buf, 2, data.len() as u64);
    buf.extend_from_slice(data);
}

fn cbor_array(buf: &mut Vec<u8>, len: u64) {
    encode_type_and_value(buf, 4, len);
}

fn cbor_map(buf: &mut Vec<u8>, len: u64) {
    encode_type_and_value(buf, 5, len);
}

fn encode_type_and_value(buf: &mut Vec<u8>, major: u8, value: u64) {
    let tag = major << 5;
    if value < 24 {
        buf.push(tag | value as u8);
    } else if value <= 0xff {
        buf.push(tag | 24);
        buf.push(value as u8);
    } else if value <= 0xffff {
        buf.push(tag | 25);
        buf.extend_from_slice(&(value as u16).to_be_bytes());
    } else if value <= 0xffff_ffff {
        buf.push(tag | 26);
        buf.extend_from_slice(&(value as u32).to_be_bytes());
    } else {
        buf.push(tag | 27);
        buf.extend_from_slice(&value.to_be_bytes());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cbor_uint_encoding() {
        let mut buf = Vec::new();
        cbor_uint(&mut buf, 0);
        assert_eq!(buf, vec![0x00]);

        buf.clear();
        cbor_uint(&mut buf, 23);
        assert_eq!(buf, vec![0x17]);

        buf.clear();
        cbor_uint(&mut buf, 24);
        assert_eq!(buf, vec![0x18, 0x18]);

        buf.clear();
        cbor_uint(&mut buf, 1000);
        assert_eq!(buf, vec![0x19, 0x03, 0xe8]);
    }

    #[test]
    fn cbor_bytes_encoding() {
        let mut buf = Vec::new();
        cbor_bytes(&mut buf, &[0x01, 0x02, 0x03]);
        assert_eq!(buf, vec![0x43, 0x01, 0x02, 0x03]);
    }

    #[test]
    fn can_build_and_sign_tx() {
        let sk = SigningKey::from_bytes(&[1u8; 32]);
        let tx = build_and_sign_tx(
            &[TxIn {
                tx_hash: [0xaa; 32],
                output_index: 0,
            }],
            &[TxOut {
                address: vec![0x60; 29],
                lovelace: 5_000_000,
            }],
            200_000,
            &sk,
        );
        // Transaction should start with 0x84 (CBOR array of 4)
        assert_eq!(tx[0], 0x84);
        assert!(tx.len() > 100);
    }
}
