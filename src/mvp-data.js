/**
 * Touchline single-match MVP data.
 *
 * Roster snapshot: 2026-07-30.
 *
 * Player names and currently published squad numbers are researched roster
 * data. Every overall, attribute, condition, sharpness, morale, tactical
 * strength and scouting conclusion in this file is an INTERNAL TOUCHLINE
 * PROTOTYPE VALUE. Those values are not official ratings, medical data or
 * provider-supplied assessments.
 */

export const SNAPSHOT_DATE = "2026-07-30";

export const INTERNAL_RATING_MODEL = Object.freeze({
  id: "touchline-internal-mvp-2026-07-v1",
  label: "Ratings internos Touchline",
  scale: "1-100",
  official: false,
  contextual: true,
  disclaimer:
    "Overalls, atributos, condição, ritmo, moral, força coletiva e relatórios são heurísticas internas do protótipo Touchline; não são notas oficiais de clubes, ligas, EA, Football Manager ou provedores de dados."
});

const ATTRIBUTE_PROFILES = {
  goalkeeper: {
    goalkeeping: 80,
    defending: 32,
    positioning: 79,
    physical: 74,
    passing: 69,
    decisions: 77,
    technique: 65,
    finishing: 14,
    pace: 50,
    stamina: 66,
    aggression: 44,
    aerial: 79,
    crossing: 20,
    dribbling: 38,
    tackling: 28,
    firstTouch: 67,
    workRate: 68
  },
  centreBack: {
    goalkeeping: 10,
    defending: 81,
    positioning: 81,
    physical: 82,
    passing: 71,
    decisions: 78,
    technique: 68,
    finishing: 44,
    pace: 72,
    stamina: 78,
    aggression: 75,
    aerial: 82,
    crossing: 48,
    dribbling: 61,
    tackling: 82,
    firstTouch: 70,
    workRate: 78
  },
  fullBack: {
    goalkeeping: 9,
    defending: 77,
    positioning: 77,
    physical: 78,
    passing: 76,
    decisions: 75,
    technique: 77,
    finishing: 53,
    pace: 84,
    stamina: 85,
    aggression: 70,
    aerial: 66,
    crossing: 80,
    dribbling: 78,
    tackling: 77,
    firstTouch: 77,
    workRate: 85
  },
  holdingMidfielder: {
    goalkeeping: 8,
    defending: 79,
    positioning: 80,
    physical: 79,
    passing: 80,
    decisions: 80,
    technique: 79,
    finishing: 58,
    pace: 72,
    stamina: 85,
    aggression: 76,
    aerial: 70,
    crossing: 68,
    dribbling: 76,
    tackling: 81,
    firstTouch: 80,
    workRate: 86
  },
  centralMidfielder: {
    goalkeeping: 8,
    defending: 68,
    positioning: 76,
    physical: 75,
    passing: 84,
    decisions: 83,
    technique: 83,
    finishing: 67,
    pace: 73,
    stamina: 83,
    aggression: 65,
    aerial: 64,
    crossing: 76,
    dribbling: 81,
    tackling: 70,
    firstTouch: 84,
    workRate: 82
  },
  attackingMidfielder: {
    goalkeeping: 7,
    defending: 48,
    positioning: 82,
    physical: 73,
    passing: 85,
    decisions: 84,
    technique: 88,
    finishing: 82,
    pace: 82,
    stamina: 80,
    aggression: 59,
    aerial: 58,
    crossing: 83,
    dribbling: 88,
    tackling: 48,
    firstTouch: 88,
    workRate: 79
  },
  winger: {
    goalkeeping: 7,
    defending: 46,
    positioning: 79,
    physical: 72,
    passing: 78,
    decisions: 77,
    technique: 84,
    finishing: 78,
    pace: 88,
    stamina: 80,
    aggression: 55,
    aerial: 55,
    crossing: 81,
    dribbling: 87,
    tackling: 45,
    firstTouch: 84,
    workRate: 79
  },
  striker: {
    goalkeeping: 7,
    defending: 37,
    positioning: 84,
    physical: 81,
    passing: 72,
    decisions: 78,
    technique: 80,
    finishing: 84,
    pace: 83,
    stamina: 78,
    aggression: 68,
    aerial: 79,
    crossing: 62,
    dribbling: 80,
    tackling: 38,
    firstTouch: 81,
    workRate: 77
  }
};

function buildAttributes(profile, overrides = {}) {
  const base = ATTRIBUTE_PROFILES[profile];
  if (!base) throw new Error(`Unknown internal attribute profile: ${profile}`);
  return { ...base, ...overrides };
}

function createPlayer({
  teamCode,
  slug,
  name,
  apiAliases = [],
  shirtNumber = null,
  numberStatus = shirtNumber == null ? "pending" : "confirmed",
  numberSource = "official-current-squad",
  position,
  primaryPosition,
  positions,
  roles,
  profile,
  overall,
  attributes,
  condition,
  sharpness,
  morale = 82
}) {
  return {
    id: `${teamCode}-${slug}`,
    providerIds: {
      footballData: null
    },
    name,
    apiAliases,
    shirtNumber,
    numberStatus,
    numberSource,
    position,
    positionGroup: position,
    primaryPosition,
    positions,
    roles,
    overall,
    overallSource: INTERNAL_RATING_MODEL.id,
    attributes: buildAttributes(profile, attributes),
    condition,
    sharpness,
    morale,
    availability: "available",
    availabilitySource: "touchline-internal-match-scenario",
    status: "first-team-core",
    ratingsOfficial: false,
    dataProvenance: {
      identity: "official-club-or-premier-league-snapshot",
      shirtNumber: numberSource,
      positions: "touchline-role-mapping",
      ratings: INTERNAL_RATING_MODEL.id,
      condition: "touchline-internal-match-scenario"
    }
  };
}

function createLineup({
  id,
  label,
  formation,
  inPossession,
  outOfPossession,
  slots,
  captainId,
  penaltyTakerId,
  freeKickTakerId,
  cornerTakerIds
}) {
  return {
    id,
    label,
    formation,
    inPossession,
    outOfPossession,
    slots,
    startingIds: slots.map(slot => slot.playerId),
    captainId,
    penaltyTakerId,
    freeKickTakerId,
    cornerTakerIds
  };
}

function createTeam({
  id,
  stableId,
  name,
  shortName,
  tla,
  crest,
  colors,
  displayOverall,
  squad,
  lineups,
  defaultLineup,
  tactics,
  strengthProfile,
  opponentReport,
  sources
}) {
  const lineupMap = Object.fromEntries(
    lineups.map(lineup => [
      lineup.formation,
      {
        ...lineup,
        benchIds: squad
          .filter(player => !lineup.startingIds.includes(player.id))
          .map(player => player.id)
      }
    ])
  );

  return {
    id,
    stableId,
    providerIds: {
      footballData: id
    },
    name,
    shortName,
    tla,
    crest,
    colors,
    source: "local-snapshot",
    dataStatus: {
      label: "Snapshot local — 30 jul 2026",
      snapshotDate: SNAPSHOT_DATE,
      season: "2026/27",
      rosterFinal: false,
      transferWindowOpen: true,
      providerConfigured: false,
      providerLive: false,
      rosterSource: "researched-local-fallback",
      ratingsSource: INTERNAL_RATING_MODEL.id
    },
    displayOverall,
    displayOverallSource: INTERNAL_RATING_MODEL.id,
    ratingsOfficial: false,
    squad,
    defaultLineup,
    lineups: lineupMap,
    tactics,
    strengthProfile: {
      ...strengthProfile,
      source: INTERNAL_RATING_MODEL.id,
      official: false
    },
    opponentReport,
    sources,
    integration: {
      provider: "football-data.org",
      configured: false,
      live: false,
      reason: "provider-not-configured",
      rosterLive: false,
      ratingsLive: false,
      matchedPlayers: 0,
      unmatchedProviderPlayers: []
    }
  };
}

