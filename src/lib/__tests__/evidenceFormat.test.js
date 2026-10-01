import { describe, it, expect } from 'vitest';
import { createEmptyMap, createNode, addNode, connect, nodeLabels, setNodePosition, updateNode } from '../evidence.js';
import {
  mapToJSON, mapToJSONString, mapFromJSON, contentHash, jsonFilename, EvidenceImportError, EVIDENCE_FORMAT,
} from '../evidenceFormat.js';

function sample() {
  let map = createEmptyMap({ title: 'Gene X and metastasis', description: 'Aim 1' });
  const add = (kind, patch) => { const n = createNode(kind, patch); map = addNode(map, n); return n.id; };
  const q = add('question', { text: 'Does X drive metastasis?' });
  const c = add('claim', { text: 'X promotes migration', note: 'in MDA-MB-231' });
  const e = add('evidence', { text: 'X is high in tumours', citation: 'PMID: 31234567' });
  const x = add('experiment', { text: 'Knock down X', predictIfTrue: 'slower closure', predictIfFalse: 'no change', controls: 'scrambled', protocolRef: 'western_blot' });
  const a = add('assumption', { text: 'siRNA is specific', origin: 'ai', reviewed: false });
  for (const [f, r, t] of [[c, 'answers', q], [e, 'supports', c], [x, 'tests', c], [a, 'premise', c]]) map = connect(map, f, t, r).map;
  return map;
}

describe('JSON export', () => {
  it('is self-describing and uses short ids and readable links', () => {
    const json = mapToJSON(sample(), { protocolName: () => 'Western Blot' });
    expect(json.format).toBe(EVIDENCE_FORMAT);
    expect(json.version).toBe(1);
    expect(Object.keys(json.guide.relations)).toEqual(['supports', 'contradicts', 'premise', 'tests', 'yields', 'answers']);
    expect(json.guide.relations.supports.from).toEqual(['evidence', 'claim']);
    expect(json.nodes.map((n) => n.id)).toEqual(['Q1', 'C1', 'E1', 'X1', 'A1']);
    expect(json.nodes[1]).toMatchObject({ kind: 'claim', conditions: 'in MDA-MB-231', status: 'supported', reviewed: true });
    expect(json.nodes[2]).toMatchObject({ source: 'literature', citation: 'PMID: 31234567' });
    expect(json.nodes[3]).toMatchObject({ expectIfHolds: 'slower closure', expectIfNot: 'no change', protocol: { id: 'western_blot', name: 'Western Blot' } });
    expect(json.links).toContainEqual({ from: 'E1', rel: 'supports', to: 'C1', reads: 'E1 supports C1' });
    expect(json.links).toContainEqual({ from: 'A1', rel: 'premise', to: 'C1', reads: 'A1 is a premise of C1' });
    expect(json.analysis.experimentsToRun).toEqual(['X1']);
    expect(json.analysis.issues.find((i) => i.code === 'premise_weak').nodes).toEqual(['C1', 'A1']);
    expect(JSON.parse(mapToJSONString(sample())).nodes).toHaveLength(5);
  });

  it('includes positions only for a hand-arranged map', () => {
    const map = sample();
    expect(mapToJSON(map).nodes[0].position).toBeUndefined();
    const moved = setNodePosition(map, map.nodes[0].id, 400, 300);
    expect(mapToJSON(moved).nodes[0].position).toEqual({ x: 400, y: 300 });
    expect(mapToJSON(moved).map.layout).toBe('manual');
  });

  it('names the file after the map', () => {
    expect(jsonFilename({ title: 'Gene X & metastasis' })).toBe('gene-x-metastasis.evidence.json');
  });
});

