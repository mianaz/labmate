import { describe, it, expect } from 'vitest';
import {
  createEmptyMap, createNode, addNode, updateNode, removeNode, connect, disconnect, moveNode,
  allowedRelations, linkOptions, nodeLabels, claimStatuses, analyzeMap,
  splitSentences, findCitation, guessKind, splitIntoPropositions, nodesFromSplit,
  experimentEntrySeed, recordOutcome, mapToMarkdown, mapFilename, layoutGraph,
} from '../evidence.js';

// Build a map from [kind, text, extra?] tuples; returns { map, ids } where ids
// is keyed by the short label the map will show (C1, E1, …).
function build(spec, links = []) {
  let map = createEmptyMap({ title: 'Test map' });
  for (const [kind, text, extra] of spec) map = addNode(map, createNode(kind, { text, ...(extra || {}) }));
  const labels = nodeLabels(map);
  const ids = Object.fromEntries(Object.entries(labels).map(([id, l]) => [l, id]));
  for (const [from, rel, to] of links) {
    const r = connect(map, ids[from], ids[to], rel);
    if (r.error) throw new Error(`bad link ${from} ${rel} ${to}: ${r.error}`);
    map = r.map;
  }
  return { map, ids };
}

describe('relations', () => {
  it('only allows links that make sense for the two kinds', () => {
    expect(allowedRelations('evidence', 'claim')).toEqual(['supports', 'contradicts']);
    expect(allowedRelations('experiment', 'claim')).toEqual(['tests']);
    expect(allowedRelations('experiment', 'evidence')).toEqual(['yields']);
    expect(allowedRelations('assumption', 'claim')).toEqual(['premise']);
    expect(allowedRelations('claim', 'question')).toEqual(['answers']);
    expect(allowedRelations('question', 'claim')).toEqual([]);
    expect(allowedRelations('evidence', 'evidence')).toEqual([]);
  });

  it('linkOptions offers both directions', () => {
    const c = createNode('claim', { text: 'c' });
    const e = createNode('evidence', { text: 'e' });
    const opts = linkOptions(c, e);
    expect(opts).toEqual([
      { from: e.id, to: c.id, rel: 'supports' },
      { from: e.id, to: c.id, rel: 'contradicts' },
    ]);
    expect(linkOptions(c, c)).toEqual([]);
  });

  it('connect refuses invalid, self and missing links', () => {
    const { map, ids } = build([['claim', 'c'], ['question', 'q']]);
    expect(connect(map, ids.C1, ids.C1, 'supports').error).toBe('self');
    expect(connect(map, ids.Q1, ids.C1, 'answers').error).toBe('invalid');
    expect(connect(map, ids.C1, 'nope', 'answers').error).toBe('missing');
    expect(connect(map, ids.C1, ids.Q1, 'answers').error).toBeUndefined();
  });

  it('one link per ordered pair: re-linking replaces the relation', () => {
    const { map, ids } = build([['claim', 'c'], ['evidence', 'e']], [['E1', 'supports', 'C1']]);
    const next = connect(map, ids.E1, ids.C1, 'contradicts').map;
    expect(next.edges).toHaveLength(1);
    expect(next.edges[0].rel).toBe('contradicts');
    expect(disconnect(next, next.edges[0].id).edges).toHaveLength(0);
  });

  it('removing a node removes its links; a kind change drops links that no longer fit', () => {
    const { map, ids } = build(
      [['claim', 'c'], ['evidence', 'e'], ['question', 'q']],
      [['E1', 'supports', 'C1'], ['C1', 'answers', 'Q1']],
    );
    expect(removeNode(map, ids.E1).edges).toHaveLength(1);
    const asExperiment = updateNode(map, ids.E1, { kind: 'experiment' });
    expect(asExperiment.edges.map((e) => e.rel)).toEqual(['answers']);
    const node = asExperiment.nodes.find((n) => n.id === ids.E1);
    expect(node.kind).toBe('experiment');
    expect(node.predictIfTrue).toBe('');
  });

  it('labels number nodes per kind and moveNode reorders within a kind', () => {
    const { map, ids } = build([['claim', 'a'], ['evidence', 'e'], ['claim', 'b']]);
    expect(nodeLabels(map)).toEqual({ [ids.C1]: 'C1', [ids.E1]: 'E1', [ids.C2]: 'C2' });
    const moved = moveNode(map, ids.C2, -1);
    expect(moved.nodes.map((n) => n.text)).toEqual(['b', 'e', 'a']);
    expect(moveNode(moved, ids.C2, -1)).toBe(moved); // already first claim
  });
});

