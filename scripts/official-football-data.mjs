import { Window } from 'happy-dom';

const POSITION_GROUP = Object.freeze({
  GK: 'GK', GO: 'GK', GOALKEEPER: 'GK', KEEPER: 'GK', GOL: 'GK',
  CB: 'DEF', ZC: 'DEF', RB: 'DEF', LB: 'DEF', RWB: 'DEF', LWB: 'DEF',
  LD: 'DEF', LE: 'DEF', DF: 'DEF', DEFENDER: 'DEF', DEFENCE: 'DEF', DEFENSE: 'DEF', ZAG: 'DEF',
  DM: 'MID', CDM: 'MID', CM: 'MID', MCC: 'MID', VOL: 'MID', AM: 'MID', CAM: 'MID',
  MO: 'MID', LM: 'MID', RM: 'MID', ME: 'MID', MD: 'MID', LW: 'MID', RW: 'MID',
  PE: 'MID', PD: 'MID', MIDFIELDER: 'MID', MIDFIELD: 'MID', MC: 'MID', MEI: 'MID',
  ST: 'FWD', CF: 'FWD', FW: 'FWD', CA: 'FWD', STRIKER: 'FWD', FORWARD: 'FWD', ATTACKER: 'FWD', ATA: 'FWD'
});

const POSITION_PATTERN = /\b(?:GOALKEEPER|KEEPER|DEFENDER|DEFENCE|DEFENSE|MIDFIELDER|MIDFIELD|STRIKER|FORWARD|ATTACKER|GK|GO|GOL|CB|ZC|ZAG|RB|LB|RWB|LWB|LD|LE|DF|DM|CDM|CM|MC|MCC|VOL|AM|CAM|MO|MEI|LM|RM|ME|MD|LW|RW|PE|PD|ST|CF|FW|CA|ATA)\b/gi;
const COACH_PATTERN = /\b(?:coach|manager|head coach|t[eé]cnico|treinador)\b/i;

const VERIFIED_SUPPLEMENTS = Object.freeze({
  MUN: Object.freeze([
    Object.freeze({
      fotmobId: 465960,
      name: 'Youri Tielemans',
      group: 'MID',
      position: 'DM, CM, AM',
      number: 18,
      age: 29,
      transferValue: '€35.2M',
      clubCode: 'MUN'
    })
  ]),
  FUL: Object.freeze([
    Object.freeze({ fotmobId: 1199712, name: 'Luke Harris', group: 'MID', position: 'AM', number: null, age: 21, transferValue: null, clubCode: 'FUL' }),
    Object.freeze({ fotmobId: 1113790, name: 'Oscar Bobb', group: 'MID', position: 'RW, RM, LW', number: 14, age: 23, transferValue: '€33.2M', clubCode: 'FUL' }),
    Object.freeze({ fotmobId: 1532672, name: 'Jonah Kusi-Asare', group: 'FWD', position: 'ST', number: 18, age: 19, transferValue: '€7.7M', clubCode: 'FUL' }),
    Object.freeze({ fotmobId: 1318400, name: 'Kevin', group: 'MID', position: 'LW', number: 22, age: 23, transferValue: '€36.9M', clubCode: 'FUL' })
  ])
});

export function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeName(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[øØ]/g, 'o')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐðÐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleFromSlug(slug) {
  return decodeURIComponent(String(slug || ''))
    .replace(/\?.*$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim();
}

export function positionTokens(value) {
  return [...new Set((cleanText(value).toUpperCase().match(POSITION_PATTERN) || []).map(token => token.toUpperCase()))];
}

export function groupFromPositions(value) {
  for (const token of positionTokens(value)) {
    if (POSITION_GROUP[token]) return POSITION_GROUP[token];
  }
  return null;
}

export function primaryPosition(value, fallbackGroup = 'MID') {
  const token = positionTokens(value)[0];
  if (token) return token;
  return { GK: 'GK', DEF: 'CB', MID: 'CM', FWD: 'ST' }[fallbackGroup] || 'CM';
}

function sectionGroup(text) {
  const normalized = normalizeName(text);
  if (/\b(coach|manager|tecnico|treinador)\b/.test(normalized)) return 'COACH';
  if (/\b(keepers|goalkeepers|goleiros)\b/.test(normalized)) return 'GK';
  if (/\b(defenders|defensores)\b/.test(normalized)) return 'DEF';
  if (/\b(midfielders|meio campistas|meias)\b/.test(normalized)) return 'MID';
  if (/\b(forwards|attackers|atacantes)\b/.test(normalized)) return 'FWD';
  return null;
}

function closestStructuredRow(anchor) {
  const direct = anchor.closest('tr,[role="row"]');
  if (direct) return direct;
  let node = anchor.parentElement;
  for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
    const text = cleanText(node.textContent);
    if (text.length >= 4 && text.length <= 380 && (COACH_PATTERN.test(text) || groupFromPositions(text))) return node;
  }
  return anchor.parentElement;
}

