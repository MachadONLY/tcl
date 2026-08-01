import assert from "node:assert/strict";
import { normalizePremierLeagueSnapshot } from "../src/premier-league-live.js";

const ROOT = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Touchline-Live-Roster-Smoke/1.0"
    },
    signal: AbortSignal.timeout(20000)
  });
  assert.equal(response.ok, true, `${url} returned HTTP ${response.status}`);
  return response.json();
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const teamsPayload = await fetchJson(`${ROOT}/teams`);
const rawTeams = teamsPayload?.sports
  ?.flatMap(sport => sport?.leagues || [])
  .flatMap(league => league?.teams || [])
  .map(entry => entry?.team || entry)
  .filter(team => team?.id && team?.displayName) || [];

assert.equal(rawTeams.length, 20, `Expected 20 Premier League teams, received ${rawTeams.length}`);

const rosters = await mapLimit(rawTeams, 5, async team => ({
  teamId: String(team.id),
  roster: await fetchJson(`${ROOT}/teams/${team.id}/roster`)
}));

const snapshot = normalizePremierLeagueSnapshot({
  teams: teamsPayload,
  rosters,
  generatedAt: new Date().toISOString()
});

assert.equal(snapshot.teams.length, 20, "Normalized team count must be 20");
assert.ok(snapshot.players.length >= 280, `Expected at least 280 players, received ${snapshot.players.length}`);

const united = snapshot.players.filter(player => player.teamCode === "MUN");
assert.ok(united.length >= 20, `Expected at least 20 Manchester United players, received ${united.length}`);

const photoCoverage = snapshot.players.filter(player => player.photo).length / snapshot.players.length;
assert.ok(photoCoverage >= 0.95, `Expected photo coverage >= 95%, received ${(photoCoverage * 100).toFixed(1)}%`);

console.log(JSON.stringify({
  teams: snapshot.teams.length,
  players: snapshot.players.length,
  manchesterUnited: united.length,
  photoCoverage: `${(photoCoverage * 100).toFixed(1)}%`,
  provider: snapshot.meta.provider
}, null, 2));
