import assert from 'node:assert/strict';
import {
  matchEaRating,
  parseEaRatingsHtml,
  parseFotMobSquadHtml
} from '../scripts/official-football-data.mjs';

const fotmobHtml = `
<table>
  <tbody>
    <tr><td><a href="/players/15903/michael-carrick">Michael Carrick</a></td><td>Coach</td><td>England</td><td></td><td>45</td><td></td><td></td></tr>
    <tr><td><a href="/players/866967/altay-bayindir">Altay Bayindir</a></td><td>GK</td><td>Türkiye</td><td>1</td><td>28</td><td></td><td>€5.8M</td></tr>
    <tr><td><a href="/players/273018/andrey-santos">Andrey Santos</a></td><td>DM, CM</td><td>Brazil</td><td>17</td><td>22</td><td></td><td>€44.4M</td></tr>
    <tr><td><a href="/players/465960/youri-tielemans">Youri Tielemans</a></td><td>DM, AM, CM</td><td>Belgium</td><td>18</td><td>29</td><td></td><td>€35.2M</td></tr>
    <tr><td><a href="/players/422685/bruno-fernandes">Bruno Fernandes</a></td><td>AM, DM</td><td>Portugal</td><td>8</td><td>31</td><td></td><td>€33.6M</td></tr>
    <tr><td><a href="/players/1293027/ethan-wheatley">Ethan Wheatley</a></td><td>ST, AM</td><td>England</td><td>36</td><td>20</td><td></td><td>€155.5K</td></tr>
  </tbody>
</table>`;

const parsed = parseFotMobSquadHtml(fotmobHtml, 'MUN');
assert.equal(parsed.coach?.name, 'Michael Carrick');
assert.equal(parsed.players.length, 5);
assert.equal(parsed.players.some(player => player.name === 'Michael Carrick'), false);
assert.deepEqual(
  parsed.players.find(player => player.name === 'Andrey Santos'),
  {
    fotmobId: 273018,
    name: 'Andrey Santos',
    group: 'MID',
    position: 'DM, CM',
    number: 17,
    age: 22,
    transferValue: '€44.4M',
    clubCode: 'MUN'
  }
);
assert.equal(parsed.players.find(player => player.name === 'Youri Tielemans')?.group, 'MID');
assert.equal(parsed.players.find(player => player.name === 'Ethan Wheatley')?.group, 'FWD');

const eaHtml = `
<div class="rating-card">
  <a href="/games/ea-sports-fc/ratings/player-ratings/andrey-santos/273018">Andrey Santos</a>
  <span>CM</span><span>OVR 80</span><span>PAC 74</span>
</div>
<div class="rating-card">
  <a href="/games/ea-sports-fc/ratings/player-ratings/youri-tielemans/203574">Youri Tielemans</a>
  <span>CM</span><span>OVR 85</span><span>PAC 54</span>
</div>`;

const ratings = parseEaRatingsHtml(eaHtml);
assert.equal(ratings.length, 2);
assert.equal(matchEaRating({ name: 'Andrey Santos', group: 'MID' }, ratings)?.overall, 80);
assert.equal(matchEaRating({ name: 'Youri Tielemans', group: 'MID' }, ratings)?.overall, 85);

console.log(JSON.stringify({
  ok: true,
  coachSeparated: parsed.coach.name,
  players: parsed.players.length,
  andreyGroup: 'MID',
  andreyRating: 80,
  youriRating: 85
}, null, 2));
