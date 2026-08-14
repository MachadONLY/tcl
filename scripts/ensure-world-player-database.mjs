import { syncWorldPlayerDatabase } from './sync-world-player-database.mjs';

try {
  await syncWorldPlayerDatabase({ force: false, datasetOnly: false });
} catch (error) {
  console.warn(`⚠ World Player Database unavailable for this boot: ${error.message}`);
  console.warn('  Touchline will start with the committed Premier League world and retry on a future boot.');
}
