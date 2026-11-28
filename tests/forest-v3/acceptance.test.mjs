import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
const fixtures = read(new URL('./acceptance.json', import.meta.url));
const evidenceFile = process.env.FOREST_QA_CANDIDATE_EVIDENCE;
const evidence = evidenceFile ? read(evidenceFile) : null;

test('fixtures map every approved QA ID once', () => {
  const plan = readFileSync(new URL('../../docs/production/demo-acceptance-plan.md', import.meta.url), 'utf8');
  const approvedIds = [...plan.matchAll(/^\| ([VGLUDR]\d\d) /gm)].map(match => match[1]);
  assert.equal(approvedIds.length, 20);
  assert.deepEqual(fixtures.map(item => item.case).sort(), approvedIds.sort());
  for (const fixture of fixtures) {
    assert.ok(fixture.needs && fixture.setup && fixture.action && Object.keys(fixture.expect).length);
  }
});

for (const fixture of fixtures) {
  test(fixture.case + ' ' + fixture.action, {
    skip: evidence ? false : 'pending candidate observations: ' + fixture.needs,
  }, () => {
    assert.match(evidence.sha, /^[0-9a-f]{40}$/);
    assert.equal(evidence.sha, process.env.FOREST_QA_CANDIDATE_SHA, 'candidate SHA must be fixed independently');
    const caseEvidence = evidence.cases[fixture.case];
    assert.ok(caseEvidence && typeof caseEvidence.rawEvidence === 'string' && caseEvidence.rawEvidence.trim());
    assert.equal(caseEvidence.sha, evidence.sha);
    assert.deepEqual(caseEvidence.observed, fixture.expect);
  });
}