const CHELSEA_SQUAD = [
  createPlayer({
    teamCode: "che",
    slug: "robert-sanchez",
    name: "Robert Sánchez",
    apiAliases: ["Robert Sanchez"],
    shirtNumber: 1,
    position: "Goalkeeper",
    primaryPosition: "GK",
    positions: ["GK"],
    roles: ["sweeper-keeper", "goalkeeper"],
    profile: "goalkeeper",
    overall: 82,
    attributes: { goalkeeping: 84, aerial: 84, passing: 73, pace: 56 },
    condition: 95,
    sharpness: 88,
    morale: 83
  }),
  createPlayer({
    teamCode: "che",
    slug: "filip-jorgensen",
    name: "Filip Jørgensen",
    apiAliases: ["Filip Jorgensen"],
    shirtNumber: 12,
    position: "Goalkeeper",
    primaryPosition: "GK",
    positions: ["GK"],
    roles: ["sweeper-keeper", "goalkeeper"],
    profile: "goalkeeper",
    overall: 79,
    attributes: { goalkeeping: 80, passing: 75, decisions: 75 },
    condition: 96,
    sharpness: 87,
    morale: 81
  }),
  createPlayer({
    teamCode: "che",
    slug: "marco-palestra",
    name: "Marco Palestra",
    shirtNumber: 2,
    numberStatus: "preseason-provisional",
    numberSource: "official-chelsea-2026-preseason-tour",
    position: "Defence",
    primaryPosition: "RB",
    positions: ["RB", "RWB"],
    roles: ["attacking-full-back", "wing-back"],
    profile: "fullBack",
    overall: 77,
    attributes: { pace: 87, stamina: 86, crossing: 78, defending: 73 },
    condition: 94,
    sharpness: 79,
    morale: 82
  }),
  createPlayer({
    teamCode: "che",
    slug: "tosin-adarabioyo",
    name: "Tosin Adarabioyo",
    shirtNumber: 4,
    position: "Defence",
    primaryPosition: "CB",
    positions: ["CB", "RCB"],
    roles: ["central-defender", "aerial-defender"],
    profile: "centreBack",
    overall: 79,
    attributes: { aerial: 86, physical: 84, pace: 68, passing: 73 },
    condition: 94,
    sharpness: 86,
    morale: 81
  }),
  createPlayer({
    teamCode: "che",
    slug: "levi-colwill",
    name: "Levi Colwill",
    shirtNumber: 6,
    position: "Defence",
    primaryPosition: "LCB",
    positions: ["LCB", "CB", "LB"],
    roles: ["ball-playing-defender", "cover-defender"],
    profile: "centreBack",
    overall: 83,
    attributes: { defending: 84, positioning: 84, passing: 81, pace: 75 },
    condition: 90,
    sharpness: 78,
    morale: 83
  }),
  createPlayer({
    teamCode: "che",
    slug: "mamadou-sarr",
    name: "Mamadou Sarr",
    shirtNumber: 19,
    position: "Defence",
    primaryPosition: "CB",
    positions: ["CB", "LCB"],
    roles: ["ball-playing-defender", "cover-defender"],
    profile: "centreBack",
    overall: 80,
    attributes: { pace: 80, passing: 76, defending: 80, aerial: 79 },
    condition: 94,
    sharpness: 80,
    morale: 82
  }),
  createPlayer({
    teamCode: "che",
    slug: "jorrel-hato",
    name: "Jorrel Hato",
    shirtNumber: 21,
    position: "Defence",
    primaryPosition: "LB",
    positions: ["LB", "LCB", "CB"],
    roles: ["inverted-full-back", "ball-playing-defender"],
    profile: "fullBack",
    overall: 82,
    attributes: { defending: 80, positioning: 81, passing: 80, pace: 83, aerial: 71 },
    condition: 95,
    sharpness: 85,
    morale: 84
  }),
  createPlayer({
    teamCode: "che",
    slug: "trevoh-chalobah",
    name: "Trevoh Chalobah",
    shirtNumber: 23,
    position: "Defence",
    primaryPosition: "RCB",
    positions: ["RCB", "CB", "RB"],
    roles: ["central-defender", "wide-centre-back"],
    profile: "centreBack",
    overall: 81,
    attributes: { defending: 82, pace: 77, physical: 82, passing: 74 },
    condition: 95,
    sharpness: 88,
    morale: 84
  }),
  createPlayer({
    teamCode: "che",
    slug: "reece-james",
    name: "Reece James",
    shirtNumber: 24,
    position: "Defence",
    primaryPosition: "RB",
    positions: ["RB", "RWB", "RCM"],
    roles: ["inverted-full-back", "complete-wing-back", "set-piece-taker"],
    profile: "fullBack",
    overall: 84,
    attributes: {
      physical: 84,
      passing: 84,
      technique: 82,
      crossing: 88,
      pace: 82,
      defending: 81,
      finishing: 68
    },
    condition: 92,
    sharpness: 82,
    morale: 85
  }),
  createPlayer({
    teamCode: "che",
    slug: "malo-gusto",
    name: "Malo Gusto",
    shirtNumber: 27,
    position: "Defence",
    primaryPosition: "RB",
    positions: ["RB", "RWB"],
    roles: ["attacking-full-back", "overlapping-full-back"],
    profile: "fullBack",
    overall: 82,
    attributes: { pace: 89, stamina: 87, crossing: 83, dribbling: 82, defending: 76 },
    condition: 95,
    sharpness: 86,
    morale: 83
  }),
  createPlayer({
    teamCode: "che",
    slug: "wesley-fofana",
    name: "Wesley Fofana",
    shirtNumber: 29,
    position: "Defence",
    primaryPosition: "RCB",
    positions: ["RCB", "CB"],
    roles: ["stopper", "cover-defender"],
    profile: "centreBack",
    overall: 82,
    attributes: { pace: 82, defending: 83, physical: 83, aggression: 81 },
    condition: 91,
    sharpness: 81,
    morale: 82
  }),
  createPlayer({
    teamCode: "che",
    slug: "pedro-neto",
    name: "Pedro Neto",
    shirtNumber: 7,
    position: "Midfield",
    primaryPosition: "RW",
    positions: ["RW", "LW", "RM"],
    roles: ["inverted-winger", "touchline-winger"],
    profile: "winger",
    overall: 83,
    attributes: { pace: 91, dribbling: 86, crossing: 84, passing: 81, finishing: 78 },
    condition: 92,
    sharpness: 78,
    morale: 84
  }),
  createPlayer({
    teamCode: "che",
    slug: "enzo-fernandez",
    name: "Enzo Fernández",
    apiAliases: ["Enzo Fernandez"],
    shirtNumber: 8,
    position: "Midfield",
    primaryPosition: "CM",
    positions: ["CM", "RCM", "LCM", "AM"],
    roles: ["deep-lying-playmaker", "advanced-playmaker", "number-eight"],
    profile: "centralMidfielder",
    overall: 87,
    attributes: {
      passing: 90,
      decisions: 88,
      technique: 87,
      firstTouch: 88,
      positioning: 80,
      stamina: 84
    },
    condition: 91,
    sharpness: 76,
    morale: 86
  }),
  createPlayer({
    teamCode: "che",
    slug: "cole-palmer",
    name: "Cole Palmer",
    shirtNumber: 10,
    position: "Midfield",
    primaryPosition: "AM",
    positions: ["AM", "RW", "RAM"],
    roles: ["advanced-playmaker", "inside-forward", "penalty-taker"],
    profile: "attackingMidfielder",
    overall: 90,
    attributes: {
      passing: 90,
      decisions: 89,
      technique: 92,
      finishing: 89,
      dribbling: 91,
      firstTouch: 92,
      positioning: 88
    },
    condition: 94,
    sharpness: 85,
    morale: 88
  }),
  createPlayer({
    teamCode: "che",
    slug: "jamie-gittens",
    name: "Jamie Gittens",
    shirtNumber: 11,
    position: "Midfield",
    primaryPosition: "LW",
    positions: ["LW", "RW"],
    roles: ["inverted-winger", "inside-forward"],
    profile: "winger",
    overall: 81,
    attributes: { pace: 90, dribbling: 89, technique: 86, finishing: 75, decisions: 74 },
    condition: 96,
    sharpness: 86,
    morale: 83
  }),
  createPlayer({
    teamCode: "che",
    slug: "dario-essugo",
    name: "Dário Essugo",
    apiAliases: ["Dario Essugo"],
    shirtNumber: 14,
    position: "Midfield",
    primaryPosition: "DM",
    positions: ["DM", "CM"],
    roles: ["ball-winning-midfielder", "holding-midfielder"],
    profile: "holdingMidfielder",
    overall: 78,
    attributes: { defending: 80, aggression: 83, physical: 82, passing: 75, decisions: 75 },
    condition: 93,
    sharpness: 83,
    morale: 81
  }),
  createPlayer({
    teamCode: "che",
    slug: "morgan-rogers",
    name: "Morgan Rogers",
    shirtNumber: 17,
    numberSource: "official-chelsea-number-announcement",
    position: "Midfield",
    primaryPosition: "AM",
    positions: ["AM", "LW", "ST"],
    roles: ["ball-carrying-playmaker", "inside-forward", "shadow-striker"],
    profile: "attackingMidfielder",
    overall: 86,
    attributes: {
      physical: 84,
      pace: 85,
      dribbling: 88,
      finishing: 83,
      passing: 84,
      workRate: 83
    },
    condition: 90,
    sharpness: 74,
    morale: 87
  }),
  createPlayer({
    teamCode: "che",
    slug: "moises-caicedo",
    name: "Moisés Caicedo",
    apiAliases: ["Moises Caicedo"],
    shirtNumber: 25,
    position: "Midfield",
    primaryPosition: "DM",
    positions: ["DM", "CM", "RCM"],
    roles: ["ball-winning-midfielder", "holding-midfielder", "press-resistant-midfielder"],
    profile: "holdingMidfielder",
    overall: 89,
    attributes: {
      defending: 89,
      positioning: 88,
      physical: 86,
      passing: 86,
      decisions: 88,
      technique: 85,
      tackling: 91,
      stamina: 91,
      workRate: 93
    },
    condition: 90,
    sharpness: 75,
    morale: 88
  }),
  createPlayer({
    teamCode: "che",
    slug: "estevao-willian",
    name: "Estêvão Willian",
    apiAliases: ["Estevao", "Estevao Willian"],
    shirtNumber: 41,
    position: "Midfield",
    primaryPosition: "RW",
    positions: ["RW", "AM", "LW"],
    roles: ["inverted-winger", "creative-winger"],
    profile: "winger",
    overall: 85,
    attributes: {
      pace: 89,
      technique: 91,
      dribbling: 92,
      finishing: 82,
      passing: 83,
      firstTouch: 89
    },
    condition: 95,
    sharpness: 84,
    morale: 87
  }),
  createPlayer({
    teamCode: "che",
    slug: "romeo-lavia",
    name: "Roméo Lavia",
    apiAliases: ["Romeo Lavia"],
    shirtNumber: 45,
    position: "Midfield",
    primaryPosition: "DM",
    positions: ["DM", "CM"],
    roles: ["press-resistant-midfielder", "deep-lying-playmaker"],
    profile: "holdingMidfielder",
    overall: 81,
    attributes: { passing: 83, technique: 84, firstTouch: 85, defending: 78, decisions: 80 },
    condition: 92,
    sharpness: 80,
    morale: 82
  }),
  createPlayer({
    teamCode: "che",
    slug: "alejandro-garnacho",
    name: "Alejandro Garnacho",
    shirtNumber: 49,
    position: "Midfield",
    primaryPosition: "LW",
    positions: ["LW", "RW"],
    roles: ["inside-forward", "transition-winger"],
    profile: "winger",
    overall: 84,
    attributes: { pace: 92, dribbling: 87, finishing: 81, technique: 84, aggression: 65 },
    condition: 94,
    sharpness: 82,
    morale: 84
  }),
  createPlayer({
    teamCode: "che",
    slug: "geovany-quenda",
    name: "Geovany Quenda",
    shirtNumber: null,
    numberStatus: "pending",
    numberSource: "not-confirmed-at-snapshot-cutoff",
    position: "Midfield",
    primaryPosition: "RW",
    positions: ["RW", "RWB", "LW"],
    roles: ["creative-winger", "wing-back"],
    profile: "winger",
    overall: 82,
    attributes: { pace: 91, dribbling: 88, technique: 86, crossing: 82, stamina: 84 },
    condition: 93,
    sharpness: 76,
    morale: 86
  }),
  createPlayer({
    teamCode: "che",
    slug: "liam-delap",
    name: "Liam Delap",
    shirtNumber: 9,
    position: "Offence",
    primaryPosition: "ST",
    positions: ["ST"],
    roles: ["pressing-forward", "advanced-forward"],
    profile: "striker",
    overall: 80,
    attributes: { physical: 86, aggression: 82, pace: 84, finishing: 81, workRate: 84 },
    condition: 96,
    sharpness: 88,
    morale: 84
  }),
  createPlayer({
    teamCode: "che",
    slug: "nicolas-jackson",
    name: "Nicolas Jackson",
    shirtNumber: 15,
    position: "Offence",
    primaryPosition: "ST",
    positions: ["ST", "LW"],
    roles: ["advanced-forward", "channel-runner"],
    profile: "striker",
    overall: 82,
    attributes: { pace: 89, dribbling: 84, finishing: 79, physical: 82, positioning: 84 },
    condition: 93,
    sharpness: 78,
    morale: 82
  }),
  createPlayer({
    teamCode: "che",
    slug: "joao-pedro",
    name: "João Pedro",
    apiAliases: ["Joao Pedro"],
    shirtNumber: 20,
    position: "Offence",
    primaryPosition: "ST",
    positions: ["ST", "AM", "SS"],
    roles: ["complete-forward", "false-nine", "second-striker"],
    profile: "striker",
    overall: 85,
    attributes: {
      technique: 87,
      dribbling: 86,
      finishing: 85,
      passing: 80,
      decisions: 83,
      firstTouch: 87
    },
    condition: 95,
    sharpness: 86,
    morale: 87
  })
];

