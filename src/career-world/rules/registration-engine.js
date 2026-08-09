import { playerIdsForClubState } from '../world-employment-index.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function competitionProfile(club = {}) {
  const league = String(club.league || '').toLowerCase();
  const country = String(club.countryCode || '').toUpperCase();
  const topFlight = Number(club.division || 1) === 1;
  const premierLike = country === 'ENG' && topFlight && league.includes('premier');
  return {
    seniorRegistrationTarget: premierLike ? 25 : topFlight ? 26 : 28,
    absoluteSeniorCeiling: premierLike ? 31 : 32,
    totalActiveCeiling: topFlight ? 38 : 40,
    youthExemptAge: 21,
    knownHomegrownLimit: premierLike ? 17 : null
  };
}

function explicitHomegrownState(player, club) {
  const raw = player?.homegrownStatus ?? player?.homeGrownStatus ?? player?.homegrown ?? null;
  if (raw === true || raw === 'club' || raw === 'nation' || raw === 'trained-in-country') return 'homegrown';
  if (raw === false || raw === 'foreign' || raw === 'not-homegrown') return 'non-homegrown';
  const trainedCountry = String(player?.trainedCountryCode || player?.trainedInCountry || '').toUpperCase();
  if (trainedCountry && club?.countryCode && trainedCountry === String(club.countryCode).toUpperCase()) return 'homegrown';
  return 'unknown';
}

function youthExempt(player, profile) {
  return Number(player?.age) <= Number(profile.youthExemptAge || 21);
}

export function registrationSnapshot({ world, clubCode, playerById }) {
  const club = world.clubs?.[clubCode];
  if (!club) return null;
  const profile = competitionProfile(club);
  const players = playerIdsForClubState(world, clubCode).map(id => playerById.get(id)).filter(Boolean);
  let senior = 0;
  let youth = 0;
  let knownHomegrown = 0;
  let knownNonHomegrown = 0;
  let homegrownUnknown = 0;
  for (const player of players) {
    if (youthExempt(player, profile)) youth += 1;
    else senior += 1;
    const hg = explicitHomegrownState(player, club);
    if (hg === 'homegrown') knownHomegrown += 1;
    else if (hg === 'non-homegrown') knownNonHomegrown += 1;
    else homegrownUnknown += 1;
  }
  return {
    clubCode,
    profile,
    total: players.length,
    senior,
    youth,
    knownHomegrown,
    knownNonHomegrown,
    homegrownUnknown,
    seniorTargetUtilization: senior / Math.max(1, profile.seniorRegistrationTarget),
    totalUtilization: players.length / Math.max(1, profile.totalActiveCeiling)
  };
}

export function assessRegistrationClearance({ world, clubCode, player, playerById, moveType = 'transfer' }) {
  const club = world.clubs?.[clubCode];
  const snapshot = registrationSnapshot({ world, clubCode, playerById });
  if (!club || !snapshot || !player) return { approved: false, reasonCodes: ['REGISTRATION_ENTITY_MISSING'], snapshot };
  const profile = snapshot.profile;
  const incomingYouth = youthExempt(player, profile);
  const projectedTotal = snapshot.total + 1;
  const projectedSenior = snapshot.senior + (incomingYouth ? 0 : 1);
  const reasons = [];

  if (projectedTotal > profile.totalActiveCeiling) reasons.push('ACTIVE_SQUAD_ABSOLUTE_CEILING');
  if (!incomingYouth && projectedSenior > profile.absoluteSeniorCeiling) reasons.push('SENIOR_SQUAD_ABSOLUTE_CEILING');

  const hgState = explicitHomegrownState(player, club);
  if (!incomingYouth && profile.knownHomegrownLimit && hgState === 'non-homegrown') {
    const projectedKnownNonHomegrown = snapshot.knownNonHomegrown + 1;
    if (snapshot.homegrownUnknown === 0 && projectedKnownNonHomegrown > profile.knownHomegrownLimit) {
      reasons.push('KNOWN_NON_HOMEGROWN_LIMIT');
    }
  }

  return {
    approved: reasons.length === 0,
    reasonCodes: reasons,
    snapshot,
    incoming: { youthExempt: incomingYouth, homegrownState: hgState, moveType },
    projected: {
      total: projectedTotal,
      senior: projectedSenior,
      seniorTargetUtilization: clamp(projectedSenior / Math.max(1, profile.seniorRegistrationTarget), 0, 3)
    },
    advisoryCodes: projectedSenior > profile.seniorRegistrationTarget ? ['REGISTRATION_SLOT_PLAN_REQUIRED'] : []
  };
}

export function registrationProfileForClub(club) {
  return competitionProfile(club);
}
