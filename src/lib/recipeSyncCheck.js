// Would the app's Refresh accept the published library, given the recipes.json
// this app ships? Mirrors RecipeProvider.refresh(): the manifest must verify
// and the published library must still contain every bundled recipe id (user
// favorites, step progress and notebook entries are keyed by id). Pure, so it
// is unit-tested; scripts/recipes-sync.mjs does the fetching.

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {{ bundleBytes: Uint8Array, remoteBytes: Uint8Array, manifest: object,
 *           verify: (bytes, manifest) => Promise<{ok, version?, reason?}> }} o
 * @returns {Promise<{ ok, reason?, version?, missing: string[], added: string[], identical: boolean }>}
 *   reason: 'unverified' | 'bad_payload' | 'behind'
 */
export async function checkPublishedLibrary({ bundleBytes, remoteBytes, manifest, verify }) {
  const v = await verify(remoteBytes, manifest);
  if (!v.ok) return { ok: false, reason: 'unverified', detail: v.reason, missing: [], added: [], identical: false };
  let remote;
  let bundle;
  try {
    remote = JSON.parse(new TextDecoder().decode(remoteBytes));
    bundle = JSON.parse(new TextDecoder().decode(bundleBytes));
  } catch {
    return { ok: false, reason: 'bad_payload', missing: [], added: [], identical: false };
  }
  if (!Array.isArray(remote) || !Array.isArray(bundle)) return { ok: false, reason: 'bad_payload', missing: [], added: [], identical: false };
  const remoteIds = new Set(remote.map((r) => r?.id));
  const bundleIds = new Set(bundle.map((r) => r?.id));
  const missing = [...bundleIds].filter((id) => !remoteIds.has(id));
  const added = [...remoteIds].filter((id) => !bundleIds.has(id));
  const identical = (await sha256Hex(bundleBytes)) === manifest.sha256;
  return { ok: missing.length === 0, reason: missing.length ? 'behind' : undefined, version: v.version, missing, added, identical };
}
