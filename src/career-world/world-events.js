const MAX_LEDGER_EVENTS = 12000;

function ensureLedger(world) {
  world.events ||= [];
  world.eventSequence = Number(world.eventSequence) || 0;
  return world.events;
}

export function appendWorldEvent(world, event) {
  const ledger = ensureLedger(world);
  const sequence = ++world.eventSequence;
  const date = String(event?.date || world.currentDate || 'unknown');
  const normalized = {
    id: event?.id || `world-${date}-${String(sequence).padStart(6, '0')}`,
    sequence,
    date,
    type: String(event?.type || 'WORLD_EVENT'),
    entities: event?.entities && typeof event.entities === 'object' ? { ...event.entities } : {},
    payload: event?.payload && typeof event.payload === 'object' ? { ...event.payload } : {},
    visibility: event?.visibility || 'world'
  };
  ledger.push(normalized);
  if (ledger.length > MAX_LEDGER_EVENTS) ledger.splice(0, ledger.length - MAX_LEDGER_EVENTS);
  return normalized;
}

export function eventsOnDate(world, date) {
  return (world?.events || []).filter(event => event.date === date);
}

export function eventsByType(world, type) {
  return (world?.events || []).filter(event => event.type === type);
}

export function latestWorldEvents(world, limit = 50) {
  return (world?.events || []).slice(-Math.max(0, Number(limit) || 0)).reverse();
}

export function hasWorldEvent(world, predicate) {
  return (world?.events || []).some(predicate);
}
