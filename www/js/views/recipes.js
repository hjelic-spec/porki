// Kartica Recepti i dijalog recepta
import { fmt, h, nowTime, num, uid } from '../core/format.js';
import { dietOf } from '../core/nutrition.js';
import { isFav } from '../dialogs/food.js';
import { db, lowCarb, recipeMacros, save } from '../store.js';
import { openDialog } from '../ui/dialog.js';
import { state, toast } from '../ui/dom.js';
import { onFoodAdded } from './fast.js';

const RECIPE_CATS = ['Sve', 'Doručak', 'Ručak i večera', 'Juhe', 'Prilozi i salate', 'Pekarski', 'Užine i slastice'];
export function viewRecipes() {
  const d = dietOf(db.settings.diet), mine = (state.rFilter || 'mine') === 'mine', cat = state.rCat || 'Sve';
  const list = RECIPES.filter(r => (!mine || r.diets.includes(d.id)) && (cat === 'Sve' || r.cat === cat));
  return `
  <section class="card">
    <div class="card-h"><h2>Recepti</h2><button class="btn ghost sm" data-action="goals">${h(d.name)} ›</button></div>
    <div class="seg" style="display:flex;margin-bottom:10px">
      <button class="${mine ? 'on' : ''}" data-action="r-filter" data-v="mine" style="flex:1">Za moju prehranu</button>
      <button class="${!mine ? 'on' : ''}" data-action="r-filter" data-v="all" style="flex:1">Svi recepti</button>
    </div>
    <div class="chips">${RECIPE_CATS.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-action="r-cat" data-v="${h(c)}">${h(c)}</button>`).join('')}</div>
  </section>
  ${list.length ? list.map(r => {
    const m = recipeMacros(r), fits = r.diets.includes(d.id);
    const over = lowCarb() && db.settings.carbLimit && m.net > db.settings.carbLimit * 0.5;
    return `<button class="card recipe" data-action="recipe" data-id="${r.id}">
      <div class="card-h" style="margin-bottom:4px"><h2>${h(r.name)}</h2></div>
      <div class="muted small">${h(r.cat)} · ${r.time} min · ${r.servings} ${r.servings === 1 ? 'porcija' : r.servings < 5 ? 'porcije' : 'porcija'}${!fits ? ` · <span class="warn">nije za ${h(d.name)}</span>` : ''}</div>
      <div class="rmac"><span><b class="${over ? 'bad' : ''}" style="color:var(--c-carb)">${fmt(m.net, 1)}</b> g UH</span><span><b style="color:var(--c-prot)">${fmt(m.protein)}</b> g P</span><span><b style="color:var(--c-fat)">${fmt(m.fat)}</b> g M</span><span><b>${fmt(m.kcal)}</b> kcal</span><span class="muted">po porciji</span></div>
    </button>`;
  }).join('') : '<section class="card"><p class="empty">Nema recepata za ovaj odabir.</p></section>'}`;
}
export function openRecipe(id) {
  const r = RECIPES.find(x => x.id === id);
  if (!r) return;
  const m = recipeMacros(r), s = db.settings;
  const share = (v, goal) => goal ? ` <span class="muted">(${fmt(v / goal * 100)}% dnevnog)</span>` : '';
  openDialog(`<h2>${h(r.name)}</h2>
    <p class="muted small" style="margin:0 0 10px">${h(r.cat)} · ${r.time} min · ${r.servings} ${r.servings === 1 ? 'porcija' : r.servings < 5 ? 'porcije' : 'porcija'} · ${r.diets.map(x => dietOf(x).name).join(', ')}</p>
    <div class="tiles tiles4">
      <div class="tile"><b style="color:var(--c-carb)">${fmt(m.net, 1)} g</b><span>neto UH</span></div>
      <div class="tile"><b style="color:var(--c-prot)">${fmt(m.protein)} g</b><span>proteini</span></div>
      <div class="tile"><b style="color:var(--c-fat)">${fmt(m.fat)} g</b><span>masti</span></div>
      <div class="tile"><b>${fmt(m.kcal)}</b><span>kcal</span></div>
    </div>
    <p class="muted small" style="margin:6px 0 0">Po porciji (≈ ${fmt(m.grams)} g). UH${share(m.net, s.carbLimit)}, proteini${share(m.protein, s.proteinTarget)}.</p>
    <h3>Sastojci (za ${r.servings} ${r.servings === 1 ? 'porciju' : r.servings < 5 ? 'porcije' : 'porcija'})</h3>
    <ul class="list">${r.ingredients.map(([n, g]) => `<li><span class="grow">${h(n)}</span><b>${fmt(g)} g</b></li>`).join('')}</ul>
    <p class="muted small" style="margin:4px 0 0">Sol, papar i začini po želji.</p>
    <h3>Priprema</h3>
    <ol class="steps">${r.steps.map(t => `<li>${h(t)}</li>`).join('')}</ol>
    <div class="row" style="margin-top:12px"><label style="flex:1">Broj porcija za unos<input name="portions" inputmode="decimal" value="1"></label></div>
    <div class="btns end" style="margin-top:10px">
      <button type="button" class="btn" data-action="recipe-fav" data-id="${r.id}">${isFav(r.name) ? '★ U favoritima' : '☆ U favorite'}</button>
      <button class="btn primary">Dodaj u obrok</button>
    </div>`,
    fd => {
      const p = num(fd.portions) || 1, mm = recipeMacros(r, p);
      const it = { id: uid(), date: state.date, time: nowTime(), name: r.name, carbs: mm.carbs, fiber: mm.fiber, fat: mm.fat, protein: mm.protein, grams: mm.grams, inc: false };
      db.foods.push(it); onFoodAdded(it);
      save();
      toast(`Dodano: ${r.name}${p !== 1 ? ` × ${fmt(p, 1)}` : ''}`);
    });
}