describe('JSON import', () => {
  it('round-trips a map into a new one, keeping review state of unchanged nodes', () => {
    const src = sample();
    const { map, report } = mapFromJSON(mapToJSONString(src));
    expect(map.id).not.toBe(src.id);
    expect(map.title).toBe('Gene X and metastasis');
    expect(report).toMatchObject({ nodes: 5, links: 4, needsReview: 1, droppedNodes: 0, droppedLinks: 0 });
    const labels = nodeLabels(map);
    const byLabel = Object.fromEntries(map.nodes.map((n) => [labels[n.id], n]));
    expect(byLabel.C1).toMatchObject({ text: 'X promotes migration', note: 'in MDA-MB-231', origin: 'user', reviewed: true });
    expect(byLabel.X1).toMatchObject({ predictIfTrue: 'slower closure', controls: 'scrambled', protocolRef: 'western_blot' });
    expect(byLabel.A1).toMatchObject({ origin: 'ai', reviewed: false });
    expect(map.edges.map((e) => `${labels[e.from]} ${e.rel} ${labels[e.to]}`).sort())
      .toEqual(['A1 premise C1', 'C1 answers Q1', 'E1 supports C1', 'X1 tests C1']);
  });

  it('sends nodes changed or added elsewhere (e.g. by a model) back for review', () => {
    const json = mapToJSON(sample());
    json.nodes[1].text = 'X strongly promotes migration'; // edited, hash no longer matches
    json.nodes.push({ id: 'E9', kind: 'evidence', text: 'New finding', source: 'literature', origin: 'user', reviewed: true }); // no hash
    json.links.push({ from: 'E9', rel: 'supports', to: 'C1' });
    const { map, report } = mapFromJSON(json);
    expect(report.needsReview).toBe(3); // A1 (was unreviewed), edited C1, new E9
    const c1 = map.nodes.find((n) => n.text === 'X strongly promotes migration');
    const e9 = map.nodes.find((n) => n.text === 'New finding');
    expect(c1).toMatchObject({ origin: 'import', reviewed: false });
    expect(e9).toMatchObject({ origin: 'import', reviewed: false });
    expect(map.edges).toHaveLength(5);
  });

  it('drops links that are not allowed and nodes it cannot read', () => {
    const json = mapToJSON(sample());
    json.links.push({ from: 'Q1', rel: 'supports', to: 'C1' }); // a question supports nothing
    json.links.push({ from: 'E1', rel: 'proves', to: 'C1' }); // unknown relation
    json.links.push({ from: 'Z1', rel: 'supports', to: 'C1' }); // unknown node
    json.nodes.push({ id: 'Y1', kind: 'hunch', text: '?' }, { kind: 'claim', text: 'no id' }, { id: 'C1', kind: 'claim', text: 'duplicate id' });
    const { report } = mapFromJSON(json);
    expect(report.droppedLinks).toBe(3);
    expect(report.droppedNodes).toBe(3);
    expect(report.links).toBe(4);
  });

  it('keeps hand-placed positions', () => {
    const src = sample();
    const moved = setNodePosition(src, src.nodes[1].id, 520, 140);
    const { map } = mapFromJSON(mapToJSON(moved));
    expect(map.manualLayout).toBe(true);
    expect(map.nodes[1].pos).toEqual({ x: 520, y: 140 });
  });

  it('accepts a ```json fenced block, as models often return', () => {
    const fenced = '```json\n' + mapToJSONString(sample()) + '\n```';
    expect(mapFromJSON(fenced).report.nodes).toBe(5);
  });

  it('rejects what is not an evidence map', () => {
    expect(() => mapFromJSON('{oops')).toThrow(EvidenceImportError);
    try { mapFromJSON('{oops'); } catch (e) { expect(e.code).toBe('parse'); }
    try { mapFromJSON({ format: 'something-else', nodes: [] }); } catch (e) { expect(e.code).toBe('format'); }
    try { mapFromJSON({ nodes: 'x' }); } catch (e) { expect(e.code).toBe('format'); }
    try { mapFromJSON({ nodes: [{ id: 'X', kind: 'nope' }] }); } catch (e) { expect(e.code).toBe('empty'); }
  });

  it('hashes what a node says, not its review state or position', () => {
    const n = createNode('claim', { text: 'a', note: 'b' });
    expect(contentHash({ ...n, reviewed: false, pos: { x: 1, y: 2 } })).toBe(contentHash(n));
    expect(contentHash({ ...n, text: 'a ' })).toBe(contentHash(n)); // trimmed
    expect(contentHash({ ...n, text: 'c' })).not.toBe(contentHash(n));
    expect(contentHash(updateNode({ nodes: [n], edges: [] }, n.id, { note: 'z' }).nodes[0])).not.toBe(contentHash(n));
  });
});
