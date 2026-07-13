// ──────────────────────────────────────────────────────────────────────────────
// Egress boundary — the privacy layer between local tools and a NON-LOCAL model.
// ──────────────────────────────────────────────────────────────────────────────
//
// The agent loop feeds tool RESULTS back into the conversation, and each model
// round-trip re-sends the whole conversation. For the owner-proxy / cloud-BYOK
// lanes that means a tool result physically leaves the device. Tools whose
// result carries the user's private data are tagged `egress: 'local'` (see
// tools.js); this module redacts those results down to a privacy-safe summary
// before the conversation is handed to a non-local provider.
//
// The LOCAL lane (Ollama / LM Studio) must NOT call this — nothing leaves the
// device there, so the model may see the full result. The redaction is applied
// by the provider adapter, not the loop, so the app's own state and the chat UI
// still hold the complete, unredacted result.
//
// Pure: never mutates its input.
// ──────────────────────────────────────────────────────────────────────────────

import { toolEgress } from './tools.js';

// Per-tool redactors: keep just enough for the model to reason ("you have
// TRIzol in stock") without exporting freezer coordinates, quantities, or
// concentrations. A 'local' tool with no redactor has its payload withheld
// entirely (fail-closed).
const REDACTORS = {
  queryInventory(result) {
    if (!result || typeof result !== 'object') return result;
    const results = Array.isArray(result.results)
      ? result.results.map((r) => ({ name: r?.name || '', sampleType: r?.sampleType || 'other', inStock: true }))
      : [];
    return {
      count: result.count ?? results.length,
      results,
      _egress: 'redacted',
      note: 'Exact storage locations, quantities and concentrations are kept on-device and withheld from the AI provider. Tell the user to open the Inventory tab for precise locations.',
    };
  },
};

function redactToolContent(name, content) {
  const redactor = REDACTORS[name];
  let parsed;
  try { parsed = JSON.parse(content); } catch { parsed = null; }
  if (!redactor || parsed == null) {
    return JSON.stringify({ _egress: 'withheld', note: 'This result contains on-device data withheld from the AI provider.' });
  }
  return JSON.stringify(redactor(parsed));
}

/**
 * Return a copy of the conversation that is safe to send to a NON-LOCAL model
 * provider. Tool result messages whose tool is `egress: 'local'` are replaced
 * with a redacted summary; every other message (user / assistant / system, and
 * results from `shareable` tools) passes through unchanged.
 * @param {Array} messages OpenAI-shaped conversation
 * @returns {Array} a new array (input is never mutated)
 */
export function redactMessagesForEgress(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map((m) => {
    if (m?.role !== 'tool' || !m.name) return m;
    if (toolEgress(m.name) !== 'local') return m;
    return { ...m, content: redactToolContent(m.name, m.content) };
  });
}
