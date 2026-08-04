const CLUB_CODES = Object.freeze([
  'ARS', 'AVL', 'BHA', 'BOU', 'BRE', 'CHE', 'COV', 'CRY', 'EVE', 'FUL',
  'HUL', 'IPS', 'LEE', 'LIV', 'MCI', 'MUN', 'NEW', 'NFO', 'SUN', 'TOT'
]);

const CUSTOM_STADIUM_BY_CLUB = Object.freeze({
  HUL: '/assets/clubs/2026-27/hul/stadium-custom.svg'
});

export const STADIUM_EXTENSION_BY_CLUB = Object.freeze(Object.fromEntries(
  CLUB_CODES.map(code => [code, code === 'HUL' ? 'png' : 'jpg'])
));

const FALLBACK_EXTENSIONS = Object.freeze(['webp', 'jpg', 'png', 'jpeg']);

export function stadiumAssetCandidates(clubCode) {
  const code = String(clubCode || '').toUpperCase();
  const slug = code.toLowerCase();
  const preferred = STADIUM_EXTENSION_BY_CLUB[code] || 'jpg';
  const extensions = [preferred, ...FALLBACK_EXTENSIONS]
    .filter((extension, index, values) => values.indexOf(extension) === index);
  const standard = extensions.map(extension =>
    `/assets/clubs/2026-27/${slug}/stadium.${extension}`
  );
  const custom = CUSTOM_STADIUM_BY_CLUB[code];
  return custom ? [custom, ...standard] : standard;
}

export function canonicalStadiumAsset(clubCode) {
  return stadiumAssetCandidates(clubCode)[0];
}