const MANCHESTER_UNITED_SQUAD = [
  createPlayer({
    teamCode: "mun",
    slug: "altay-bayindir",
    name: "Altay Bayindir",
    apiAliases: ["Altay Bayındır"],
    shirtNumber: 1,
    position: "Goalkeeper",
    primaryPosition: "GK",
    positions: ["GK"],
    roles: ["goalkeeper", "sweeper-keeper"],
    profile: "goalkeeper",
    overall: 78,
    attributes: { goalkeeping: 79, aerial: 81, passing: 68 },
    condition: 96,
    sharpness: 83,
    morale: 81
  }),
  createPlayer({
    teamCode: "mun",
    slug: "karl-darlow",
    name: "Karl Darlow",
    shirtNumber: 12,
    position: "Goalkeeper",
    primaryPosition: "GK",
    positions: ["GK"],
    roles: ["goalkeeper"],
    profile: "goalkeeper",
    overall: 75,
    attributes: { goalkeeping: 77, decisions: 77, pace: 44 },
    condition: 97,
    sharpness: 80,
    morale: 82
  }),
  createPlayer({
    teamCode: "mun",
    slug: "senne-lammens",
    name: "Senne Lammens",
    shirtNumber: 31,
    position: "Goalkeeper",
    primaryPosition: "GK",
    positions: ["GK"],
    roles: ["sweeper-keeper", "goalkeeper"],
    profile: "goalkeeper",
    overall: 83,
    attributes: { goalkeeping: 85, aerial: 84, positioning: 84, decisions: 81, passing: 72 },
    condition: 94,
    sharpness: 85,
    morale: 87
  }),
  createPlayer({
    teamCode: "mun",
    slug: "diogo-dalot",
    name: "Diogo Dalot",
    shirtNumber: 2,
    position: "Defence",
    primaryPosition: "RB",
    positions: ["RB", "LB", "RWB"],
    roles: ["inverted-full-back", "attacking-full-back"],
    profile: "fullBack",
    overall: 82,
    attributes: { pace: 86, stamina: 88, passing: 80, crossing: 82, defending: 78 },
    condition: 95,
    sharpness: 86,
    morale: 85
  }),
  createPlayer({
    teamCode: "mun",
    slug: "noussair-mazraoui",
    name: "Noussair Mazraoui",
    shirtNumber: 3,
    position: "Defence",
    primaryPosition: "RB",
    positions: ["RB", "LB", "RCB"],
    roles: ["inverted-full-back", "wide-centre-back"],
    profile: "fullBack",
    overall: 81,
    attributes: { technique: 82, passing: 81, decisions: 81, defending: 79, pace: 80 },
    condition: 91,
    sharpness: 76,
    morale: 83
  }),
  createPlayer({
    teamCode: "mun",
    slug: "matthijs-de-ligt",
    name: "Matthijs de Ligt",
    shirtNumber: 4,
    position: "Defence",
    primaryPosition: "RCB",
    positions: ["RCB", "CB"],
    roles: ["central-defender", "ball-playing-defender"],
    profile: "centreBack",
    overall: 85,
    attributes: {
      defending: 87,
      positioning: 87,
      physical: 86,
      aerial: 87,
      aggression: 82,
      passing: 77
    },
    condition: 94,
    sharpness: 84,
    morale: 86
  }),
  createPlayer({
    teamCode: "mun",
    slug: "harry-maguire",
    name: "Harry Maguire",
    shirtNumber: 5,
    position: "Defence",
    primaryPosition: "CB",
    positions: ["CB", "RCB"],
    roles: ["aerial-defender", "ball-playing-defender"],
    profile: "centreBack",
    overall: 81,
    attributes: { aerial: 90, physical: 85, defending: 83, positioning: 84, pace: 59, passing: 78 },
    condition: 96,
    sharpness: 88,
    morale: 85
  }),
  createPlayer({
    teamCode: "mun",
    slug: "lisandro-martinez",
    name: "Lisandro Martínez",
    apiAliases: ["Lisandro Martinez"],
    shirtNumber: 6,
    position: "Defence",
    primaryPosition: "LCB",
    positions: ["LCB", "CB", "DM"],
    roles: ["ball-playing-defender", "aggressive-stopper"],
    profile: "centreBack",
    overall: 85,
    attributes: {
      defending: 86,
      positioning: 86,
      passing: 84,
      decisions: 85,
      technique: 80,
      aggression: 89,
      aerial: 72
    },
    condition: 90,
    sharpness: 74,
    morale: 87
  }),
  createPlayer({
    teamCode: "mun",
    slug: "patrick-dorgu",
    name: "Patrick Dorgu",
    apiAliases: ["Patrick Chinazaekpere Dorgu"],
    shirtNumber: 13,
    position: "Defence",
    primaryPosition: "LB",
    positions: ["LB", "LWB", "LW"],
    roles: ["attacking-full-back", "wing-back"],
    profile: "fullBack",
    overall: 81,
    attributes: { pace: 89, physical: 82, stamina: 89, crossing: 80, finishing: 65 },
    condition: 96,
    sharpness: 89,
    morale: 86
  }),
  createPlayer({
    teamCode: "mun",
    slug: "leny-yoro",
    name: "Leny Yoro",
    shirtNumber: 15,
    position: "Defence",
    primaryPosition: "RCB",
    positions: ["RCB", "CB"],
    roles: ["cover-defender", "ball-playing-defender"],
    profile: "centreBack",
    overall: 84,
    attributes: { pace: 84, defending: 85, positioning: 84, aerial: 84, passing: 76 },
    condition: 95,
    sharpness: 86,
    morale: 87
  }),
  createPlayer({
    teamCode: "mun",
    slug: "luke-shaw",
    name: "Luke Shaw",
    shirtNumber: 23,
    position: "Defence",
    primaryPosition: "LB",
    positions: ["LB", "LCB"],
    roles: ["supporting-full-back", "wide-centre-back"],
    profile: "fullBack",
    overall: 81,
    attributes: { physical: 82, crossing: 82, passing: 80, defending: 79, pace: 79 },
    condition: 92,
    sharpness: 82,
    morale: 83
  }),
  createPlayer({
    teamCode: "mun",
    slug: "ayden-heaven",
    name: "Ayden Heaven",
    shirtNumber: 26,
    position: "Defence",
    primaryPosition: "LCB",
    positions: ["LCB", "CB", "LB"],
    roles: ["ball-playing-defender", "cover-defender"],
    profile: "centreBack",
    overall: 78,
    attributes: { pace: 79, passing: 76, technique: 72, defending: 78, aerial: 77 },
    condition: 96,
    sharpness: 88,
    morale: 84
  }),
  createPlayer({
    teamCode: "mun",
    slug: "mason-mount",
    name: "Mason Mount",
    shirtNumber: 7,
    position: "Midfield",
    primaryPosition: "AM",
    positions: ["AM", "CM", "RW"],
    roles: ["pressing-playmaker", "number-eight"],
    profile: "attackingMidfielder",
    overall: 81,
    attributes: { stamina: 87, workRate: 89, pressing: 87, passing: 82, finishing: 78, aggression: 67 },
    condition: 97,
    sharpness: 89,
    morale: 85
  }),
  createPlayer({
    teamCode: "mun",
    slug: "bruno-fernandes",
    name: "Bruno Fernandes",
    shirtNumber: 8,
    position: "Midfield",
    primaryPosition: "AM",
    positions: ["AM", "CM", "RCM"],
    roles: ["advanced-playmaker", "chance-creator", "set-piece-taker"],
    profile: "attackingMidfielder",
    overall: 89,
    attributes: {
      passing: 92,
      decisions: 90,
      technique: 88,
      finishing: 85,
      positioning: 87,
      crossing: 89,
      stamina: 87,
      workRate: 90
    },
    condition: 91,
    sharpness: 76,
    morale: 90
  }),
  createPlayer({
    teamCode: "mun",
    slug: "andrey-santos",
    name: "Andrey Santos",
    shirtNumber: 17,
    numberSource: "official-manchester-united-profile",
    position: "Midfield",
    primaryPosition: "DM",
    positions: ["DM", "CM", "RCM"],
    roles: ["progressive-holding-midfielder", "number-eight"],
    profile: "holdingMidfielder",
    overall: 83,
    attributes: {
      passing: 85,
      decisions: 83,
      positioning: 82,
      tackling: 82,
      technique: 83,
      stamina: 87,
      finishing: 68
    },
    condition: 98,
    sharpness: 87,
    morale: 88
  }),
  createPlayer({
    teamCode: "mun",
    slug: "youri-tielemans",
    name: "Youri Tielemans",
    shirtNumber: 18,
    numberSource: "official-manchester-united-number-announcement",
    position: "Midfield",
    primaryPosition: "CM",
    positions: ["CM", "DM", "RCM", "LCM"],
    roles: ["deep-lying-playmaker", "number-eight"],
    profile: "centralMidfielder",
    overall: 86,
    attributes: {
      passing: 89,
      decisions: 87,
      technique: 87,
      firstTouch: 88,
      finishing: 76,
      positioning: 80
    },
    condition: 90,
    sharpness: 72,
    morale: 87
  }),
  createPlayer({
    teamCode: "mun",
    slug: "manuel-ugarte",
    name: "Manuel Ugarte",
    shirtNumber: 25,
    position: "Midfield",
    primaryPosition: "DM",
    positions: ["DM", "CM"],
    roles: ["ball-winning-midfielder", "holding-midfielder"],
    profile: "holdingMidfielder",
    overall: 82,
    attributes: {
      defending: 84,
      aggression: 88,
      tackling: 86,
      stamina: 87,
      passing: 78,
      decisions: 79
    },
    condition: 84,
    sharpness: 68,
    morale: 82
  }),
  createPlayer({
    teamCode: "mun",
    slug: "kobbie-mainoo",
    name: "Kobbie Mainoo",
    shirtNumber: 37,
    position: "Midfield",
    primaryPosition: "CM",
    positions: ["CM", "DM", "LCM"],
    roles: ["press-resistant-midfielder", "number-eight"],
    profile: "centralMidfielder",
    overall: 84,
    attributes: {
      technique: 88,
      dribbling: 86,
      firstTouch: 89,
      passing: 84,
      decisions: 84,
      defending: 72
    },
    condition: 92,
    sharpness: 76,
    morale: 86
  }),
  createPlayer({
    teamCode: "mun",
    slug: "toby-collyer",
    name: "Toby Collyer",
    shirtNumber: 43,
    position: "Midfield",
    primaryPosition: "DM",
    positions: ["DM", "CM"],
    roles: ["holding-midfielder", "ball-winning-midfielder"],
    profile: "holdingMidfielder",
    overall: 75,
    attributes: { defending: 76, stamina: 85, workRate: 87, passing: 73, decisions: 73 },
    condition: 97,
    sharpness: 90,
    morale: 83
  }),
  createPlayer({
    teamCode: "mun",
    slug: "matheus-cunha",
    name: "Matheus Cunha",
    shirtNumber: 10,
    position: "Offence",
    primaryPosition: "LW",
    positions: ["LW", "AM", "ST", "SS"],
    roles: ["inside-forward", "second-striker", "ball-carrying-forward"],
    profile: "attackingMidfielder",
    overall: 85,
    attributes: {
      dribbling: 89,
      technique: 88,
      finishing: 84,
      pace: 85,
      physical: 80,
      aggression: 72
    },
    condition: 91,
    sharpness: 76,
    morale: 87
  }),
  createPlayer({
    teamCode: "mun",
    slug: "joshua-zirkzee",
    name: "Joshua Zirkzee",
    shirtNumber: 11,
    position: "Offence",
    primaryPosition: "ST",
    positions: ["ST", "SS", "AM"],
    roles: ["false-nine", "link-forward"],
    profile: "striker",
    overall: 81,
    attributes: { physical: 84, technique: 84, passing: 80, firstTouch: 85, finishing: 80, pace: 76 },
    condition: 96,
    sharpness: 88,
    morale: 84
  }),
  createPlayer({
    teamCode: "mun",
    slug: "amad",
    name: "Amad",
    apiAliases: ["Amad Diallo"],
    shirtNumber: 16,
    position: "Offence",
    primaryPosition: "RW",
    positions: ["RW", "AM", "RWB"],
    roles: ["inverted-winger", "creative-winger"],
    profile: "winger",
    overall: 84,
    attributes: {
      technique: 89,
      dribbling: 90,
      firstTouch: 89,
      passing: 83,
      finishing: 80,
      pace: 86
    },
    condition: 91,
    sharpness: 74,
    morale: 87
  }),
  createPlayer({
    teamCode: "mun",
    slug: "bryan-mbeumo",
    name: "Bryan Mbeumo",
    shirtNumber: 19,
    position: "Offence",
    primaryPosition: "RW",
    positions: ["RW", "ST", "RM"],
    roles: ["inside-forward", "wide-forward", "channel-runner"],
    profile: "winger",
    overall: 86,
    attributes: {
      pace: 89,
      physical: 81,
      finishing: 86,
      positioning: 86,
      workRate: 87,
      decisions: 84
    },
    condition: 95,
    sharpness: 86,
    morale: 88
  }),
  createPlayer({
    teamCode: "mun",
    slug: "benjamin-sesko",
    name: "Benjamin Šeško",
    apiAliases: ["Benjamin Sesko"],
    shirtNumber: 30,
    position: "Offence",
    primaryPosition: "ST",
    positions: ["ST"],
    roles: ["advanced-forward", "aerial-forward"],
    profile: "striker",
    overall: 84,
    attributes: {
      physical: 88,
      aerial: 87,
      pace: 87,
      finishing: 85,
      positioning: 85,
      technique: 81
    },
    condition: 82,
    sharpness: 70,
    morale: 85
  }),
  createPlayer({
    teamCode: "mun",
    slug: "marcus-rashford",
    name: "Marcus Rashford",
    shirtNumber: null,
    numberStatus: "pending",
    numberSource: "not-confirmed-at-snapshot-cutoff",
    position: "Offence",
    primaryPosition: "LW",
    positions: ["LW", "ST", "RW"],
    roles: ["inside-forward", "transition-forward"],
    profile: "winger",
    overall: 83,
    attributes: { pace: 91, finishing: 82, dribbling: 84, physical: 79, positioning: 82 },
    condition: 90,
    sharpness: 74,
    morale: 82
  })
];

