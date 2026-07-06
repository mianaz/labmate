// ──────────────────────────────────────────────────────────────────────────────
// Agent turn loop — LLM call → tool_calls → permission gate → execute → feed back.
// ──────────────────────────────────────────────────────────────────────────────
//
// Provider-agnostic: the caller passes `callModel(messages, tools)` (an adapter
// around the owner proxy / BYOK / local model) so this module never talks to a
// network. That keeps the whole control flow — tool dispatch, the write
// permission gate, the anti-fabrication tool errors — unit-testable with a
// scripted fake model.
//
// Message shape is OpenAI-compatible:
//   assistant tool call → { role:'assistant', content, tool_calls:[{id, function:{name, arguments}}] }
//   tool result         → { role:'tool', tool_call_id, name, content:'<json>' }
// ──────────────────────────────────────────────────────────────────────────────

import { getToolSchemas, isWriteTool, executeTool, previewTool } from './tools.js';

const DEFAULT_MAX_STEPS = 8;

// Resolve a permission decision for one tool call.
// reads/compute → always auto. writes → permissions[name] ('auto'|'ask'|'off',
// default 'ask'); 'ask' consults requestPermission().
async function decide(name, args, { permissions, requestPermission, ctx, onPermissionChange }) {
  if (!isWriteTool(name)) return { allowed: true };

  const mode = permissions?.[name] || 'ask';
  if (mode === 'auto') return { allowed: true };
  if (mode === 'off') return { allowed: false, reason: 'disabled' };

  // mode === 'ask'
  if (typeof requestPermission !== 'function') return { allowed: false, reason: 'no_prompt' };
  const decision = await requestPermission({ name, args, preview: previewTool(name, args, ctx) });
  if (decision === 'remember') {
    onPermissionChange?.(name, 'auto');
    return { allowed: true };
  }
  return { allowed: decision === 'once', reason: decision === 'once' ? undefined : 'denied' };
}

function parseArgs(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

/**
 * Run one user turn to completion (through any number of tool round-trips).
 *
 * @param {object}   o
 * @param {Array}    o.messages    conversation so far (system + user + history)
 * @param {Function} o.callModel   async (messages, tools) => { content?, tool_calls? }
 * @param {object}   o.ctx         tool context (recipes, saveExperiment, …)
 * @param {object}   [o.permissions]        { [tool]: 'auto'|'ask'|'off' }
 * @param {Function} [o.requestPermission]  async ({name,args,preview}) => 'once'|'remember'|'deny'
 * @param {Function} [o.onPermissionChange] (name, mode) => void  (persist "remember")
 * @param {Function} [o.onEvent]   (event) => void  UI hook: assistant | tool_call | tool_result | permission_denied | done
 * @param {number}   [o.maxSteps]
 * @param {AbortSignal} [o.signal]  when aborted, the loop halts with stopReason 'aborted'
 * @returns {Promise<{messages:Array, finalText:string, steps:number, stopReason:string}>}
 */
export async function runAgentTurn(o) {
  const {
    messages, callModel, ctx = {},
    permissions = {}, requestPermission, onPermissionChange,
    onEvent = () => {}, maxSteps = DEFAULT_MAX_STEPS, signal,
  } = o;

  const tools = getToolSchemas();
  const convo = [...messages];
  let steps = 0;
  let finalText = '';
  let stopReason = 'end_turn';

  while (steps < maxSteps) {
    // User pressed Stop between turns — halt with well-formed history so far.
    if (signal?.aborted) { stopReason = 'aborted'; break; }
    steps += 1;

    let assistant;
    try {
      assistant = await callModel(convo, tools);
    } catch (err) {
      // A Stop aborts the in-flight request; treat it as a clean halt (not an
      // error) and leave the conversation exactly as it was before this turn.
      if (signal?.aborted || err?.name === 'AbortError') { stopReason = 'aborted'; break; }
      throw err;
    }
    const toolCalls = assistant?.tool_calls || [];
    const content = assistant?.content || '';

    // Record the assistant message verbatim (with any tool_calls) for the model's
    // own context on the next round.
    convo.push({ role: 'assistant', content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });
    if (content) onEvent({ type: 'assistant', content });

    if (!toolCalls.length) { finalText = content; stopReason = 'end_turn'; break; }

    for (const call of toolCalls) {
      const name = call.function?.name;
      const args = parseArgs(call.function?.arguments);
      onEvent({ type: 'tool_call', id: call.id, name, args });

      const verdict = await decide(name, args, { permissions, requestPermission, ctx, onPermissionChange });
      let result;
      if (!verdict.allowed) {
        result = { error: 'permission_denied', tool: name, reason: verdict.reason || 'denied' };
        onEvent({ type: 'permission_denied', id: call.id, name, reason: verdict.reason });
      } else {
        result = await executeTool(name, args, ctx);
        onEvent({ type: 'tool_result', id: call.id, name, result });
      }

      convo.push({
        role: 'tool',
        tool_call_id: call.id,
        name,
        content: JSON.stringify(result),
      });
    }

    if (steps >= maxSteps) { stopReason = 'max_steps'; break; }
  }

  onEvent({ type: 'done', stopReason, steps });
  return { messages: convo, finalText, steps, stopReason };
}

export { DEFAULT_MAX_STEPS };
