const HULL_STADIUM_ASSET = '/assets/clubs/2026-27/hul/stadium.png';
let assetPromise = null;

export function hullStadiumObjectUrl() {
  if (!assetPromise) assetPromise = Promise.resolve(HULL_STADIUM_ASSET);
  return assetPromise;
}
