/**
 * Convert lovelace to ADA with specified decimal places.
 */
export function lovelaceToAda(lovelace: number, decimals = 6): string {
  return (lovelace / 1_000_000).toFixed(decimals);
}