const CHELSEA_LINEUPS = [
  createLineup({
    id: "che-lineup-4-2-3-1",
    label: "Controle entrelinhas",
    formation: "4-2-3-1",
    inPossession: "3-2-4-1",
    outOfPossession: "4-4-2",
    slots: [
      { role: "GK", playerId: "che-robert-sanchez", duty: "support" },
      { role: "RB", playerId: "che-reece-james", duty: "invert" },
      { role: "RCB", playerId: "che-trevoh-chalobah", duty: "defend" },
      { role: "LCB", playerId: "che-levi-colwill", duty: "cover" },
      { role: "LB", playerId: "che-jorrel-hato", duty: "support" },
      { role: "DM", playerId: "che-moises-caicedo", duty: "hold" },
      { role: "CM", playerId: "che-enzo-fernandez", duty: "progress" },
      { role: "RW", playerId: "che-pedro-neto", duty: "attack" },
      { role: "AM", playerId: "che-cole-palmer", duty: "create" },
      { role: "LW", playerId: "che-morgan-rogers", duty: "attack" },
      { role: "ST", playerId: "che-joao-pedro", duty: "link" }
    ],
    captainId: "che-reece-james",
    penaltyTakerId: "che-cole-palmer",
    freeKickTakerId: "che-cole-palmer",
    cornerTakerIds: ["che-cole-palmer", "che-enzo-fernandez"]
  }),
  createLineup({
    id: "che-lineup-4-3-3",
    label: "Controle com três médios",
    formation: "4-3-3",
    inPossession: "3-2-5",
    outOfPossession: "4-1-4-1",
    slots: [
      { role: "GK", playerId: "che-robert-sanchez", duty: "support" },
      { role: "RB", playerId: "che-reece-james", duty: "invert" },
      { role: "RCB", playerId: "che-wesley-fofana", duty: "defend" },
      { role: "LCB", playerId: "che-levi-colwill", duty: "cover" },
      { role: "LB", playerId: "che-jorrel-hato", duty: "support" },
      { role: "DM", playerId: "che-moises-caicedo", duty: "hold" },
      { role: "RCM", playerId: "che-enzo-fernandez", duty: "progress" },
      { role: "LCM", playerId: "che-morgan-rogers", duty: "carry" },
      { role: "RW", playerId: "che-cole-palmer", duty: "create" },
      { role: "ST", playerId: "che-joao-pedro", duty: "link" },
      { role: "LW", playerId: "che-pedro-neto", duty: "attack" }
    ],
    captainId: "che-reece-james",
    penaltyTakerId: "che-cole-palmer",
    freeKickTakerId: "che-cole-palmer",
    cornerTakerIds: ["che-cole-palmer", "che-enzo-fernandez"]
  })
];

