import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, source, styles, brandStyles, expandedSource, expandedStyles] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-v2.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-v2.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-v2-brand.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-league-expanded.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-league-expanded.css', import.meta.url), 'utf8')
]);

assert.match(index, /career-home-v2\.js/);
assert.match(index, /career-home-v2-brand\.css/);
assert.match(index, /career-home-league-expanded\.js/);
assert.match(index, /career-home-league-expanded\.css/);
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
assert.match(brandStyles, /logo-purple\.svg/);
assert.match(expandedSource, /MAX_ROWS\s*=\s*14/);
assert.match(expandedSource, /desiredRowCount/);
assert.match(expandedSource, /ResizeObserver/);
assert.match(expandedSource, /--tl-table-rows/);
assert.match(expandedStyles, /repeat\(var\(--tl-table-rows,8\)/);
assert.match(expandedStyles, /width:28px/);
assert.match(expandedStyles, /font-size:clamp\(10\.5px/);

console.log(JSON.stringify({
  ok: true,
  rotationMs: 5000,
  panels: ['mailbox', 'news', 'league'],
  layout: 'calendar-first',
  officialCompetitionMark: true,
  responsiveStandings: true,
  visibleTeams: '8-14',
  largerClubMarks: true
}, null, 2));
