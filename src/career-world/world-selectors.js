export function clubCodeForPlayer(career, playerOrId) {
  const id = typeof playerOrId === 'string' ? playerOrId : playerOrId?.id;
  const fallback = typeof playerOrId === 'object' ? playerOrId?.clubCode : null;
  return career?.world?.employment?.[id] || fallback || null;
}

export function playerStatusFor(career, playerId) {
  return career?.world?.playerStatus?.[playerId] || null;
}

export function contractFor(career, playerId) {
  return career?.world?.contracts?.[playerId] || null;
}

export function playerIdsForClub(career, clubCode) {
  const employment = career?.world?.employment;
  if (!employment) return [];
  return Object.entries(employment)
    .filter(([, code]) => code === clubCode)
    .map(([playerId]) => playerId);
}

export function squadForWorld(career, clubCode, playerById) {
  const ids = playerIdsForClub(career, clubCode);
  if (!ids.length || !playerById) return [];
  return ids.map(id => playerById.get(id)).filter(Boolean);
}

export function transferListedPlayers(career, playerById) {
  return Object.entries(career?.world?.playerStatus || {})
    .filter(([, status]) => status?.transferListed)
    .map(([id]) => playerById?.get(id))
    .filter(Boolean);
}

export function loanListedPlayers(career, playerById) {
  return Object.entries(career?.world?.playerStatus || {})
    .filter(([, status]) => status?.loanListed)
    .map(([id]) => playerById?.get(id))
    .filter(Boolean);
}

export function activeNegotiations(career, predicate = null) {
  const rows = Object.values(career?.world?.transferMarket?.negotiations || {})
    .filter(negotiation => !['completed', 'rejected', 'withdrawn', 'expired'].includes(negotiation.status));
  return typeof predicate === 'function' ? rows.filter(predicate) : rows;
}

export function transferHistory(career) {
  return [...(career?.world?.transferMarket?.history || [])].sort((left, right) =>
    String(right.date).localeCompare(String(left.date)) || String(right.id).localeCompare(String(left.id))
  );
}

export function marketSearch(career, playerById, filters = {}) {
  const query = String(filters.query || '').trim().toLowerCase();
  const group = filters.group || null;
  const minAge = Number.isFinite(Number(filters.minAge)) ? Number(filters.minAge) : 0;
  const maxAge = Number.isFinite(Number(filters.maxAge)) ? Number(filters.maxAge) : 99;
  const minRating = Number.isFinite(Number(filters.minRating)) ? Number(filters.minRating) : 0;
  const maxValue = Number.isFinite(Number(filters.maxValue)) ? Number(filters.maxValue) : Number.POSITIVE_INFINITY;
  const listedOnly = Boolean(filters.listedOnly);
  const loanOnly = Boolean(filters.loanOnly);
  const excludedClub = filters.excludeClubCode || null;

  return [...(playerById?.values?.() || [])]
    .filter(player => clubCodeForPlayer(career, player) !== excludedClub)
    .filter(player => !query || String(player.name).toLowerCase().includes(query))
    .filter(player => !group || player.group === group)
    .filter(player => Number(player.age) >= minAge && Number(player.age) <= maxAge)
    .filter(player => Number(player.rating) >= minRating)
    .filter(player => Number(player.value || 0) <= maxValue)
    .filter(player => !listedOnly || playerStatusFor(career, player.id)?.transferListed)
    .filter(player => !loanOnly || playerStatusFor(career, player.id)?.loanListed)
    .sort((left, right) => right.rating - left.rating || left.age - right.age || left.name.localeCompare(right.name));
}
