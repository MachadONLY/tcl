const HULL_STADIUM_SVG = '/assets/clubs/2026-27/hul/stadium-custom.svg';
let objectUrlPromise = null;

function normalizeBase64(value) {
  const compact = String(value || '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/=+$/g, '');

  if (!compact || /[^A-Za-z0-9+/]/.test(compact) || compact.length % 4 === 1) {
    throw new Error('Hull stadium embedded WebP has invalid base64 data');
  }

  const missingPadding = (4 - (compact.length % 4)) % 4;
  return compact + '='.repeat(missingPadding);
}

function decodeBase64(value) {
  const binary = window.atob(normalizeBase64(value));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function hullStadiumObjectUrl() {
  if (objectUrlPromise) return objectUrlPromise;

  objectUrlPromise = fetch(HULL_STADIUM_SVG, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`Hull stadium HTTP ${response.status}`);
      return response.text();
    })
    .then(svg => {
      const match = svg.match(/href=["']data:image\/webp;base64,([^"']+)["']/i);
      if (!match?.[1]) throw new Error('Hull stadium embedded WebP is missing');
      const bytes = decodeBase64(match[1]);
      if (!bytes.length) throw new Error('Hull stadium embedded WebP is empty');
      return URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
    })
    .catch(error => {
      objectUrlPromise = null;
      throw error;
    });

  return objectUrlPromise;
}
