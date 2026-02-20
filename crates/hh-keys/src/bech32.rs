/// Minimal bech32 encoder for Cardano address derivation.
/// Avoids pulling in a full bech32 crate for a single use case.

const CHARSET: &[u8] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN: [u32; 5] = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

fn polymod(values: &[u8]) -> u32 {
    let mut chk: u32 = 1;
    for &v in values {
        let b = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ (v as u32);
        for (i, g) in GEN.iter().enumerate() {
            if (b >> i) & 1 == 1 {
                chk ^= g;
            }
        }
    }
    chk
}

fn hrp_expand(hrp: &str) -> Vec<u8> {
    let mut v: Vec<u8> = hrp.bytes().map(|b| b >> 5).collect();
    v.push(0);
    v.extend(hrp.bytes().map(|b| b & 31));
    v
}

fn create_checksum(hrp: &str, data: &[u8]) -> Vec<u8> {
    let mut values = hrp_expand(hrp);
    values.extend_from_slice(data);
    values.extend_from_slice(&[0, 0, 0, 0, 0, 0]);
    let pm = polymod(&values) ^ 1;
    (0..6).map(|i| ((pm >> (5 * (5 - i))) & 31) as u8).collect()
}

fn convert_bits(data: &[u8], from: u32, to: u32, pad: bool) -> Vec<u8> {
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    let mut ret = Vec::new();
    let maxv = (1u32 << to) - 1;
    for &value in data {
        acc = (acc << from) | (value as u32);
        bits += from;
        while bits >= to {
            bits -= to;
            ret.push(((acc >> bits) & maxv) as u8);
        }
    }
    if pad && bits > 0 {
        ret.push(((acc << (to - bits)) & maxv) as u8);
    }
    ret
}

fn bech32_encode(hrp: &str, data: &[u8]) -> String {
    let checksum = create_checksum(hrp, data);
    let mut result = format!("{hrp}1");
    for &d in data.iter().chain(checksum.iter()) {
        result.push(CHARSET[d as usize] as char);
    }
    result
}

/// Derive a Cardano enterprise address from a verification key's CBOR hex.
/// `cbor_hex` is the cborHex field from the TextEnvelope (e.g. "5820abcd...").
/// `testnet` controls whether to produce addr_test1v... or addr1v...
pub fn vk_cbor_to_address(cbor_hex: &str, testnet: bool) -> Result<String, String> {
    let raw_vk_hex = cbor_hex
        .strip_prefix("5820")
        .ok_or_else(|| "cborHex must start with 5820".to_string())?;

    let raw_vk = hex::decode(raw_vk_hex)
        .map_err(|e| format!("invalid hex: {e}"))?;

    if raw_vk.len() != 32 {
        return Err(format!("expected 32-byte key, got {}", raw_vk.len()));
    }

    use blake2::digest::{Update, VariableOutput};
    let mut hasher = blake2::Blake2bVar::new(28)
        .map_err(|e| format!("blake2b init: {e}"))?;
    hasher.update(&raw_vk);
    let mut keyhash = [0u8; 28];
    hasher.finalize_variable(&mut keyhash)
        .map_err(|e| format!("blake2b finalize: {e}"))?;

    let header = if testnet { 0x60u8 } else { 0x61u8 };
    let mut payload = vec![header];
    payload.extend_from_slice(&keyhash);

    let data_5bit = convert_bits(&payload, 8, 5, true);
    let hrp = if testnet { "addr_test" } else { "addr" };

    Ok(bech32_encode(hrp, &data_5bit))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn testnet_address_derivation() {
        let vk_cbor = "5820f04aa4fc28bc4dfef732bc34874cef442fedae2d7d4723583d43480ccd4392d3";
        let addr = vk_cbor_to_address(vk_cbor, true).unwrap();
        assert!(addr.starts_with("addr_test1v"));
        assert!(addr.len() > 50);
    }
}