const MANCHESTER_UNITED_LINEUPS = [
  createLineup({
    id: "mun-lineup-4-3-3",
    label: "Progressão e ataque aos corredores",
    formation: "4-3-3",
    inPossession: "3-2-5",
    outOfPossession: "4-1-4-1",
    slots: [
      { role: "GK", playerId: "mun-senne-lammens", duty: "support" },
      { role: "RB", playerId: "mun-diogo-dalot", duty: "invert" },
      { role: "RCB", playerId: "mun-matthijs-de-ligt", duty: "defend" },
      { role: "LCB", playerId: "mun-lisandro-martinez", duty: "progress" },
      { role: "LB", playerId: "mun-patrick-dorgu", duty: "attack" },
      { role: "DM", playerId: "mun-andrey-santos", duty: "hold" },
      { role: "RCM", playerId: "mun-youri-tielemans", duty: "progress" },
      { role: "LCM", playerId: "mun-bruno-fernandes", duty: "create" },
      { role: "RW", playerId: "mun-bryan-mbeumo", duty: "attack" },
      { role: "ST", playerId: "mun-benjamin-sesko", duty: "attack" },
      { role: "LW", playerId: "mun-matheus-cunha", duty: "roam" }
    ],
    captainId: "mun-bruno-fernandes",
    penaltyTakerId: "mun-bruno-fernandes",
    freeKickTakerId: "mun-bruno-fernandes",
    cornerTakerIds: ["mun-bruno-fernandes", "mun-bryan-mbeumo"]
  }),
  createLineup({
    id: "mun-lineup-4-2-3-1",
    label: "Bruno entrelinhas",
    formation: "4-2-3-1",
    inPossession: "3-2-4-1",
    outOfPossession: "4-4-2",
    slots: [
      { role: "GK", playerId: "mun-senne-lammens", duty: "support" },
      { role: "RB", playerId: "mun-diogo-dalot", duty: "invert" },
      { role: "RCB", playerId: "mun-matthijs-de-ligt", duty: "defend" },
      { role: "LCB", playerId: "mun-lisandro-martinez", duty: "progress" },
      { role: "LB", playerId: "mun-patrick-dorgu", duty: "attack" },
      { role: "DM", playerId: "mun-andrey-santos", duty: "hold" },
      { role: "CM", playerId: "mun-youri-tielemans", duty: "progress" },
      { role: "RW", playerId: "mun-bryan-mbeumo", duty: "attack" },
      { role: "AM", playerId: "mun-bruno-fernandes", duty: "create" },
      { role: "LW", playerId: "mun-matheus-cunha", duty: "roam" },
      { role: "ST", playerId: "mun-benjamin-sesko", duty: "attack" }
    ],
    captainId: "mun-bruno-fernandes",
    penaltyTakerId: "mun-bruno-fernandes",
    freeKickTakerId: "mun-bruno-fernandes",
    cornerTakerIds: ["mun-bruno-fernandes", "mun-bryan-mbeumo"]
  })
];

