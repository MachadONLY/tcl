import { auditRatings, isRealRatingSource } from './sync-fc26-ratings.mjs';
import { normalizeName } from './official-football-data.mjs';

const finiteAge = value => {
  const age = Number(value);
  return Number.isFinite(age) && age >= 15 && age <= 50 ? age : null;
};

function findPlayer(players, aliases) {
  const normalizedAliases = aliases.map(normalizeName);
  return players.find(player => {
    const name = normalizeName(player.name);
    return normalizedAliases.some(alias => name === alias || name.endsWith(` ${alias}`) || alias.endsWith(` ${name}`));
  }) || null;
}

function addIssue(audit, issue) {
  if (!audit.issues.includes(issue)) audit.issues.push(issue);
}

function auditReferencePlayer(audit, rosterPayload, rule) {
  const players = rosterPayload.rosters?.[rule.clubCode] || [];
  const player = findPlayer(players, rule.aliases);
  if (!player) {
    if (rule.requiredWhenAbsent) addIssue(audit, `[${rule.clubCode}] referência ausente: ${rule.aliases[0]}`);
    return null;
  }
  if (!isRealRatingSource(player.ratingSource)) {
    addIssue(audit, `[${rule.clubCode}] ${player.name} não recebeu rating real do FC 26/SoFIFA`);
  }
  if (rule.minimum != null && player.rating < rule.minimum) {
    addIssue(audit, `[${rule.clubCode}] ${player.name} ${player.rating} abaixo do piso ${rule.minimum}`);
  }
  if (rule.maximum != null && player.rating > rule.maximum) {
    addIssue(audit, `[${rule.clubCode}] ${player.name} ${player.rating} acima do teto ${rule.maximum}`);
  }
  return player;
}

function ensureYouthBelow(audit, rosterPayload, clubCode, senior, group) {
  if (!senior) return;
  const youth = (rosterPayload.rosters?.[clubCode] || []).filter(player =>
    player.group === group &&
    (finiteAge(player.age) ?? 99) <= 21 &&
    !isRealRatingSource(player.ratingSource)
  );
  for (const player of youth) {
    if (player.rating >= senior.rating) {
      addIssue(audit, `[${clubCode}] ${player.name} (${player.rating}, estimado) não pode superar ${senior.name} (${senior.rating}, real)`);
    }
  }
}

export function auditPremierLeagueRatings(rosterPayload) {
  const audit = auditRatings(rosterPayload, {
    minimumGlobalRealCoverage: 0.55,
    minimumClubRealCoverage: 0.40,
    strictReferences: false
  });

  const heaven = auditReferencePlayer(audit, rosterPayload, {
    clubCode: 'MUN', aliases: ['Ayden Heaven'], maximum: 74, requiredWhenAbsent: true
  });
  const deLigt = auditReferencePlayer(audit, rosterPayload, {
    clubCode: 'MUN', aliases: ['Matthijs de Ligt', 'Matthijs De Ligt'], minimum: 79, requiredWhenAbsent: true
  });
  if (heaven && deLigt && deLigt.rating <= heaven.rating) {
    addIssue(audit, `[MUN] De Ligt ${deLigt.rating} deve estar acima de Heaven ${heaven.rating}`);
  }

  const dias = auditReferencePlayer(audit, rosterPayload, {
    clubCode: 'MCI', aliases: ['Rúben Dias', 'Ruben Dias'], minimum: 84, requiredWhenAbsent: true
  });
  ensureYouthBelow(audit, rosterPayload, 'MCI', dias, 'DEF');

  const tonali = auditReferencePlayer(audit, rosterPayload, {
    clubCode: 'NEW', aliases: ['Sandro Tonali', 'S. Tonali', 'Tonali'], minimum: 84, requiredWhenAbsent: false
  });
  ensureYouthBelow(audit, rosterPayload, 'NEW', tonali, 'MID');

  audit.passed = audit.issues.length === 0;
  audit.references = {
    heaven: heaven ? { rating: heaven.rating, source: heaven.ratingSource } : null,
    deLigt: deLigt ? { rating: deLigt.rating, source: deLigt.ratingSource } : null,
    rubenDias: dias ? { rating: dias.rating, source: dias.ratingSource } : null,
    tonali: tonali ? { rating: tonali.rating, source: tonali.ratingSource } : null
  };
  return audit;
}
