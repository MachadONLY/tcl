function defaultSquadRole(player) {
  return player?.initialSquadRole || (Number(player?.age) <= 21 && Number(player?.potential) >= Number(player?.rating) + 3 ? 'prospect' : 'rotation');
}

export function rebuildEmploymentIndex(world) {
  const index = new Map();
  for (const [playerId, clubCode] of Object.entries(world?.employment || {})) {
    if (!clubCode) continue;
    const bucket = index.get(clubCode) || [];
    bucket.push(playerId);
    index.set(clubCode, bucket);
  }
  Object.defineProperty(world, '__clubPlayerIds', {
    value: index,
    writable: true,
    configurable: true,
    enumerable: false
  });
  return index;
}

export function employmentIndex(world) {
  return world?.__clubPlayerIds instanceof Map ? world.__clubPlayerIds : rebuildEmploymentIndex(world);
}

export function playerIdsForClubState(world, clubCode) {
  return employmentIndex(world).get(clubCode) || [];
}

export function ownerClubForPlayerState(world, playerId) {
  return world?.ownership?.[playerId]
    || world?.contracts?.[playerId]?.clubCode
    || world?.employment?.[playerId]
    || null;
}

export function setPlayerOwnership(world, playerId, clubCode) {
  world.ownership ||= {};
  if (clubCode) world.ownership[playerId] = clubCode;
  else delete world.ownership[playerId];
  if (world.contracts?.[playerId]) world.contracts[playerId].clubCode = clubCode || null;
  return clubCode || null;
}

export function removePlayerOwnership(world, playerId) {
  const previous = ownerClubForPlayerState(world, playerId);
  world.ownership ||= {};
  delete world.ownership[playerId];
  return previous;
}

export function setPlayerEmployment(world, playerId, clubCode, options = {}) {
  const previous = world?.employment?.[playerId] || null;
  world.employment ||= {};
  world.ownership ||= {};
  const index = employmentIndex(world);
  if (previous && index.has(previous)) {
    const bucket = index.get(previous);
    const position = bucket.indexOf(playerId);
    if (position >= 0) bucket.splice(position, 1);
  }
  world.employment[playerId] = clubCode;
  if (!options.preserveOwnership) world.ownership[playerId] = clubCode;
  if (world.freeAgents) delete world.freeAgents[playerId];
  const next = index.get(clubCode) || [];
  if (!next.includes(playerId)) next.push(playerId);
  index.set(clubCode, next);
  return clubCode;
}

export function removePlayerEmployment(world, playerId) {
  const previous = world?.employment?.[playerId] || null;
  if (!previous) return null;
  const index = employmentIndex(world);
  const bucket = index.get(previous) || [];
  const position = bucket.indexOf(playerId);
  if (position >= 0) bucket.splice(position, 1);
  delete world.employment[playerId];
  return previous;
}

export function effectivePlayerStatus(world, player) {
  const current = world?.playerStatus?.[player?.id];
  if (current) return current;
  const role = defaultSquadRole(player);
  return {
    transferListed: false,
    loanListed: false,
    askingPrice: null,
    squadRole: role,
    joinedAt: player?.joinedAt || null,
    lastMoveAt: null,
    unavailableUntil: null,
    happiness: 70,
    playingTimeExpectation: role === 'key'
      ? 'star-player'
      : role === 'important'
        ? 'important-player'
        : role === 'rotation'
          ? 'squad-player'
          : 'prospect'
  };
}

export function ensurePlayerStatus(world, player) {
  world.playerStatus ||= {};
  if (!world.playerStatus[player.id]) world.playerStatus[player.id] = { ...effectivePlayerStatus(world, player) };
  return world.playerStatus[player.id];
}

export function effectivePlayerContract(world, player) {
  const current = world?.contracts?.[player?.id];
  if (current) return current;
  return {
    playerId: player?.id || null,
    clubCode: ownerClubForPlayerState(world, player?.id) || player?.clubCode || null,
    startDate: player?.joinedAt || null,
    endDate: player?.contractUntil || null,
    weeklyWage: Math.max(1_000, Number(player?.wage) || 8_000),
    status: 'active',
    staticWorldContract: true
  };
}