function parseRowCells(row) {
  const cells = [...row.querySelectorAll(':scope > td, :scope > [role="cell"]')].map(cell => cleanText(cell.textContent));
  if (cells.length >= 2) {
    return {
      positionText: cells[1],
      number: Number.parseInt(cells[3], 10) || null,
      age: Number.parseInt(cells[4], 10) || null,
      transferValue: cells[6] || null
    };
  }
  return null;
}

function precedingSectionGroup(anchor) {
  const elements = [...anchor.ownerDocument.querySelectorAll('h1,h2,h3,h4,[role="heading"],a[href*="/players/"]')];
  const index = elements.indexOf(anchor);
  let current = null;
  for (let cursor = 0; cursor <= index; cursor += 1) {
    const element = elements[cursor];
    if (element === anchor) break;
    const detected = sectionGroup(element.textContent);
    if (detected) current = detected;
  }
  return current;
}

function applyVerifiedSupplements(playersById, clubCode) {
  for (const player of VERIFIED_SUPPLEMENTS[clubCode] || []) {
    if (!playersById.has(player.fotmobId)) playersById.set(player.fotmobId, { ...player });
  }
}

export function parseFotMobSquadHtml(html, clubCode = '') {
  const window = new Window({
    settings: {
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      disableIframePageLoading: true
    }
  });
  window.document.write(String(html || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/'));

  const playersById = new Map();
  let coach = null;

  for (const anchor of window.document.querySelectorAll('a[href*="/players/"]')) {
    const href = anchor.getAttribute('href') || '';
    const match = href.match(/\/players\/(\d+)\/([^/?#]+)/i);
    if (!match) continue;
    const fotmobId = Number(match[1]);
    if (!fotmobId || playersById.has(fotmobId)) continue;

    const slugName = titleFromSlug(match[2]);
    const visibleName = [anchor.getAttribute('aria-label'), anchor.getAttribute('title'), anchor.textContent]
      .map(cleanText)
      .find(value => value.length >= 2 && value.length <= 80 && !/[€£$]/.test(value));
    const name = visibleName || slugName;
    const row = closestStructuredRow(anchor);
    const rowText = cleanText(row?.textContent);
    const cells = row ? parseRowCells(row) : null;
    const positionText = cells?.positionText || rowText;
    const isCoach = COACH_PATTERN.test(positionText) || precedingSectionGroup(anchor) === 'COACH';

    if (isCoach) {
      coach ||= { fotmobId, name, role: 'COACH' };
      continue;
    }

    const explicitPositions = positionTokens(positionText);
    let group = groupFromPositions(positionText);
    if (!group) {
      const section = precedingSectionGroup(anchor);
      group = section && section !== 'COACH' ? section : null;
    }
    if (!group) continue;

    playersById.set(fotmobId, {
      fotmobId,
      name,
      group,
      position: explicitPositions.join(', ') || primaryPosition('', group),
      number: cells?.number ?? null,
      age: cells?.age ?? null,
      transferValue: cells?.transferValue ?? null,
      clubCode
    });
  }

  applyVerifiedSupplements(playersById, clubCode);
  const players = [...playersById.values()];
  const duplicateNames = players
    .map(player => normalizeName(player.name))
    .filter((name, index, all) => all.indexOf(name) !== index);
  if (duplicateNames.length) {
    throw new Error(`${clubCode}: nomes duplicados no elenco: ${[...new Set(duplicateNames)].join(', ')}`);
  }

  window.close();
  return { coach, players };
}

function closestRatingCard(anchor) {
  let node = anchor;
  for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
    const text = cleanText(node.textContent);
    if (text.length <= 900 && /\b(?:OVR|GER|SML)\s*\d{2}\b/i.test(text)) return node;
  }
  return anchor.parentElement;
}

export function parseEaRatingsHtml(html) {
  const source = String(html || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.document.write(source);
  const byId = new Map();

  for (const anchor of window.document.querySelectorAll('a[href*="/ratings/player-ratings/"]')) {
    const href = anchor.getAttribute('href') || '';
    const match = href.match(/\/ratings\/player-ratings\/([^/?#]+)\/(\d+)/i);
    if (!match) continue;
    const eaPlayerId = Number(match[2]);
    if (!eaPlayerId || byId.has(eaPlayerId)) continue;
    const card = closestRatingCard(anchor);
    const text = cleanText(card?.textContent);
    const overall = Number(text.match(/\b(?:OVR|GER|SML)\s*(\d{2})\b/i)?.[1]);
    if (!overall) continue;
    const name = cleanText(anchor.textContent) || titleFromSlug(match[1]);
    const position = positionTokens(text)[0] || '';
    byId.set(eaPlayerId, {
      eaPlayerId,
      name,
      normalizedName: normalizeName(name),
      position,
      group: groupFromPositions(position),
      overall
    });
  }

  window.close();
  return [...byId.values()];
}

export function matchEaRating(player, ratingRows) {
  const normalized = normalizeName(player.name);
  const compact = normalized.replace(/\s+/g, '');
  const candidates = ratingRows.filter(row => {
    const remote = row.normalizedName || normalizeName(row.name);
    return remote === normalized || remote.replace(/\s+/g, '') === compact;
  });
  if (!candidates.length) return null;
  return candidates.find(candidate => candidate.group === player.group) || candidates[0];
}