describe('claim status', () => {
  it('supported / contested / refuted / testing / gap', () => {
    const { map, ids } = build(
      [
        ['claim', 'supported'], ['claim', 'contested'], ['claim', 'refuted'], ['claim', 'testing'], ['claim', 'gap'],
        ['evidence', 'e1'], ['evidence', 'e2'], ['experiment', 'x'],
      ],
      [
        ['E1', 'supports', 'C1'],
        ['E1', 'supports', 'C2'], ['E2', 'contradicts', 'C2'],
        ['E2', 'contradicts', 'C3'],
        ['X1', 'tests', 'C4'],
      ],
    );
    const s = claimStatuses(map);
    expect([s[ids.C1], s[ids.C2], s[ids.C3], s[ids.C4], s[ids.C5]])
      .toEqual(['supported', 'contested', 'refuted', 'testing', 'gap']);
  });

  it('a chain of claims is only as good as its weakest link', () => {
    const { map, ids } = build(
      [['claim', 'main'], ['claim', 'sub'], ['evidence', 'e']],
      [['C2', 'supports', 'C1']],
    );
    expect(claimStatuses(map)[ids.C1]).toBe('gap');
    const supported = connect(map, ids.E1, ids.C2, 'supports').map;
    expect(claimStatuses(supported)[ids.C1]).toBe('supported');
  });

  it('circular support is reported and does not count as support', () => {
    const { map, ids } = build(
      [['claim', 'a'], ['claim', 'b']],
      [['C1', 'supports', 'C2'], ['C2', 'supports', 'C1']],
    );
    const s = claimStatuses(map);
    expect(s[ids.C1]).toBe('gap');
    expect(s[ids.C2]).toBe('gap');
    const cycles = analyzeMap(map).issues.filter((i) => i.code === 'cycle');
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0].nodeIds)).toEqual(new Set([ids.C1, ids.C2]));
    expect(cycles[0].severity).toBe('danger');
  });
});

describe('analyzeMap (logic check)', () => {
  it('flags the gaps a reviewer would ask about', () => {
    const { map, ids } = build(
      [
        ['question', 'q'], ['claim', 'c'], ['assumption', 'a'],
        ['evidence', 'dangling'], ['evidence', 'no source', { source: 'literature' }],
        ['experiment', 'x'],
      ],
      [['E2', 'supports', 'C1']],
    );
    const codes = (id) => analyzeMap(map).issues.filter((i) => i.nodeId === id).map((i) => i.code).sort();
    expect(codes(ids.Q1)).toEqual(['question_unanswered']);
    expect(codes(ids.A1)).toEqual(['assumption_untested', 'assumption_unused']);
    expect(codes(ids.E1)).toEqual(['evidence_dangling', 'evidence_no_source']);
    expect(codes(ids.E2)).toEqual(['evidence_no_source']);
    expect(codes(ids.X1)).toEqual(['exp_no_controls', 'exp_no_prediction', 'exp_no_target']);
    expect(codes(ids.C1)).toEqual([]);
  });

  it('points at the weak premise rather than calling the claim a plain gap', () => {
    const { map, ids } = build(
      [['claim', 'main'], ['assumption', 'antibody is specific'], ['evidence', 'e']],
      [['A1', 'premise', 'C1'], ['E1', 'supports', 'C1']],
    );
    const issue = analyzeMap(map).issues.find((i) => i.nodeId === ids.C1);
    expect(issue.code).toBe('premise_weak');
    expect(issue.nodeIds).toEqual([ids.A1]);
  });

  it('sorts issues most severe first and marks AI/import nodes for review', () => {
    const { map } = build(
      [['claim', 'a', { origin: 'ai', reviewed: false }], ['claim', 'b'], ['evidence', 'e']],
      [['C2', 'supports', 'C1'], ['C1', 'supports', 'C2']],
    );
    const { issues } = analyzeMap(map);
    expect(issues[0].code).toBe('cycle');
    expect(issues.some((i) => i.code === 'unreviewed')).toBe(true);
  });

  it('reads notebook status for experiments and asks for the outcome when done', () => {
    const { map, ids } = build(
      [['claim', 'c'], ['experiment', 'x', { experimentId: 'exp_1', predictIfTrue: 'up', predictIfFalse: 'flat', controls: 'scramble' }]],
      [['X1', 'tests', 'C1']],
    );
    const running = analyzeMap(map, { experimentsById: { exp_1: { id: 'exp_1', status: 'in-progress' } } });
    expect(running.experiments[0]).toMatchObject({ stage: 'in-progress', designed: true, targets: [ids.C1] });
    expect(running.issues.map((i) => i.code)).not.toContain('exp_done_no_outcome');
    const done = analyzeMap(map, { experimentsById: { exp_1: { id: 'exp_1', status: 'completed' } } });
    expect(done.issues.map((i) => i.code)).toContain('exp_done_no_outcome');
    expect(analyzeMap(map).experiments[0].stage).toBe('missing');
  });

  it('counts claims by status and open experiments', () => {
    const { map } = build(
      [['claim', 'a'], ['claim', 'b'], ['evidence', 'e'], ['experiment', 'x']],
      [['E1', 'supports', 'C1'], ['X1', 'tests', 'C2']],
    );
    const { counts, gaps } = analyzeMap(map);
    expect(counts).toMatchObject({ claim: 2, claims_supported: 1, claims_testing: 1, claims_gap: 0, experimentsOpen: 1 });
    expect(gaps).toEqual([]);
  });
});

