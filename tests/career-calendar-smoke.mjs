import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendarSource = fs.readFileSync('src/career-calendar.js', 'utf8');
const calendarStyles = fs.readFileSync('src/career-calendar.css', 'utf8');
const matchupSource = fs.readFileSync('src/career-calendar-matchup.js', 'utf8');
const matchupStyles = fs.readFileSync('src/career-calendar-matchup.css', 'utf8');
const footerlessStyles = fs.readFileSync('src/career-calendar-no-footer.css', 'utf8');
const entrypoint = fs.readFileSync('index.html', 'utf8');

assert.match(entrypoint, /\/src\/career-calendar\.js/, 'calendar module must be loaded by the career entrypoint');
assert.match(entrypoint, /\/src\/career-calendar-matchup\.js/, 'calendar matchup enhancement must be loaded');
assert.match(entrypoint, /\/src\/career-calendar-no-footer\.css/, 'footerless calendar override must be loaded');
assert.match(calendarSource, /CareerRepository\.load\(\)/, 'calendar must load the active career save');
assert.match(calendarSource, /userFixtures\(career\)/, 'calendar must derive fixtures from the active club');
assert.match(calendarSource, /index < 42/, 'calendar must render a stable six-week month grid');
assert.match(calendarSource, /career\.clubCode/, 'calendar must derive club-specific content from the save');
assert.doesNotMatch(calendarSource, /Burnley|Manchester City|Aston Villa/, 'reference clubs must not be hardcoded');
assert.match(matchupSource, /scoreForControlledClub/, 'matchup score must be oriented to the controlled club');
assert.match(matchupSource, /career\.results\?\.\[fixture\.id\]/, 'matchup must use the saved result when available');
assert.match(matchupSource, /tcc-matchup-versus/, 'future fixtures must show a versus state');
assert.match(matchupStyles, /grid-template-columns:\s*minmax\(0, 1fr\).*minmax\(0, 1fr\)/, 'matchup must display both clubs side by side');
assert.match(calendarStyles, /grid-template-columns:\s*repeat\(7/, 'calendar must keep seven weekday columns');
assert.match(calendarStyles, /left:\s*236px/, 'calendar must preserve the full career sidebar on wide screens');
assert.match(calendarStyles, /@media \(max-width: 1180px\)[\s\S]*left:\s*76px/, 'calendar must preserve the compact sidebar on narrower screens');
assert.match(calendarStyles, /@media \(max-height: 760px\)/, 'calendar must support 1366x768 class displays');
assert.match(footerlessStyles, /\.tcc-footer\s*\{[\s\S]*display:\s*none\s*!important/, 'calendar controller footer must stay removed');

console.log('career calendar smoke: ok');
