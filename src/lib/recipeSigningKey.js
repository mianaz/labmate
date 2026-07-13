// Pinned ed25519 public key for verifying the remote recipe manifest published by
// mianaz/labmate-recipes (dist/manifest.json). This is the trust anchor: the app
// only ingests a remote recipe library whose manifest carries a valid signature
// from this key. The matching PRIVATE key lives ONLY in that repo's
// RECIPE_SIGNING_KEY GitHub Actions secret and is never in any repo.
//
// Key rotation = replace this constant and redeploy the app (an attacker who
// swaps the recipes repo cannot swap the key baked into the app bundle).
export const RECIPE_PUBKEY_HEX =
  '432b1c7431dc696c674cbbb01ddfb3cadfa4c9d10d469d96cdefb12906e7a09f';
