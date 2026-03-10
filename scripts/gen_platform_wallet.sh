#!/usr/bin/env bash
# Generate a Cardano Ed25519 key pair for the HydraHouse platform wallet.
# Outputs the signing key cborHex (for HH_PLATFORM_WALLET_SK) and the testnet address.

set -e

SK_FILE=$(mktemp)
VK_FILE=$(mktemp)
trap "rm -f $SK_FILE $VK_FILE" EXIT

# Generate 32 random bytes for the signing key
SK_RAW=$(openssl rand -hex 32)
SK_CBOR="5820${SK_RAW}"

# Derive the verification key using ed25519
# We'll use a simple Rust one-liner via cargo
cd "$(dirname "$0")/.."

cat <<RUST > /tmp/hh_gen_wallet.rs
fn main() {
    let sk_hex = "${SK_RAW}";
    let sk_bytes: [u8; 32] = hex::decode(sk_hex).unwrap().try_into().unwrap();
    let sk = ed25519_dalek::SigningKey::from_bytes(&sk_bytes);
    let vk = sk.verifying_key();
    let vk_cbor = format!("5820{}", hex::encode(vk.to_bytes()));
    println!("SK_CBOR=5820{}", sk_hex);
    println!("VK_CBOR={}", vk_cbor);
}
RUST

echo "Platform Wallet Signing Key (cborHex):"
echo "  ${SK_CBOR}"
echo ""
echo "Set this in your .env:"
echo "  HH_PLATFORM_WALLET_SK=${SK_CBOR}"
echo ""
echo "Then fund the derived address with tADA from the faucet."
echo "The address will be printed when the API server starts."