const CHELSEA_TACTICS = {
  "4-2-3-1": {
    formation: "4-2-3-1",
    formationInPossession: "3-2-4-1",
    formationOutOfPossession: "4-4-2",
    mentality: 57,
    defensiveLine: 55,
    blockHeight: 57,
    width: 59,
    widthInPossession: 61,
    widthOutOfPossession: 54,
    pressing: 66,
    pressingIntensity: 66,
    tempo: 59,
    passingRisk: 56,
    counterpress: true,
    restDefenseCount: 3
  },
  "4-3-3": {
    formation: "4-3-3",
    formationInPossession: "3-2-5",
    formationOutOfPossession: "4-1-4-1",
    mentality: 55,
    defensiveLine: 54,
    blockHeight: 56,
    width: 62,
    widthInPossession: 64,
    widthOutOfPossession: 56,
    pressing: 63,
    pressingIntensity: 63,
    tempo: 56,
    passingRisk: 53,
    counterpress: true,
    restDefenseCount: 3
  }
};

const MANCHESTER_UNITED_TACTICS = {
  "4-3-3": {
    formation: "4-3-3",
    formationInPossession: "3-2-5",
    formationOutOfPossession: "4-1-4-1",
    mentality: 56,
    defensiveLine: 57,
    blockHeight: 58,
    width: 63,
    widthInPossession: 65,
    widthOutOfPossession: 56,
    pressing: 64,
    pressingIntensity: 64,
    tempo: 61,
    passingRisk: 57,
    counterpress: true,
    restDefenseCount: 3
  },
  "4-2-3-1": {
    formation: "4-2-3-1",
    formationInPossession: "3-2-4-1",
    formationOutOfPossession: "4-4-2",
    mentality: 58,
    defensiveLine: 56,
    blockHeight: 58,
    width: 61,
    widthInPossession: 63,
    widthOutOfPossession: 55,
    pressing: 65,
    pressingIntensity: 65,
    tempo: 62,
    passingRisk: 58,
    counterpress: true,
    restDefenseCount: 3
  }
};

const CHELSEA_REPORT_ON_UNITED = {
  id: "scout-che-on-mun-2026-07-30",
  subjectTeamId: 66,
  subject: "Manchester United",
  generatedAt: SNAPSHOT_DATE,
  source: "touchline-internal-scouting-model",
  official: false,
  confidence: "prototype",
  expectedFormation: "4-3-3",
  summary:
    "O modelo interno espera criação central de Bruno, aceleração pelo lado direito com Mbeumo e profundidade de Šeško. O risco aumenta quando a primeira pressão é superada e os laterais estão altos.",
  strengths: [
    {
      id: "mun-central-creation",
      title: "Criação entre linhas",
      evidence: "Bruno e Tielemans concentram as maiores notas internas de passe e decisão.",
      implication: "Fechar o passe frontal antes de saltar no portador."
    },
    {
      id: "mun-right-channel",
      title: "Ataque do corredor direito",
      evidence: "Mbeumo combina aceleração, posicionamento e finalização no modelo interno.",
      implication: "Evitar que Hato defenda simultaneamente largura e profundidade."
    },
    {
      id: "mun-box-presence",
      title: "Presença de área",
      evidence: "Šeško oferece altura, corrida em profundidade e ameaça aérea.",
      implication: "Controlar cruzamentos cedo e proteger a zona entre os zagueiros."
    }
  ],
  vulnerabilities: [
    {
      id: "mun-fullback-transition",
      title: "Espaço após subida dos laterais",
      evidence: "O 3-2-5 interno deixa os corredores vulneráveis na primeira transição.",
      opportunity: "Atacar cedo com Neto e Rogers após recuperação."
    },
    {
      id: "mun-midfield-back",
      title: "Retorno atrás da primeira pressão",
      evidence: "Se Santos e Tielemans forem atraídos, há espaço diante da última linha.",
      opportunity: "Usar Palmer como terceiro homem, não como receptor parado."
    }
  ],
  keyPlayerIds: ["mun-bruno-fernandes", "mun-bryan-mbeumo", "mun-benjamin-sesko"],
  recommendedPlan: {
    withBall: "Atrair pela esquerda e inverter rapidamente para Neto no lado fraco.",
    withoutBall: "Bloco médio-alto, Caicedo protegendo Bruno e gatilho de pressão no passe lateral.",
    transition: "Primeiro passe vertical no espaço deixado pelo lateral mais alto.",
    risk: "Uma pressão descoordenada abre o passe de Tielemans para Bruno."
  },
  disclaimer:
    "Relatório gerado para o cenário do MVP a partir dos ratings internos Touchline; não é análise oficial dos clubes."
};

const UNITED_REPORT_ON_CHELSEA = {
  id: "scout-mun-on-che-2026-07-30",
  subjectTeamId: 61,
  subject: "Chelsea",
  generatedAt: SNAPSHOT_DATE,
  source: "touchline-internal-scouting-model",
  official: false,
  confidence: "prototype",
  expectedFormation: "4-2-3-1",
  summary:
    "O modelo interno projeta domínio técnico de Caicedo e Enzo, Palmer recebendo entre linhas e aceleração assimétrica com Neto. A equipe perde proteção se James e o lado oposto avançarem ao mesmo tempo.",
  strengths: [
    {
      id: "che-midfield-control",
      title: "Controle do centro",
      evidence: "Caicedo e Enzo lideram recuperação, passe e decisão no modelo interno.",
      implication: "Não pressionar em linha reta; bloquear o homem livre atrás do primeiro passe."
    },
    {
      id: "che-palmer-pocket",
      title: "Palmer entre linhas",
      evidence: "Palmer tem os maiores índices internos de criação e técnica do elenco.",
      implication: "Um volante acompanha a zona; o zagueiro não deve abandonar a linha cedo."
    },
    {
      id: "che-wide-acceleration",
      title: "Aceleração no lado fraco",
      evidence: "Neto, Rogers e os laterais oferecem condução e mudança de ritmo.",
      implication: "O ponta do lado oposto precisa recompor antes da inversão."
    }
  ],
  vulnerabilities: [
    {
      id: "che-right-back-space",
      title: "Espaço atrás do lateral direito",
      evidence: "James recebe função interna e agressiva no plano do MVP.",
      opportunity: "Cunha pode atacar o corredor assim que a posse muda."
    },
    {
      id: "che-build-up-pressure",
      title: "Risco na saída sob pressão orientada",
      evidence: "Forçar o passe para a lateral reduz as opções de progressão central.",
      opportunity: "Šeško fecha o retorno; Mbeumo salta no receptor externo."
    }
  ],
  keyPlayerIds: ["che-moises-caicedo", "che-enzo-fernandez", "che-cole-palmer"],
  recommendedPlan: {
    withBall: "Fixar Hato por fora e atacar o intervalo entre lateral e zagueiro.",
    withoutBall: "Negar Palmer por dentro e orientar a saída para o lado esquerdo do Chelsea.",
    transition: "Buscar Cunha cedo no espaço deixado por James.",
    risk: "Baixar demais entrega a entrada da área para Enzo e Palmer."
  },
  disclaimer:
    "Relatório gerado para o cenário do MVP a partir dos ratings internos Touchline; não é análise oficial dos clubes."
};

