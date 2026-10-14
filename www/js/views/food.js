// Kartica Hrana: zadnji obrok, najčešće namirnice i unosi dana
import { addDays, fmt, h, norm, today, toMin } from '../core/format.js';
import { kcalOf, netOf, totals } from '../core/nutrition.js';
import { dayFood, db, lowCarb } from '../store.js';
import { state } from '../ui/dom.js';

export function quickItems() {
  const favs = db.favorites.map(f => ({ ...f, fav: true }));
  const names = new Set(favs.map(f => f.name.toLowerCase()));
  const recent = [];
  for (const f of [...db.foods].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))) {
    const k = f.name.toLowerCase();
    if (names.has(k)) continue;
    names.add(k);
    recent.push(f.src ? { name: f.name, per100: true, grams: f.grams, ...f.src } : { name: f.name, carbs: f.carbs, fiber: f.fiber, fat: f.fat, protein: f.protein, grams: f.grams });
    if (recent.length >= 10) break;
  }
  return [...favs, ...recent];
}
// Obroci: unosi istog dana razmaknuti najviše 60 min čine jedan obrok
function mealsOf(date) {
  const meals = [];
  let cur = null, last = -1e9;
  for (const f of dayFood(date)) {
    const m = toMin(f.time);
    if (!cur || m - last > 60) { cur = { items: [], start: f.time, end: f.time }; meals.push(cur); }
    cur.items.push(f); cur.end = f.time; last = m;
  }
  return meals;
}
// Najčešće namirnice zadnjih 90 dana (vrijednosti iz zadnjeg unosa)
function frequentItems(limit = 10) {
  const from = addDays(today(), -89), map = new Map();
  for (const f of db.foods) {
    if (f.date < from) continue;
    const k = norm(f.name), cur = map.get(k);
    if (!cur) map.set(k, { f, n: 1 });
    else { cur.n++; if ((f.date + f.time) > (cur.f.date + cur.f.time)) cur.f = f; }
  }
  const favs = new Set(db.favorites.map(x => norm(x.name)));
  return [...map.entries()]
    .sort((a, b) => b[1].n - a[1].n || (b[1].f.date + b[1].f.time).localeCompare(a[1].f.date + a[1].f.time))
    .slice(0, limit)
    .map(([k, { f, n }]) => ({
      ...(f.src ? { name: f.name, per100: true, grams: f.grams, ...f.src } : { name: f.name, carbs: f.carbs, fiber: f.fiber, fat: f.fat, protein: f.protein, grams: f.grams }),
      inc: f.inc, n, fav: favs.has(k), net: netOf(f), kcal: kcalOf(f)
    }));
}
// Stanje dana u odnosu na ciljeve: kind 'limit' = ne smije se prijeći, 'target' = treba dosegnuti
function statusRow(label, val, goal, kind, unit = 'g') {
  if (!goal) return '';
  const pct = Math.min(100, val / goal * 100), diff = goal - val;
  let txt, cls, col;
  if (kind === 'limit') {
    if (diff >= 0) { txt = `preostalo ${fmt(diff, unit === 'g' ? 1 : 0)} ${unit}`; cls = 'good'; col = 'var(--c-carb)'; }
    else { txt = `preko za ${fmt(-diff, unit === 'g' ? 1 : 0)} ${unit}`; cls = 'bad'; col = 'var(--bad)'; }
  } else if (kind === 'target') {
    if (diff > 0) { txt = `nedostaje ${fmt(diff)} ${unit}`; cls = 'warn'; col = 'var(--c-prot)'; }
    else { txt = 'cilj dosegnut'; cls = 'good'; col = 'var(--good)'; }
  } else { // orijentacijski (masti, kalorije)
    if (diff >= 0) { txt = `preostalo ${fmt(diff)} ${unit}`; cls = 'muted'; col = label === 'Masti' ? 'var(--c-fat)' : 'var(--accent)'; }
    else { txt = `preko za ${fmt(-diff)} ${unit}`; cls = 'warn'; col = 'var(--warn)'; }
  }
  return `<div class="pbar"><div class="pbar-h"><span>${label} <b>${fmt(val, unit === 'g' && val < 10 ? 1 : 0)}</b> / ${fmt(goal)} ${unit}</span><span class="${cls} small"><b>${txt}</b></span></div>
    <div class="track"><i style="width:${pct}%;background:${col}"></i></div></div>`;
}
function lastMealCard() {
  const s = db.settings, meals = mealsOf(state.date), meal = meals.at(-1);
  if (!meal) return `<section class="card"><div class="card-h"><h2>Zadnji obrok</h2></div><p class="muted" style="margin:0">${state.date === today() ? 'Danas još nema obroka.' : 'Nema obroka za ovaj dan.'}</p></section>`;
  const m = totals(meal.items), day = totals(dayFood(state.date));
  const kc = m.net * 4 + m.protein * 4 + m.fat * 9;
  const pct = v => kc ? Math.round(v / kc * 100) : 0;
  const fatPct = pct(m.fat * 9), carbPct = pct(m.net * 4), protPct = pct(m.protein * 4);
  const notes = [];
  if (lowCarb() && s.carbLimit && m.net > s.carbLimit * 0.5) notes.push(['warn', `Ovaj obrok potrošio je ${fmt(m.net / s.carbLimit * 100)}% dnevnog limita UH.`]);
  if (m.protein < 20 && kc > 250) notes.push(['info', 'Malo proteina u obroku – ciljaj oko 25–40 g po glavnom obroku.']);
  if (lowCarb() && kc && carbPct > 10) notes.push(['warn', `UH čine ${carbPct}% kalorija obroka – za ketozu obično ispod 10%.`]);
  if (lowCarb() && kc && fatPct >= 60 && carbPct <= 10 && m.protein >= 20) notes.push(['good', 'Dobro složen LCHF obrok.']);
  if (!lowCarb() && kc && m.protein >= 25 && m.kcal <= (s.kcalTarget || 2000) * 0.45) notes.push(['good', 'Dobro uravnotežen obrok s dovoljno proteina.']);
  return `<section class="card">
    <div class="card-h"><h2>Zadnji obrok</h2><span class="muted">${meal.start === meal.end ? h(meal.start) : `${h(meal.start)}–${h(meal.end)}`}${meals.length > 1 ? ` · ${meals.length}. obrok` : ''}</span></div>
    <p class="muted small" style="margin:-4px 0 10px">${meal.items.map(f => h(f.name)).join(', ')}</p>
    <div class="tiles tiles4">
      <div class="tile"><b style="color:var(--c-carb)">${fmt(m.net, 1)} g</b><span>neto UH</span></div>
      <div class="tile"><b style="color:var(--c-prot)">${fmt(m.protein)} g</b><span>proteini</span></div>
      <div class="tile"><b style="color:var(--c-fat)">${fmt(m.fat)} g</b><span>masti</span></div>
      <div class="tile"><b>${fmt(m.kcal)}</b><span>kcal</span></div>
    </div>
    <div class="legend" style="margin-top:8px"><span><i style="background:var(--c-fat)"></i>masti ${fatPct}%</span><span><i style="background:var(--c-prot)"></i>proteini ${protPct}%</span><span><i style="background:var(--c-carb)"></i>UH ${carbPct}%</span></div>
    ${notes.length ? `<ul class="insights" style="margin-top:8px">${notes.map(([c, t]) => `<li class="${c}">${t}</li>`).join('')}</ul>` : ''}
    <h3>Stanje dana nakon obroka</h3>
    ${statusRow('Neto UH', day.net, s.carbLimit, lowCarb() ? 'limit' : 'soft')}
    ${statusRow('Proteini', day.protein, s.proteinTarget, 'target')}
    ${statusRow('Masti', day.fat, s.fatTarget, 'soft')}
    ${statusRow('Kalorije', day.kcal, s.kcalTarget, 'soft', 'kcal')}
  </section>`;
}
export function viewFood() {
  const items = dayFood(state.date), t = totals(items);
  state.quick = frequentItems();
  const favNames = new Set(db.favorites.map(f => f.name.toLowerCase()));
  return `
  ${lastMealCard()}
  <section class="card">
    <div class="card-h"><h2>Najčešće namirnice</h2><button class="btn ghost sm" data-action="edit-favs">★ Favoriti${db.favorites.length ? ' (' + db.favorites.length + ')' : ''}</button></div>
    ${state.quick.length ? `<div class="freq">${state.quick.map((q, i) => `
      <button class="freq-item" data-action="quick" data-i="${i}">
        <span class="name">${q.fav ? '<span style="color:#e0a800">★</span> ' : ''}${h(q.name)}</span>
        <span class="muted small">UH ${fmt(q.net, 1)} g · ${fmt(q.kcal)} kcal</span>
        <span class="freq-n">${q.n}×</span>
      </button>`).join('')}</div>`
      : '<p class="muted" style="margin:0">Ovdje će se pojaviti namirnice koje najčešće unosiš – jednim dodirom ih dodaš ponovno.</p>'}
    <div class="btns" style="margin-top:10px"><button class="btn primary" style="flex:1" data-action="add-food">+ Dodaj hranu</button><button class="btn" data-action="scan">Skeniraj</button></div>
  </section>
  <section class="card">
    <div class="card-h"><h2>Unosi</h2><span class="muted">${fmt(t.kcal)} kcal</span></div>
    ${items.length ? `<ul class="list">${items.map(f => `
      <li>
        <button class="tap" data-action="edit-food" data-id="${f.id}">
          <div class="name">${h(f.name)}${f.grams ? ` <span class="muted">${fmt(f.grams)} g</span>` : ''}</div>
          <div class="muted small">${h(f.time || '')} · UH ${fmt(netOf(f), 1)} · M ${fmt(f.fat, 1)} · P ${fmt(f.protein, 1)} · ${fmt(kcalOf(f))} kcal</div>
        </button>
        <button class="star ${favNames.has(f.name.toLowerCase()) ? 'on' : ''}" data-action="fav-toggle" data-id="${f.id}" aria-label="Favorit">★</button>
      </li>`).join('')}</ul>` : '<p class="empty">Nema unosa za ovaj dan.</p>'}
  </section>`;
}
