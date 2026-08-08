import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, index] = await Promise.all([
  readFile(new URL('../src/career-home-processing.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-processing.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

assert.ok(source.includes('advanceOneDay(preview)'), 'calendar animation must preview the real deterministic daily tick');
assert.ok(source.includes('event.stopImmediatePropagation()'), 'home continue must be captured before the legacy instant rerender');
assert.ok(source.includes('callOriginalContinue()'), 'the authoritative career controller must still commit the final deterministic result');
assert.ok(source.includes('waitForCommittedCareer(committedDate)'), 'processing overlay must remain until the authoritative save reaches the target date');
assert.ok(source.includes('TRANSFER_COMPLETED'), 'world transfer events must drive the live activity feed');
assert.ok(source.includes('TRANSFER_OFFER_RECEIVED'), 'formal transfer offers must surface during calendar processing');
assert.ok(source.includes('const fresh = FIXTURES.filter'), 'simulated league results must be eligible for world news');
assert.ok(source.includes('patchLatestWorldNews'), 'the home news card must remain world-driven after processing ends');
assert.ok(source.includes('renderBackgroundTimeline'), 'the visible home calendar must move day-by-day behind the processing control');
assert.ok(!source.includes('location.reload'), 'calendar processing must never solve synchronization with a page reload');
assert.ok(!source.includes('app.innerHTML'), 'processing controller must not remount the application shell');
assert.ok(css.includes('.tl-processing-calendar'), 'FM-style mini calendar must be styled');
assert.ok(css.includes('position:fixed'), 'processing UI must survive the legacy shell rerender');
assert.ok(css.includes('grid-template-columns:repeat(7'), 'processing calendar must expose a seven-day moving window');
assert.ok(css.includes('.tl-processing-progress'), 'calendar processing must expose progress toward the next commitment');
assert.ok(css.includes('.tl-world-news-pulse'), 'world news changes must animate without a full page flash');
assert.ok(index.indexOf('career-home-processing.js') > index.indexOf('career-home-v2.js'), 'processing controller must load after the home experience');
assert.ok(index.includes('career-home-processing.css'), 'processing CSS must be loaded by the app shell');

console.log(JSON.stringify({
  ok: true,
  processing: 'deterministic-day-by-day-preview',
  shellRemountVisible: false,
  movingCalendarDays: 7,
  worldEventDrivenNews: true,
  transferEvents: true,
  leagueResults: true,
  pageReload: false
}, null, 2));