describe('splitting a draft', () => {
  it('splits English sentences without breaking on abbreviations or decimals', () => {
    const text = 'Gene X was 2.5-fold higher in tumours (Smith et al., 2020). We found that knockdown reduced migration, e.g. in wound assays. Does X act through Y?';
    expect(splitSentences(text)).toEqual([
      'Gene X was 2.5-fold higher in tumours (Smith et al., 2020).',
      'We found that knockdown reduced migration, e.g. in wound assays.',
      'Does X act through Y?',
    ]);
  });

  it('splits Chinese sentences and bullet lists', () => {
    expect(splitSentences('X 基因在肿瘤中高表达[1]。敲低 X 后细胞迁移减少。X 是否通过 Y 起作用？')).toEqual([
      'X 基因在肿瘤中高表达[1]。', '敲低 X 后细胞迁移减少。', 'X 是否通过 Y 起作用？',
    ]);
    expect(splitSentences('- First point here\n- Second point here')).toEqual(['First point here', 'Second point here']);
  });

  it('finds citations', () => {
    expect(findCitation('Shown before (Smith et al., 2020).')).toBe('Smith et al., 2020');
    expect(findCitation('See doi:10.1038/s41586-020-1234-5.')).toMatch(/^doi:10\.1038\/s41586-020-1234-5/);
    expect(findCitation('PMID: 31234567 reported this')).toBe('PMID: 31234567');
    expect(findCitation('as in [3, 5]')).toBe('[3, 5]');
    expect(findCitation('X 在肿瘤中高表达（Smith et al., 2020）。')).toBe('Smith et al., 2020');
    expect(findCitation('已有报道（张三等，2019）。')).toBe('张三等，2019');
    expect(findCitation('Spun at 2000 x g (n = 3).')).toBe('');
    expect(findCitation('No reference here.')).toBe('');
  });

  it('guesses a kind for each sentence', () => {
    expect(guessKind('Does X act through Y?')).toBe('question');
    expect(guessKind('X 是否通过 Y 起作用')).toBe('question');
    expect(guessKind('X is upregulated in tumours (Smith et al., 2020).')).toBe('evidence');
    expect(guessKind('我们发现敲低 X 后迁移减少。')).toBe('evidence');
    expect(guessKind('Assuming the antibody is specific, the band is X.')).toBe('assumption');
    expect(guessKind('We will knock down X in MDA-MB-231 cells.')).toBe('experiment');
    expect(guessKind('X promotes metastasis.')).toBe('claim');
  });

  it('turns candidates into unreviewed nodes that keep their source sentence', () => {
    const items = splitIntoPropositions('X promotes metastasis. X is high in tumours [1].');
    expect(items.map((i) => i.kind)).toEqual(['claim', 'evidence']);
    const nodes = nodesFromSplit(items, 'import');
    expect(nodes.every((n) => n.origin === 'import' && n.reviewed === false)).toBe(true);
    expect(nodes[1]).toMatchObject({ kind: 'evidence', citation: '[1]', source: 'literature', sourceQuote: 'X is high in tumours [1].' });
  });
});

