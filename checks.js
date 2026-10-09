// node checks.js — smallest checks for the logic in lib.js
const assert = require('assert');
const L = require('./lib.js');

// opening hours
const canManel = L.parseOH('Mo,Th-Su 13:00-15:30,20:30-22:30; Tu,We off');
assert.strictEqual(L.dayText(canManel, 1), '13:00–15:30 · 20:30–22:30');
assert.strictEqual(L.dayText(canManel, 2), '');
assert.strictEqual(L.status(canManel, new Date(2026, 9, 10, 14, 0)).state, 'open');   // Saturday 14:00
assert.strictEqual(L.status(canManel, new Date(2026, 9, 10, 17, 0)).text, 'Cerrado · abre a las 20:30');
const monkeys = L.parseOH('Mo-Fr 16:00-01:00; Sa,Su 12:00-01:00');
assert.strictEqual(L.status(monkeys, new Date(2026, 9, 11, 0, 30)).state, 'open');   // Sunday 00:30, Saturday's late shift
assert.strictEqual(L.openAt(monkeys, 1, 10 * 60), false);
assert.strictEqual(L.parseOH(''), null);
assert.strictEqual(L.dayText(L.parseOH('24/7'), 3), '24 h');
assert.strictEqual(L.dayText(L.parseOH('Mo-Fr 08:30-20:00; Sa,Su 08:00-15:00; PH off'), 6), '08:00–15:00');

// distance + travel
const d = L.dist([42.50978, 1.54091], [42.50661, 1.52051]);
assert(d > 1600 && d < 1800, d);
assert.strictEqual(L.travel(d).mode, 'car');
assert.strictEqual(L.travel(900).mode, 'walk');

// customs: 10 packs = 200 cigarettes ok; + 50 puros = 66% + 66% > 100% -> over
assert.strictEqual(L.customs({cig: 10}, true).over.length, 0);
assert.strictEqual(L.customs({cig: 10, puro: 50}, true).over.length, 2);
assert.strictEqual(L.customs({vino: 6}, true).over.length, 0);   // 4.5 L
assert.strictEqual(L.customs({vino: 7}, true).over.length, 1);   // 5.25 L
assert.strictEqual(L.customs({cig: 1}, false).over.length, 1);   // minors get no tobacco allowance

// share links round-trip with accents
const plan = {v: 1, d: [[['r_canmanel', '21:00', 'Reserva a nombre de Fran, sin gluten', 0]], [], []]};
assert.deepStrictEqual(L.b64d(L.b64e(plan)), plan);

// weather verdicts
assert.strictEqual(L.verdict({snow: 0, pop: 10, wind: 10, code: 1, tmax: 12})[0], 'good');
assert.strictEqual(L.verdict({snow: 2, pop: 80, wind: 10, code: 71, tmax: -2})[0], 'bad');
console.log('checks ok');
