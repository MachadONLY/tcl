import { EUROPEAN_CLUBS, findEuropeanClub } from '../../career-core/european-club-catalog.js';
import { createClubBrain, createManagerBrain } from './club-brain.js';

export function europeanClubBrain(reference, seed = 1) {
  const club = typeof reference === 'object' && reference
    ? reference
    : findEuropeanClub(reference) || EUROPEAN_CLUBS.find(candidate => candidate.name === reference);
  if (!club) return null;
  const brain = createClubBrain(club, seed);
  const managerBrain = createManagerBrain(club, seed, brain);
  return { club, brain, managerBrain };
}

export function europeanBrainCoverage(seed = 1) {
  const styles = {};
  let topFlight = 0;
  for (const club of EUROPEAN_CLUBS) {
    const brain = createClubBrain(club, seed);
    styles[brain.tacticalIdentity.style] = (styles[brain.tacticalIdentity.style] || 0) + 1;
    if (Number(club.division) === 1) topFlight += 1;
  }
  return {
    clubs: EUROPEAN_CLUBS.length,
    topFlight,
    countries: new Set(EUROPEAN_CLUBS.map(club => club.countryCode)).size,
    styles
  };
}

export function allEuropeanClubBrains(seed = 1) {
  return EUROPEAN_CLUBS.map(club => europeanClubBrain(club, seed));
}