const CHELSEA_SOURCES = [
  {
    kind: "official-club",
    title: "Chelsea FPL 2026/27 squad list",
    url: "https://www.chelseafc.com/en/news/article/fpl-2026-27-new-chelsea-signings-prices-confirmed",
    checkedAt: SNAPSHOT_DATE,
    covers: ["first-team pool", "summer additions"]
  },
  {
    kind: "official-club",
    title: "Chelsea 2026 pre-season squad numbers",
    url: "https://www.chelseafc.com/en/news/article/chelsea-squad-numbers-2026-pre-season-tour-confirmed",
    checkedAt: SNAPSHOT_DATE,
    covers: ["shirt numbers", "provisional-number warning"]
  },
  {
    kind: "official-club",
    title: "Chelsea 2026 travelling squad",
    url: "https://www.chelseafc.com/en/news/article/confirmed-chelsea-travelling-squad-for-2026-pre-season-tour",
    checkedAt: SNAPSHOT_DATE,
    covers: ["pre-season availability"]
  },
  {
    kind: "official-club",
    title: "Chelsea summer transfers 2026",
    url: "https://www.chelseafc.com/en/news/article/summer-transfers-2026-all-the-chelsea-ins-outs-and-new-contracts-so-far",
    checkedAt: SNAPSHOT_DATE,
    covers: ["arrivals", "departures"]
  },
  {
    kind: "official-club",
    title: "Morgan Rogers signs for Chelsea",
    url: "https://www.chelseafc.com/en/news/article/morgan-rogers-signs-for-chelsea",
    checkedAt: SNAPSHOT_DATE,
    covers: ["Morgan Rogers"]
  },
  {
    kind: "official-league",
    title: "Premier League Chelsea squad 2026/27",
    url: "https://www.premierleague.com/en/clubs/8/chelsea/squad",
    checkedAt: SNAPSHOT_DATE,
    covers: ["squad groups", "published shirt numbers"]
  }
];

const MANCHESTER_UNITED_SOURCES = [
  {
    kind: "official-club",
    title: "Manchester United men's first team",
    url: "https://www.manutd.com/en/teams/mens-team",
    checkedAt: SNAPSHOT_DATE,
    covers: ["current first-team pool", "shirt numbers"]
  },
  {
    kind: "official-club",
    title: "Manchester United summer transfers",
    url: "https://www.manutd.com/en/news/uniteds-summer-transfers-ins-and-outs",
    checkedAt: SNAPSHOT_DATE,
    covers: ["arrivals", "departures"]
  },
  {
    kind: "official-club",
    title: "Andrey Santos player profile",
    url: "https://www.manutd.com/en/teams/mens-team/andrey-santos",
    checkedAt: SNAPSHOT_DATE,
    covers: ["Andrey Santos", "shirt number"]
  },
  {
    kind: "official-club",
    title: "United announce Tielemans signing",
    url: "https://www.manutd.com/en/news/manchester-united-announce-signing-of-youri-tielemans",
    checkedAt: SNAPSHOT_DATE,
    covers: ["Youri Tielemans"]
  },
  {
    kind: "official-club",
    title: "Karl Darlow signs for United",
    url: "https://www.manutd.com/en/news/karl-darlow-signs-for-manchester-united",
    checkedAt: SNAPSHOT_DATE,
    covers: ["Karl Darlow"]
  },
  {
    kind: "official-league",
    title: "Premier League Manchester United squad 2026/27",
    url: "https://www.premierleague.com/en/clubs/1/manchester-united/squad",
    checkedAt: SNAPSHOT_DATE,
    covers: ["squad groups", "published shirt numbers"]
  }
];

const CHELSEA_TEAM = createTeam({
  id: 61,
  stableId: "club-chelsea",
  name: "Chelsea FC",
  shortName: "Chelsea",
  tla: "CHE",
  crest: "https://crests.football-data.org/61.png",
  colors: {
    primary: "#034694",
    secondary: "#FFFFFF",
    piece: "#31579A",
    pieceRing: "#E7F0FF"
  },
  displayOverall: 86,
  squad: CHELSEA_SQUAD,
  lineups: CHELSEA_LINEUPS,
  defaultLineup: "4-2-3-1",
  tactics: CHELSEA_TACTICS,
  strengthProfile: {
    buildup: 86,
    progression: 88,
    chanceCreation: 89,
    finishing: 84,
    highPress: 85,
    midBlock: 84,
    boxDefense: 82,
    defensiveTransition: 80,
    setPieces: 82,
    squadDepth: 88,
    emotionalControl: 84
  },
  opponentReport: CHELSEA_REPORT_ON_UNITED,
  sources: CHELSEA_SOURCES
});

