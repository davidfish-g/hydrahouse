fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: derive_address <cborHex>");
        eprintln!("Example: derive_address 5820abcdef...");
        std::process::exit(1);
    }
    let cbor_hex = &args[1];
    let raw_sk_hex = cbor_hex
        .strip_prefix("5820")
        .expect("cborHex must start with 5820");
    let sk_bytes: [u8; 32] = hex::decode(raw_sk_hex)
        .expect("invalid hex")
        .try_into()
        .expect("must be 32 bytes");
    let sk = ed25519_dalek::SigningKey::from_bytes(&sk_bytes);
    let vk = sk.verifying_key();
    let vk_cbor = format!("5820{}", hex::encode(vk.to_bytes()));
    let addr = hh_keys::bech32::vk_cbor_to_address(&vk_cbor, true).unwrap();
    println!("Platform wallet address (testnet): {addr}");
    println!("VK cborHex: {vk_cbor}");
}
