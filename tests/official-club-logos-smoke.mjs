import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EUROPEAN_CLUBS } from '../src/career-core/european-club-catalog.js';
import { OFFICIAL_CLUB_LOGO_MANIFEST } from '../src/career-core/official-club-logo-manifest.js';
import {
  OFFICIAL_CLUB_LOGO_META,
  chooseSportsDbLogo,
  normalizeClubLogoKey,
  scoreSportsDbTeam
} from '../src/career-core/official-club-logo-service.js';

assert.equal(normalizeClubLogoKey('Borussia Mönchengladbach'), 'borussia monchengladbach');
assert.equal(normalizeClubLogoKey('Paris Saint-Germain FC'), 'paris saint germain fc');

const club = EUROPEAN_CLUBS.find(item => item.name === 'Paris Saint-Germain');
assert.ok(club, 'catalog must include Paris Saint-Germain');

const wrexham = EUROPEAN_CLUBS.find(item => item.name === 'Wrexham');
assert.ok(wrexham, 'catalog must include Wrexham');
assert.match(OFFICIAL_CLUB_LOGO_MANIFEST[wrexham.id]?.logoUrl || '', /^https:\/\//, 'Wrexham must have a deterministic official crest URL');

const deterministicCrests = EUROPEAN_CLUBS.filter(item => /^https:\/\//i.test(OFFICIAL_CLUB_LOGO_MANIFEST[item.id]?.logoUrl || '')).length;
assert.ok(deterministicCrests >= 1200, 'the static manifest must cover the large majority of the European catalog');

const exact = {
  idTeam: '133714', strTeam: 'Paris Saint-Germain', strTeamShort: 'PSG',
  strAlternate: 'Paris SG', strSport: 'Soccer', strCountry: 'France',
  strLeague: 'French Ligue 1', strBadge: 'https://example.test/psg.png'
};
const wrongSport = { ...exact, idTeam: 'wrong', strSport: 'Basketball' };
const wrongCountry = { ...exact, idTeam: 'wrong-country', strTeam: 'Paris FC', strCountry: 'United States' };

assert.ok(scoreSportsDbTeam(exact, club) > scoreSportsDbTeam(wrongCountry, club));
assert.ok(scoreSportsDbTeam(wrongSport, club) < 0);
const chosen = chooseSportsDbLogo([wrongSport, wrongCountry, exact], club);
assert.equal(chosen.providerId, '133714');
assert.equal(chosen.source, 'TheSportsDB');
assert.equal(chosen.url, 'https://example.test/psg.png/small');

assert.equal(OFFICIAL_CLUB_LOGO_META.primaryProvider, 'TheSportsDB');
assert.equal(OFFICIAL_CLUB_LOGO_META.fallbackProvider, 'Wikipedia PageImages');
assert.equal(OFFICIAL_CLUB_LOGO_META.networkMode, 'lazy-visible-only');
assert.ok(OFFICIAL_CLUB_LOGO_META.sportsDbRequestsPerMinute < 30);
assert.ok(EUROPEAN_CLUBS.length >= 1400, 'all European catalog clubs must be eligible for logo resolution');

const serviceSource = await readFile(new URL('../src/career-core/official-club-logo-service.js', import.meta.url), 'utf8');
const bridgeSource = await readFile(new URL('../src/career-official-club-logos.js', import.meta.url), 'utf8');
const bridgeStyles = await readFile(new URL('../src/career-official-club-logos.css', import.meta.url), 'utf8');
const playableSource = await readFile(new URL('../src/career-playable.js', import.meta.url), 'utf8');
assert.match(serviceSource, /thesportsdb\.com\/api\/v1\/json\/123\/searchteams\.php/);
assert.match(serviceSource, /strBadge/);
assert.match(serviceSource, /en\.wikipedia\.org\/w\/api\.php/);
assert.match(serviceSource, /localStorage/);
assert.match(serviceSource, /POSITIVE_TTL/);
assert.match(bridgeSource, /OFFICIAL_CLUB_LOGO_MANIFEST/, 'UI bridge must use deterministic manifest before lazy provider lookup');
assert.match(bridgeSource, /staticLogoFor\(/, 'UI bridge must resolve known club crests synchronously');
assert.match(bridgeSource, /dynamicFallback:\s*true/, 'failed static URLs must fall back to another online provider');
assert.match(bridgeSource, /skipStatic:\s*true/, 'fallback lookup must bypass a failed static URL');
assert.match(bridgeSource, /IntersectionObserver/);
assert.match(bridgeSource, /MutationObserver/);
assert.match(bridgeSource, /\.tcc-external-crest/);
assert.match(bridgeSource, /\.cp-external-crest/);
assert.match(bridgeSource, /data:image\/svg\+xml/);
assert.match(playableSource, /class="cp-match/, 'live match screen must render through the shared playable crest markup');
assert.match(playableSource, /class="cp-fulltime/, 'post-match screen must render through the shared playable crest markup');
assert.match(bridgeStyles, /cp-match[\s\S]*tl-official-club-logo/, 'live match official crest sizing must be explicit');
assert.match(bridgeStyles, /cp-fulltime[\s\S]*tl-official-club-logo/, 'post-match official crest sizing must be explicit');
assert.match(bridgeStyles, /data-official-logo-state="loading"[\s\S]*opacity:\s*0/, 'generic placeholders must stay invisible while the official crest loads');

try {
  const response = await fetch('https://football-logos.cc/greece/', {
    headers: { 'user-agent': 'TouchlineLogoAudit/1.0' }
  });
  const html = await response.text();
  const snippets = ['aek-athens', 'olympiacos', 'panathinaikos'].map(slug => {
    const index = html.indexOf(slug);
    return { slug, snippet: index >= 0 ? html.slice(Math.max(0, index - 650), index + 1250) : null };
  });
  console.log('COUNTRY_MARKUP_DIAGNOSTIC', JSON.stringify({ status: response.status, length: html.length, snippets }));
} catch (error) {
  console.log('COUNTRY_MARKUP_DIAGNOSTIC_ERROR', error.message);
}

console.log(JSON.stringify({
  ok: true,
  eligibleClubs: EUROPEAN_CLUBS.length,
  deterministicCrests,
  primaryProvider: OFFICIAL_CLUB_LOGO_META.primaryProvider,
  fallbackProvider: OFFICIAL_CLUB_LOGO_META.fallbackProvider,
  requestMode: OFFICIAL_CLUB_LOGO_META.networkMode,
  cacheDays: OFFICIAL_CLUB_LOGO_META.cacheDays,
  liveAndPostmatchStaticFirst: true,
  persistentCache: true
}, null, 2));
