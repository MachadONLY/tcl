const CLUB_CODES = Object.freeze([
  'ARS', 'AVL', 'BHA', 'BOU', 'BRE', 'CHE', 'COV', 'CRY', 'EVE', 'FUL',
  'HUL', 'IPS', 'LEE', 'LIV', 'MCI', 'MUN', 'NEW', 'NFO', 'SUN', 'TOT'
]);

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

  return extensions.map(extension =>
    `/assets/clubs/2026-27/${slug}/stadium.${extension}`
  );
}

export function canonicalStadiumAsset(clubCode) {
  return stadiumAssetCandidates(clubCode)[0];
}
