const originalJsonParse = JSON.parse;

function normalizeDatasetJson(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/:\s*NaN(?=\s*[,}])/g, ': null')
    .replace(/:\s*-?Infinity(?=\s*[,}])/g, ': null');
}

JSON.parse = function parseJsonWithMissingValues(value, reviver) {
  return originalJsonParse(normalizeDatasetJson(value), reviver);
};

try {
  const { main } = await import('./sync-fc26-ratings.mjs');
  await main();
} finally {
  JSON.parse = originalJsonParse;
}
