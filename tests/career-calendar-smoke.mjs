import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendarSource = fs.readFileSync('src/career-calendar.js', 'utf8');
const calendarStyles = fs.readFileSync('src/career-calendar.css', 'utf8');
const entrypoint = fs.readFileSync('index.html', 'utf8');

assert.match(entrypoint, /\/src\/career-calendar\.js/, 'calendar module must be loaded by the career entrypoint');
assert.match(calendarSource, /CareerRepository\.load\(\)/, 'calendar must load the active career save');
assert.match(calendarSource, /userFixtures\(career\)/, 'calendar must derive fixtures from the active club');
assert.match(calendarSource, /index < 42/, 'calendar must render a stable six-week month grid');
assert.match(calendarSource, /career\.clubCode/, 'calendar must derive club-specific content from the save');
assert.doesNotMatch(calendarSource, /Burnley|Manchester City|Aston Villa/, 'reference clubs must not be hardcoded');
assert.match(calendarStyles, /grid-template-columns:\s*repeat\(7/, 'calendar must keep seven weekday columns');
assert.match(calendarStyles, /@media \(max-height: 760px\)/, 'calendar must support 1366x768 class displays');

console.log('career calendar smoke: ok');
