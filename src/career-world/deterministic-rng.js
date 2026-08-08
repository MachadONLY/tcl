export function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value ?? '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seedFromParts(...parts) {
  return parts.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join('::');
}

export function createDeterministicRng(seed) {
  let state = hashString(seed) || 0x9e3779b9;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomUnit(...parts) {
  return createDeterministicRng(seedFromParts(...parts))();
}

export function randomInt(minimum, maximum, ...parts) {
  const low = Math.ceil(Math.min(minimum, maximum));
  const high = Math.floor(Math.max(minimum, maximum));
  if (high <= low) return low;
  return low + Math.floor(randomUnit(...parts) * (high - low + 1));
}

export function deterministicChoice(items, ...parts) {
  if (!Array.isArray(items) || !items.length) return null;
  return items[Math.min(items.length - 1, Math.floor(randomUnit(...parts) * items.length))];
}

export function deterministicShuffle(items, ...parts) {
  const result = [...(items || [])];
  const random = createDeterministicRng(seedFromParts(...parts));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
