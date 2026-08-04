import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, source, styles] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-v2.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-v2.css', import.meta.url), 'utf8')
]);

assert.match(index, /career-home-v2\.js/);
assert.match(source, /ROTATION_MS\s*=\s*5000/);
assert.match(source, /Caixa de entrada/);
assert.match(source, /Touchline News/);
assert.match(source, /Premier League/);
assert.match(source, /data-home-slide/);
assert.match(source, /data-home-continue/);
assert.match(source, /CareerRepository\.load/);
assert.match(source, /deriveTable/);
assert.match(source, /nextUserFixture/);
assert.match(styles, /\.tl-home-v2/);
assert.match(styles, /\.tl-home-rail/);
assert.match(styles, /tlRailProgress 5s/);
assert.match(styles, /grid-template-columns:minmax\(0,2\.12fr\)/);

console.log(JSON.stringify({
  ok: true,
  rotationMs: 5000,
  panels: ['mailbox', 'news', 'league'],
  layout: 'calendar-first'
}, null, 2));