const MANCHESTER_UNITED_TEAM = createTeam({
  id: 66,
  stableId: "club-manchester-united",
  name: "Manchester United FC",
  shortName: "Man United",
  tla: "MUN",
  crest: "https://crests.football-data.org/66.png",
  colors: {
    primary: "#DA291C",
    secondary: "#FBE122",
    piece: "#C92D36",
    pieceRing: "#FFF2E8"
  },
  displayOverall: 85,
  squad: MANCHESTER_UNITED_SQUAD,
  lineups: MANCHESTER_UNITED_LINEUPS,
  defaultLineup: "4-3-3",
  tactics: MANCHESTER_UNITED_TACTICS,
  strengthProfile: {
    buildup: 83,
    progression: 85,
    chanceCreation: 88,
    finishing: 85,
    highPress: 82,
    midBlock: 83,
    boxDefense: 84,
    defensiveTransition: 79,
    setPieces: 84,
    squadDepth: 85,
    emotionalControl: 83
  },
  opponentReport: UNITED_REPORT_ON_CHELSEA,
  sources: MANCHESTER_UNITED_SOURCES
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

export const MVP_DATA_METADATA = deepFreeze({
  schemaVersion: "1.0.0",
  snapshotDate: SNAPSHOT_DATE,
  season: "2026/27",
  locale: "pt-BR",
  rosterFinal: false,
  transferWindowOpen: true,
  mode: "local-researched-snapshot",
  ratings: INTERNAL_RATING_MODEL,
  conditionDisclaimer:
    "Condição, ritmo e moral formam o estado inicial do cenário simulado; não representam boletim médico ou medição oficial em tempo real.",
  rosterDisclaimer:
    "O mercado de transferências ainda estava aberto no corte. O snapshot é um fallback local de 25 atletas por clube, não a inscrição final da temporada.",
  licensingDisclaimer:
    "Nomes, escudos e marcas pertencem aos respectivos titulares. Disponibilidade por API ou URL pública não concede licença comercial.",
  api: {
    provider: "football-data.org",
    requiredEnvironmentVariable: "FOOTBALL_DATA_API_KEY",
    configured: false,
    live: false,
    policy:
      "Nenhum helper considera a API ativa sem providerConfigured === true e equipes explicitamente marcadas source === 'live'."
  }
});

export const TEAMS = deepFreeze({
  61: CHELSEA_TEAM,
  66: MANCHESTER_UNITED_TEAM
});

export const MATCH_META = deepFreeze({
  id: "mvp-chelsea-v-manchester-united-2026-10-31",
  scenarioType: "prototype-single-match",
  fixtureOfficial: true,
  snapshotDate: SNAPSHOT_DATE,
  season: "2026/27",
  matchweek: 9,
  fixtureDate: "2026-10-31",
  kickoffLocal: "15:00",
  kickoffStatus: "provisional",
  venue: "Stamford Bridge",
  competition: {
    id: "PL",
    name: "Premier League",
    officialFixture: true,
    primaryColor: "#37003C"
  },
  homeTeamId: 61,
  awayTeamId: 66,
  userTeamIndex: 1,
  defaultHomeFormation: "4-2-3-1",
  defaultAwayFormation: "4-3-3",
  realDurationSeconds: 120,
  matchMinutes: 90,
  seed: 20260730,
  dataMode: "local-snapshot",
  providerConfigured: false,
  providerLive: false,
  ratingsOfficial: false,
  ratingsSource: INTERNAL_RATING_MODEL.id
});

function cloneValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeIdentity(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function resolveTeam(teamRef) {
  if (teamRef && typeof teamRef === "object" && Array.isArray(teamRef.squad)) {
    return teamRef;
  }

  const normalized = normalizeIdentity(teamRef);
  return (
    Object.values(TEAMS).find(team => {
      return [
        team.id,
        team.stableId,
        team.name,
        team.shortName,
        team.tla
      ].some(value => normalizeIdentity(value) === normalized);
    }) || null
  );
}

function findLineup(team, formation) {
  const selectedFormation = formation || team.defaultLineup;
  return team.lineups[selectedFormation] || team.lineups[team.defaultLineup];
}

export function getMvpTeam(teamRef) {
  return resolveTeam(teamRef);
}

export function cloneMvpTeam(teamRef) {
  const team = resolveTeam(teamRef);
  return team ? cloneValue(team) : null;
}

export function getMvpTeams() {
  return {
    home: cloneMvpTeam(MATCH_META.homeTeamId),
    away: cloneMvpTeam(MATCH_META.awayTeamId)
  };
}

/**
 * Merge provider identity/roster fields into the researched snapshot.
 *
 * This is deliberately fail-closed. Passing an API-shaped object is not enough:
 * callers must explicitly confirm providerConfigured and the normalized team
 * returned by src/football-data.js must have source === "live".
 */
export function mergeTeamWithApi(
  teamRef,
  apiTeam,
  {
    providerConfigured = false,
    provider = "football-data.org"
  } = {}
) {
  const base = cloneMvpTeam(teamRef);
  if (!base) throw new Error(`Unknown MVP team: ${String(teamRef)}`);

  const hasProviderSquad = Array.isArray(apiTeam?.squad) && apiTeam.squad.length > 0;
  const responseIsLive = apiTeam?.source === "live";
  const canMerge = providerConfigured === true && responseIsLive && hasProviderSquad;

  if (!canMerge) {
    const reason = providerConfigured !== true
      ? "provider-not-configured"
      : !responseIsLive
        ? "provider-response-not-live"
        : "provider-squad-empty";

    base.source = "local-snapshot";
    base.dataStatus.providerConfigured = providerConfigured === true;
    base.dataStatus.providerLive = false;
    base.integration = {
      provider,
      configured: providerConfigured === true,
      live: false,
      reason,
      rosterLive: false,
      ratingsLive: false,
      matchedPlayers: 0,
      unmatchedProviderPlayers: []
    };
    return base;
  }

  const providerIndex = new Map();
  apiTeam.squad.forEach(providerPlayer => {
    const identities = [
      providerPlayer.name,
      ...(providerPlayer.apiAliases || [])
    ];
    identities.forEach(identity => {
      const key = normalizeIdentity(identity);
      if (key) providerIndex.set(key, providerPlayer);
    });
  });

  const matchedProviderIds = new Set();
  let matchedPlayers = 0;
  base.squad = base.squad.map(player => {
    const identities = [player.name, ...(player.apiAliases || [])];
    const providerPlayer = identities
      .map(identity => providerIndex.get(normalizeIdentity(identity)))
      .find(Boolean);

    if (!providerPlayer) {
      return {
        ...player,
        providerMatch: false
      };
    }

    matchedPlayers += 1;
    if (providerPlayer.id != null) matchedProviderIds.add(String(providerPlayer.id));
    const providerNumber = Number(providerPlayer.shirtNumber ?? providerPlayer.number);
    const hasProviderNumber = Number.isInteger(providerNumber) && providerNumber > 0;

    return {
      ...player,
      providerIds: {
        ...player.providerIds,
        footballData: providerPlayer.id ?? player.providerIds.footballData
      },
      name: providerPlayer.name || player.name,
      shirtNumber: hasProviderNumber ? providerNumber : player.shirtNumber,
      numberStatus: hasProviderNumber ? "provider-live" : player.numberStatus,
      numberSource: hasProviderNumber ? provider : player.numberSource,
      providerPosition: providerPlayer.position || null,
      providerMatch: true,
      dataProvenance: {
        ...player.dataProvenance,
        identity: provider,
        shirtNumber: hasProviderNumber ? provider : player.dataProvenance.shirtNumber,
        ratings: INTERNAL_RATING_MODEL.id,
        condition: "touchline-internal-match-scenario"
      }
    };
  });

  const unmatchedProviderPlayers = apiTeam.squad
    .filter(player => player.id == null || !matchedProviderIds.has(String(player.id)))
    .map(player => ({
      id: player.id ?? null,
      name: player.name,
      position: player.position || null,
      shirtNumber: player.shirtNumber ?? player.number ?? null,
      ratingsAvailable: false
    }));

  base.name = apiTeam.name || base.name;
  base.shortName = apiTeam.shortName || base.shortName;
  base.tla = apiTeam.tla || base.tla;
  base.crest = apiTeam.crest || base.crest;
  base.source = "live";
  base.dataStatus.providerConfigured = true;
  base.dataStatus.providerLive = true;
  base.dataStatus.rosterSource = provider;
  base.dataStatus.ratingsSource = INTERNAL_RATING_MODEL.id;
  base.integration = {
    provider,
    configured: true,
    live: true,
    reason: "provider-response-live",
    rosterLive: true,
    ratingsLive: false,
    matchedPlayers,
    unmatchedProviderPlayers
  };
  return base;
}

export function mergeTeamsWithApi(
  apiData,
  {
    providerConfigured = false,
    provider = apiData?.provider || "football-data.org"
  } = {}
) {
  const payloadIsLive = apiData?.live === true;
  const allowLiveMerge = providerConfigured === true && payloadIsLive;

  return {
    home: mergeTeamWithApi(MATCH_META.homeTeamId, apiData?.home, {
      providerConfigured: allowLiveMerge,
      provider
    }),
    away: mergeTeamWithApi(MATCH_META.awayTeamId, apiData?.away, {
      providerConfigured: allowLiveMerge,
      provider
    }),
    provider: {
      name: provider,
      configured: providerConfigured === true,
      live: allowLiveMerge,
      reason: allowLiveMerge
        ? "provider-response-live"
        : providerConfigured === true
          ? "provider-response-not-live"
          : "provider-not-configured",
      ratingsLive: false
    }
  };
}

/**
 * Factory consumed by the one-match MVP.
 *
 * Without arguments it always returns independent clones of the researched
 * local snapshot. Live provider data is merged only when both:
 *   1. providerConfigured === true
 *   2. apiData.live === true and each normalized team has source === "live"
 */
export function createMvpMatchData({
  apiData = null,
  providerConfigured = false,
  provider = apiData?.provider || "football-data.org",
  userTeamIndex = MATCH_META.userTeamIndex,
  homeFormation = MATCH_META.defaultHomeFormation,
  awayFormation = MATCH_META.defaultAwayFormation
} = {}) {
  const teams = apiData
    ? mergeTeamsWithApi(apiData, { providerConfigured, provider })
    : {
        ...getMvpTeams(),
        provider: {
          name: provider,
          configured: false,
          live: false,
          reason: "provider-not-configured",
          ratingsLive: false
        }
      };

  const homeLineupDefinition = findLineup(teams.home, homeFormation);
  const awayLineupDefinition = findLineup(teams.away, awayFormation);
  const homeTactics = teams.home.tactics[homeLineupDefinition.formation];
  const awayTactics = teams.away.tactics[awayLineupDefinition.formation];

  return {
    meta: cloneValue({
      ...MATCH_META,
      userTeamIndex,
      defaultHomeFormation: homeLineupDefinition.formation,
      defaultAwayFormation: awayLineupDefinition.formation,
      dataMode: teams.provider.live ? "live-roster-with-internal-ratings" : "local-snapshot",
      providerConfigured: teams.provider.configured,
      providerLive: teams.provider.live
    }),
    home: cloneValue(teams.home),
    away: cloneValue(teams.away),
    userTeamIndex,
    homeLineup: [...homeLineupDefinition.startingIds],
    awayLineup: [...awayLineupDefinition.startingIds],
    homeTactics: cloneValue(homeTactics),
    awayTactics: cloneValue(awayTactics),
    provider: cloneValue(teams.provider)
  };
}
