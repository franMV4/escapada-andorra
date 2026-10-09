/* Pure helpers: opening hours, distances, customs, share links, weather. Loaded by index.html and by checks.js (node). */
const LIB = (() => {
  const DAY = {Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6};
  const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
  const fmtMin = m => { m %= 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

  // Subset of OSM opening_hours: "Mo-Fr 10:00-14:00,15:00-19:00; Sa 10:00-14:00; Su off", "24/7". Later rules override earlier ones for their days.
  function parseOH(s){
    if (!s) return null;
    s = s.trim();
    if (s === '24/7') return Array.from({length: 7}, () => [[0, 1440]]);
    const week = Array.from({length: 7}, () => null);
    for (let rule of s.split(';')){
      rule = rule.trim();
      if (!rule || /^PH\b/.test(rule)) continue;
      const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)?\s*(.*)$/);
      const days = [];
      if (m[1]) for (const part of m[1].split(',')){
        const [a, b] = part.trim().split('-').map(d => DAY[d]);
        if (b === undefined) days.push(a); else for (let d = a; ; d = (d + 1) % 7){ days.push(d); if (d === b) break; }
      } else days.push(0, 1, 2, 3, 4, 5, 6);
      const t = m[2].replace(/,\s*PH.*$/, '').trim();
      const ranges = /^(off|closed)$/i.test(t) ? [] : t.split(',').map(r => {
        const [a, b] = r.trim().split('-').map(hm);
        return [a, b <= a ? b + 1440 : b];
      });
      for (const d of days) week[d] = ranges;
    }
    return week;
  }

  // {state:'open'|'closed'|'unknown', text}
  function status(week, date){
    if (!week) return {state: 'unknown', text: 'Horario sin confirmar'};
    const d = date.getDay(), t = date.getHours() * 60 + date.getMinutes();
    const prev = week[(d + 6) % 7] || [];
    for (const [a, b] of prev) if (b > 1440 && t < b - 1440) return {state: 'open', text: 'Abierto · cierra a las ' + fmtMin(b)};
    const today = week[d];
    if (today === null) return {state: 'unknown', text: 'Horario de hoy sin confirmar'};
    for (const [a, b] of today) if (t >= a && t < b) return {state: 'open', text: b >= 1440 && a === 0 && b === 1440 ? 'Abierto 24 h' : 'Abierto · cierra a las ' + fmtMin(b)};
    const next = today.find(([a]) => a > t);
    return {state: 'closed', text: next ? 'Cerrado · abre a las ' + fmtMin(next[0]) : 'Cerrado ahora'};
  }
  // text for one weekday: null unknown, '' closed, otherwise "13:00–15:30 · 20:30–22:30"
  function dayText(week, dow){
    if (!week || week[dow] === null) return null;
    if (!week[dow].length) return '';
    return week[dow].map(([a, b]) => a === 0 && b === 1440 ? '24 h' : fmtMin(a) + '–' + fmtMin(b)).join(' · ');
  }
  // is it open at minute t of weekday dow? null when unknown
  function openAt(week, dow, t){
    if (!week || week[dow] === null) return null;
    const prev = week[(dow + 6) % 7] || [];
    if (prev.some(([, b]) => b > 1440 && t < b - 1440)) return true;
    return week[dow].some(([a, b]) => t >= a && t < b);
  }

  const dist = (a, b) => {
    const r = Math.PI / 180, x = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(x));
  };
  // ponytail: straight line × detour factor; walking 80 m/min, mountain driving ~38 km/h + 3 min to park. Good enough for a 3-day plan, not for navigation.
  function travel(m){
    if (m < 120) return {mode: 'walk', min: 1, text: 'al lado'};
    if (m <= 1500) { const min = Math.max(2, Math.round(m * 1.3 / 80)); return {mode: 'walk', min, text: `≈${min} min a pie`}; }
    const min = Math.round(m * 1.5 / 633 + 3);
    return {mode: 'car', min, text: `≈${min} min en coche`};
  }

  // Spain allowances for travellers coming from Andorra (AEAT). Groups: share of the group limit adds up across items.
  const CUSTOMS = [
    {k: 'cig', lu: 'cigarrillos', n: 'Cajetillas de cigarrillos', u: 'cajetillas (20 u)', per: 20, lim: 300, g: 'tabaco', adult: 1},
    {k: 'cigr', lu: 'u', n: 'Cigarritos', u: 'unidades', per: 1, lim: 150, g: 'tabaco', adult: 1},
    {k: 'puro', lu: 'u', n: 'Puros', u: 'unidades', per: 1, lim: 75, g: 'tabaco', adult: 1},
    {k: 'pic', lu: 'g', n: 'Tabaco de liar o pipa', u: 'gramos', per: 1, lim: 400, g: 'tabaco', adult: 1},
    {k: 'lic', lu: 'L', n: 'Licores de más de 22°', u: 'botellas de 70 cl', per: 0.7, lim: 1.5, g: 'licor', adult: 1},
    {k: 'lic2', lu: 'L', n: 'Bebidas de 22° o menos (vermut, cava…)', u: 'botellas de 75 cl', per: 0.75, lim: 3, g: 'licor', adult: 1},
    {k: 'vino', lu: 'L', n: 'Vino tranquilo', u: 'botellas de 75 cl', per: 0.75, lim: 5, adult: 1},
    {k: 'cerv', lu: 'L', n: 'Cerveza', u: 'latas de 33 cl', per: 0.33, lim: 16, adult: 1},
    {k: 'perf', lu: 'ml', n: 'Perfume', u: 'ml', per: 1, lim: 75},
    {k: 'col', lu: 'ml', n: 'Agua de colonia', u: 'ml', per: 1, lim: 375},
    {k: 'cafe', lu: 'g', n: 'Café', u: 'gramos', per: 1, lim: 1000},
    {k: 'te', lu: 'g', n: 'Té', u: 'gramos', per: 1, lim: 200},
    {k: 'otros', lu: '€', n: 'Resto de compras', u: '€', per: 1, lim: 900},
  ];
  function customs(q, adult){
    const rows = CUSTOMS.map(c => {
      const amount = (q[c.k] || 0) * c.per;
      const lim = c.adult && !adult ? 0 : c.lim;
      return {...c, amount, limit: lim, pct: lim ? amount / lim : (amount ? Infinity : 0)};
    });
    const groups = {};
    for (const r of rows) if (r.g) groups[r.g] = (groups[r.g] || 0) + r.pct;
    const over = rows.filter(r => r.g ? groups[r.g] > 1.0001 && r.amount > 0 : r.pct > 1.0001);
    return {rows, groups, over};
  }

  const b64e = obj => { const bytes = new TextEncoder().encode(JSON.stringify(obj)); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const b64d = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return JSON.parse(new TextDecoder().decode(Uint8Array.from(s, c => c.charCodeAt(0)))); };

  // WMO weather code -> [label, icon key, severity]
  function wmo(c){
    if (c === 0) return ['Despejado', 'sun', 0];
    if (c <= 2) return ['Poco nuboso', 'part', 1];
    if (c === 3) return ['Nublado', 'cloud', 2];
    if (c === 45 || c === 48) return ['Niebla', 'fog', 3];
    if (c >= 51 && c <= 57) return ['Llovizna', 'rain', 4];
    if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return ['Lluvia', 'rain', 5];
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return ['Nieve', 'snow', 6];
    if (c >= 95) return ['Tormenta', 'storm', 7];
    return ['Variable', 'cloud', 2];
  }
  // aggregate hourly block (arrays for the hours in a window)
  function block(h){
    const worst = h.code.reduce((w, c) => wmo(c)[2] > wmo(w)[2] ? c : w, h.code[0]);
    return {tmin: Math.min(...h.temp), tmax: Math.max(...h.temp), pop: Math.max(...h.pop), snow: h.snow.reduce((a, b) => a + b, 0), wind: Math.max(...h.wind), code: worst};
  }
  function verdict(b){
    if (b.snow > 0.5 || b.pop >= 70 || b.wind >= 55 || b.code >= 95) return ['bad', 'Mal día'];
    if (b.snow > 0 || b.pop >= 40 || b.wind >= 35 || b.tmax < 0) return ['meh', 'Dudoso'];
    return ['good', 'Buen día'];
  }

  return {parseOH, status, dayText, openAt, fmtMin, DOW, dist, travel, CUSTOMS, customs, b64e, b64d, wmo, block, verdict};
})();
if (typeof module !== 'undefined') module.exports = LIB;
