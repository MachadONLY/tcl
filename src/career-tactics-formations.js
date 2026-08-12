export const TACTICS_FORMATION_GROUPS = Object.freeze([
  Object.freeze({
    label: 'Quatro defensores',
    formations: Object.freeze(['4-2-3-1', '4-3-3', '4-4-2', '4-1-4-1', '4-3-2-1', '4-2-2-2', '4-2-1-3', '4-1-2-1-2', '4-4-1-1'])
  }),
  Object.freeze({
    label: 'Três defensores',
    formations: Object.freeze(['3-4-2-1', '3-5-2', '3-1-4-2'])
  }),
  Object.freeze({
    label: 'Cinco defensores',
    formations: Object.freeze(['5-3-2', '5-2-1-2', '5-4-1'])
  })
]);

export const TACTICS_FORMATION_SLOTS = Object.freeze({
  '4-2-3-1': Object.freeze([[50,91],[16,73],[38,77],[62,77],[84,73],[38,57],[62,57],[17,34],[50,39],[83,34],[50,15]]),
  '4-3-3': Object.freeze([[50,91],[16,73],[38,77],[62,77],[84,73],[30,53],[50,59],[70,53],[17,27],[50,18],[83,27]]),
  '4-4-2': Object.freeze([[50,91],[16,73],[38,77],[62,77],[84,73],[16,46],[39,55],[61,55],[84,46],[36,19],[64,19]]),
  '4-1-4-1': Object.freeze([[50,91],[16,73],[38,77],[62,77],[84,73],[50,59],[16,40],[38,44],[62,44],[84,40],[50,15]]),
  '4-3-2-1': Object.freeze([[50,91],[16,73],[38,77],[62,77],[84,73],[29,55],[50,61],[71,55],[34,34],[66,34],[50,14]]),
  '4-2-2-2': Object.freeze([[50,91],[16,73],[38,77],[62,77],[84,73],[39,57],[61,57],[23,37],[77,37],[36,17],[64,17]]),
  '4-2-1-3': Object.freeze([[50,91],[16,73],[38,77],[62,77],[84,73],[39,58],[61,58],[50,40],[17,24],[50,15],[83,24]]),
  '4-1-2-1-2': Object.freeze([[50,91],[16,73],[38,77],[62,77],[84,73],[50,61],[31,49],[69,49],[50,34],[36,16],[64,16]]),
  '4-4-1-1': Object.freeze([[50,91],[16,73],[38,77],[62,77],[84,73],[16,47],[39,54],[61,54],[84,47],[50,31],[50,14]]),
  '3-4-2-1': Object.freeze([[50,91],[24,75],[50,79],[76,75],[14,51],[38,57],[62,57],[86,51],[35,34],[65,34],[50,14]]),
  '3-5-2': Object.freeze([[50,91],[24,75],[50,79],[76,75],[13,49],[35,56],[50,49],[65,56],[87,49],[36,18],[64,18]]),
  '3-1-4-2': Object.freeze([[50,91],[24,75],[50,79],[76,75],[50,61],[14,43],[38,48],[62,48],[86,43],[36,17],[64,17]]),
  '5-3-2': Object.freeze([[50,91],[10,65],[30,76],[50,80],[70,76],[90,65],[28,47],[50,55],[72,47],[36,18],[64,18]]),
  '5-2-1-2': Object.freeze([[50,91],[10,65],[30,76],[50,80],[70,76],[90,65],[38,51],[62,51],[50,34],[36,16],[64,16]]),
  '5-4-1': Object.freeze([[50,91],[10,65],[30,76],[50,80],[70,76],[90,65],[16,42],[39,50],[61,50],[84,42],[50,14]])
});

export const TACTICS_FORMATIONS = Object.freeze(TACTICS_FORMATION_GROUPS.flatMap(group => group.formations));

export function isTacticsFormation(value) {
  return Object.hasOwn(TACTICS_FORMATION_SLOTS, value);
}

export function formationOptionsMarkup(selected) {
  return TACTICS_FORMATION_GROUPS.map(group => `<optgroup label="${group.label}">${group.formations.map(formation =>
    `<option value="${formation}" ${formation === selected ? 'selected' : ''}>${formation}</option>`
  ).join('')}</optgroup>`).join('');
}