describe('notebook round trip', () => {
  it('seeds a notebook entry from an experiment node with the researcher\'s own text', () => {
    const { map, ids } = build(
      [['claim', 'X promotes migration'], ['experiment', 'Knock down X, scratch assay', { predictIfTrue: 'slower closure', predictIfFalse: 'no change', controls: 'scrambled siRNA', protocolRef: 'p1' }]],
      [['X1', 'tests', 'C1']],
    );
    const recipe = { id: 'p1', briefSteps: ['Seed cells', 'Scratch'], materials: [{ name: 'PBS' }], duration: 90 };
    const seed = experimentEntrySeed(map, ids.X1, { lang: 'en', recipe });
    expect(seed.title).toBe('Knock down X, scratch assay');
    expect(seed.plan.objectives).toContain('Tests C1: X promotes migration');
    expect(seed.plan.objectives).toContain('If it holds, expect: slower closure');
    expect(seed.plan.objectives).toContain('Controls: scrambled siRNA');
    expect(seed.protocolRef).toBe('p1');
    expect(seed.procedure.protocolSteps.map((s) => s.stepText)).toEqual(['Seed cells', 'Scratch']);
    expect(seed.materials.reagents[0].name).toBe('PBS');
    expect(seed.evidenceLink).toMatchObject({ mapId: map.id, nodeId: ids.X1, label: 'X1' });
  });

  it('records an outcome as evidence linked back to the tested claims', () => {
    const { map, ids } = build(
      [['claim', 'c1'], ['claim', 'c2'], ['experiment', 'x', { experimentId: 'exp_9' }]],
      [['X1', 'tests', 'C1'], ['X1', 'tests', 'C2']],
    );
    const { map: next, evidenceId } = recordOutcome(map, ids.X1, { outcome: 'supports', text: 'Closure slowed 40%', targets: [ids.C1] });
    const ev = next.nodes.find((n) => n.id === evidenceId);
    expect(ev).toMatchObject({ kind: 'evidence', source: 'own', experimentId: 'exp_9', inconclusive: false });
    expect(next.edges.filter((e) => e.from === ids.X1 && e.rel === 'yields')).toHaveLength(1);
    expect(next.edges.filter((e) => e.from === evidenceId).map((e) => [e.to, e.rel])).toEqual([[ids.C1, 'supports']]);
    expect(claimStatuses(next)[ids.C1]).toBe('supported');
    expect(analyzeMap(next).experiments[0].results).toEqual([evidenceId]);

    const inc = recordOutcome(map, ids.X1, { outcome: 'inconclusive', text: 'n.s.' });
    expect(inc.map.edges.filter((e) => e.from === inc.evidenceId)).toHaveLength(0);
    expect(analyzeMap(inc.map).issues.map((i) => i.code)).not.toContain('evidence_dangling');
  });
});

describe('export and layout', () => {
  it('writes a Markdown outline from the map, in both languages', () => {
    const { map } = build(
      [['question', 'Does X drive metastasis?'], ['claim', 'X promotes migration'], ['evidence', 'X high in tumours', { citation: 'PMID: 31234567' }], ['experiment', 'Knock down X']],
      [['C1', 'answers', 'Q1'], ['E1', 'supports', 'C1'], ['X1', 'tests', 'C1']],
    );
    const en = mapToMarkdown(map, { lang: 'en' });
    expect(en).toContain('# Test map');
    expect(en).toContain('- **Q1** Does X drive metastasis?');
    expect(en).toContain('### C1 X promotes migration');
    expect(en).toContain('*Status: supported*');
    expect(en).toContain('  - E1 X high in tumours — literature: PMID: 31234567');
    expect(en).toContain('- [ ] **X1** Knock down X');
    expect(en).toContain('  - Notebook: not in the notebook yet');
    const zh = mapToMarkdown(map, { lang: 'zh' });
    expect(zh).toContain('## 研究问题');
    expect(zh).toContain('*状态: 已有证据支持*');
  });

  it('names the export after the map', () => {
    expect(mapFilename({ title: 'X & metastasis: plan' })).toBe('x-metastasis-plan.md');
    expect(mapFilename({ title: '' })).toBe('evidence-map.md');
  });

  it('lays out columns from experiments to questions, sub-claims before claims', () => {
    const { map, ids } = build(
      [['question', 'q'], ['claim', 'main'], ['claim', 'sub'], ['evidence', 'e'], ['experiment', 'x']],
      [['C1', 'answers', 'Q1'], ['C2', 'supports', 'C1'], ['E1', 'supports', 'C2'], ['X1', 'yields', 'E1']],
    );
    const { boxes, edges, width, height } = layoutGraph(map);
    const col = (l) => boxes.get(ids[l]).col;
    expect([col('X1'), col('E1'), col('C2'), col('C1'), col('Q1')]).toEqual([0, 1, 2, 3, 4]);
    expect(edges).toHaveLength(4);
    expect(edges.every((e) => e.path.startsWith('M'))).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('routes a link that skips a column around the nodes standing in it', () => {
    const { map, ids } = build(
      [['claim', 'c'], ['evidence', 'e'], ['experiment', 'x']],
      [['E1', 'supports', 'C1'], ['X1', 'tests', 'C1']],
    );
    const { boxes, edges } = layoutGraph(map);
    const e1 = boxes.get(ids.E1);
    const skip = edges.find((e) => e.rel === 'tests');
    const cy = Number(skip.path.split('C')[1].split(' ')[0].split(',')[1]);
    // control points sit clear of E1's box, above or below it
    expect(cy < e1.y || cy > e1.y + e1.h).toBe(true);
  });

  it('lays out an empty map without throwing', () => {
    const { boxes, edges } = layoutGraph(createEmptyMap());
    expect(boxes.size).toBe(0);
    expect(edges).toEqual([]);
  });
});
