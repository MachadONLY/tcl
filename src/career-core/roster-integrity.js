const GROUP_ORDER = Object.freeze({ GK: 0, DEF: 1, MID: 2, FWD: 3 });
const STAFF_GROUPS = new Set(['COACH', 'MANAGER', 'STAFF', 'TECHNICAL STAFF']);
const STAFF_ROLE_PATTERN = /\b(coach|manager|head coach|technical staff|t[eé]cnico|treinador)\b/i;

const POSITION_GROUPS = Object.freeze({
  G: 'GK',
  GK: 'GK',
  KEEPER: 'GK',
  GOALKEEPER: 'GK',
  GOLEIRO: 'GK',

  D: 'DEF',
  DEF: 'DEF',
  CB: 'DEF',
  LCB: 'DEF',
  RCB: 'DEF',
  LB: 'DEF',
  RB: 'DEF',
  LWB: 'DEF',
  RWB: 'DEF',
  SW: 'DEF',
  DEFENDER: 'DEF',
  DEFENCE: 'DEF',
  DEFENSE: 'DEF',
  DEFENSOR: 'DEF',

  M: 'MID',
  MID: 'MID',
  DM: 'MID',
  CDM: 'MID',
  CM: 'MID',
  LCM: 'MID',
  RCM: 'MID',
  AM: 'MID',
  CAM: 'MID',
  LAM: 'MID',
  RAM: 'MID',
  LM: 'MID',
  RM: 'MID',
  MIDFIELDER: 'MID',
  MIDFIELD: 'MID',
  MEIA: 'MID',

  F: 'FWD',
  FW: 'FWD',
  FWD: 'FWD',
  ATT: 'FWD',
  ST: 'FWD',
  CF: 'FWD',
  SS: 'FWD',
  LW: 'FWD',
  RW: 'FWD',
  FORWARD: 'FWD',
  ATTACKER: 'FWD',
  STRIKER: 'FWD',
  ATACANTE: 'FWD'
});

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedGroup(value) {
  const raw = String(value || '').trim().toUpperCase();
  return POSITION_GROUPS[raw] || (GROUP_ORDER[raw] !== undefined ? raw : '');
}

function rowName(row) {
  return Array.isArray(row) ? row[0] : row?.name;
}

function rowGroup(row) {
  return Array.isArray(row) ? row[1] : row?.group;
}

function rowPosition(row) {
  return Array.isArray(row) ? row[2] : row?.position;
}

function rowIdentity(row) {
  if (!Array.isArray(row) && row?.fotmobId) return `fotmob:${row.fotmobId}`;
  return `name:${normalize(rowName(row))}`;
}

function positionGroups(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

  if (!normalized) return [];

  const groups = [];
  for (const token of normalized.split(/\s+/)) {
    const group = POSITION_GROUPS[token];
    if (group && !groups.includes(group)) groups.push(group);
  }
  return groups;
}

export function resolveRosterGroup(row) {
  const current = normalizedGroup(rowGroup(row));
  const candidates = positionGroups(rowPosition(row));

  if (current && (!candidates.length || candidates.includes(current))) return current;
  if (candidates.length === 1) return candidates[0];
  if (current) return current;
  return candidates[0] || 'MID';
}

function withResolvedGroup(row, group) {
  if (Array.isArray(row)) {
    const next = [...row];
    next[1] = group;
    return next;
  }
  return { ...row, group };
}

function isStaffRow(row, managerNames) {
  const group = String(rowGroup(row) || '').trim().toUpperCase();
  const position = String(rowPosition(row) || '');
  const name = normalize(rowName(row));
  return STAFF_GROUPS.has(group) || STAFF_ROLE_PATTERN.test(position) || managerNames.has(name);
}

export function sanitizeRosterRows(rows, { managerNames = [] } = {}) {
  if (!Array.isArray(rows)) return [];

  const normalizedManagers = new Set(managerNames.map(normalize).filter(Boolean));
  const seen = new Set();

  return rows
    .map((row, sourceIndex) => ({ row, sourceIndex }))
    .filter(({ row }) => rowName(row) && !isStaffRow(row, normalizedManagers))
    .filter(({ row }) => {
      const identity = rowIdentity(row);
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .map(({ row, sourceIndex }) => ({
      row: withResolvedGroup(row, resolveRosterGroup(row)),
      sourceIndex
    }))
    .sort((a, b) => {
      const groupDifference = GROUP_ORDER[resolveRosterGroup(a.row)] - GROUP_ORDER[resolveRosterGroup(b.row)];
      return groupDifference || a.sourceIndex - b.sourceIndex;
    })
    .map(({ row }) => row);
}

export function rosterGroupOrder(group) {
  const normalized = normalizedGroup(group);
  return GROUP_ORDER[normalized] ?? Number.MAX_SAFE_INTEGER;
}
