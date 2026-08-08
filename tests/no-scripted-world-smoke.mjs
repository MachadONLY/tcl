import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const algorithmFiles = [
  'src/career-world/daily-tick.js',
  'src/career-world/world-match-adapter.js',
  'src/career-world/clubs/squad-analysis.js',
  'src/career-world/clubs/ai-team-management.js',
  'src/career-world/clubs/selling-ai.js',
  'src/career-world/transfers/player-brain.js',
  'src/career-world/transfers/rumor-engine.js',
  'src/career-world/transfers/competition-engine.js',
  'src/career-world/transfers/recruitment-ai.js',
  'src/career-world/transfers/transfer-engine.js',
  'src/career-world/transfers/valuation-engine.js',
  'src/career-world/contracts/agent-engine.js',
  'src/career-world/contracts/renewal-ai.js',
  'src/career-world/contracts/contract-engine.js',
  'src/career-world/loans/loan-engine.js'
];

const clubCodes = [
  'ARS','AVL','BOU','BRE','BHA','CHE','COV','CRY','EVE','FUL','HUL','IPS','LEE','LIV','MCI','MUN','NEW','NFO','SUN','TOT'
];

const scriptedPatterns = clubCodes.flatMap(code => [
  new RegExp(`(?:clubCode|buyerCode|sellerCode|parentClubCode|borrowerClubCode|code)\\s*(?:===|==|!==|!=)\\s*['\"]${code}['\"]`, 'g'),
  new RegExp(`case\\s+['\"]${code}['\"]`, 'g')
]);

const violations = [];
for (const path of algorithmFiles) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const pattern of scriptedPatterns) {
    if (pattern.test(source)) violations.push({ path, pattern: pattern.source });
    pattern.lastIndex = 0;
  }
  assert.ok(!/SCRIPTED_(TRANSFER|RESULT|MANAGER|INJURY|CONTRACT|LOAN|SALE)/.test(source), `${path} must not contain scripted outcome escape hatches`);
}

assert.deepEqual(violations, [], `living-world algorithm files must not branch on specific club identities: ${JSON.stringify(violations)}`);

console.log(JSON.stringify({
  ok: true,
  algorithmFiles: algorithmFiles.length,
  guardedClubCodes: clubCodes.length,
  rule: 'club identity may live in data profiles; outcome algorithms may not special-case clubs'
}, null, 2));
