// Kartica Recepti i dijalog recepta
import { fmt, h, nowTime, num, uid } from '../core/format.js';
import { dietOf } from '../core/nutrition.js';
import { isFav } from '../dialogs/food.js';
import { db, lowCarb, recipeMacros, save } from '../store.js';
import { openDialog } from '../ui/dialog.js';
import { state, toast } from '../ui/dom.js';
import { onFoodAdded } from './fast.js';
import { foodName, recipeName, recipeSteps, t } from '../i18n/index.js';

// Kategorije su u podacima recepata na hrvatskom; prikazuju se preko prijevoda (rcat.<i>)
const RECIPE_CATS = ['Sve', 'Doručak', 'Ručak i večera', 'Juhe', 'Prilozi i salate', 'Pekarski', 'Užine i slastice'];
const catLabel = c => RECIPE_CATS.includes(c) ? t('rcat.' + RECIPE_CATS.indexOf(c)) : c;
export function viewRecipes() {
  const d = dietOf(db.settings.diet), mine = (state.rFilter || 'mine') === 'mine', cat = state.rCat || 'Sve';
  const list = RECIPES.filter(r => (!mine || r.diets.includes(d.id)) && (cat === 'Sve' || r.cat === cat));
  return `
  <section class="card">
    <div class="card-h"><h2>${t('recipe.title')}</h2><button class="btn ghost sm" data-action="goals">${h(d.name)} ›</button></div>
    <div class="seg" style="display:flex;margin-bottom:10px">
      <button class="${mine ? 'on' : ''}" data-action="r-filter" data-v="mine" style="flex:1">${t('recipe.mine')}</button>
      <button class="${!mine ? 'on' : ''}" data-action="r-filter" data-v="all" style="flex:1">${t('recipe.all')}</button>
    </div>
    <div class="chips">${RECIPE_CATS.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-action="r-cat" data-v="${h(c)}">${h(catLabel(c))}</button>`).join('')}</div>
  </section>
  ${list.length ? list.map(r => {
    const m = recipeMacros(r), fits = r.diets.includes(d.id);
    const over = lowCarb() && db.settings.carbLimit && m.net > db.settings.carbLimit * 0.5;
    return `<button class="card recipe" data-action="recipe" data-id="${r.id}">
      <div class="card-h" style="margin-bottom:4px"><h2>${h(recipeName(r))}</h2></div>
      <div class="muted small">${h(catLabel(r.cat))} · ${r.time} min · ${t('n.servings', { n: r.servings })}${!fits ? ` · <span class="warn">${t('recipe.notFor', { diet: h(d.name) })}</span>` : ''}</div>
      <div class="rmac"><span><b class="${over ? 'bad' : ''}" style="color:var(--c-carb)">${fmt(m.net, 1)}</b> g ${t('abbr.carbs')}</span><span><b style="color:var(--c-prot)">${fmt(m.protein)}</b> g ${t('abbr.protein')}</span><span><b style="color:var(--c-fat)">${fmt(m.fat)}</b> g ${t('abbr.fat')}</span><span><b>${fmt(m.kcal)}</b> kcal</span><span class="muted">${t('recipe.perServing')}</span></div>
    </button>`;
  }).join('') : `<section class="card"><p class="empty">${t('recipe.none')}</p></section>`}`;
}
export function openRecipe(id) {
  const r = RECIPES.find(x => x.id === id);
  if (!r) return;
  const m = recipeMacros(r), s = db.settings;
  const share = (v, goal) => goal ? ` <span class="muted">(${t('recipe.ofDaily', { pct: fmt(v / goal * 100) })})</span>` : '';
  const name = recipeName(r);
  openDialog(`<h2>${h(name)}</h2>
    <p class="muted small" style="margin:0 0 10px">${h(catLabel(r.cat))} · ${r.time} min · ${t('n.servings', { n: r.servings })} · ${r.diets.map(x => dietOf(x).name).join(', ')}</p>
    <div class="tiles tiles4">
      <div class="tile"><b style="color:var(--c-carb)">${fmt(m.net, 1)} g</b><span>${t('tile.netCarbs')}</span></div>
      <div class="tile"><b style="color:var(--c-prot)">${fmt(m.protein)} g</b><span>${t('tile.protein')}</span></div>
      <div class="tile"><b style="color:var(--c-fat)">${fmt(m.fat)} g</b><span>${t('tile.fat')}</span></div>
      <div class="tile"><b>${fmt(m.kcal)}</b><span>kcal</span></div>
    </div>
    <p class="muted small" style="margin:6px 0 0">${t('recipe.perServingG', { g: fmt(m.grams) })} ${t('recipe.carbsShare')}${share(m.net, s.carbLimit)}, ${t('tile.protein')}${share(m.protein, s.proteinTarget)}.</p>
    <h3>${t('recipe.ingredients', { s: t('n.servingsFor', { n: r.servings }) })}</h3>
    <ul class="list">${r.ingredients.map(([n, g]) => `<li><span class="grow">${h(foodName(n))}</span><b>${fmt(g)} g</b></li>`).join('')}</ul>
    <p class="muted small" style="margin:4px 0 0">${t('recipe.seasoning')}</p>
    <h3>${t('recipe.method')}</h3>
    <ol class="steps">${recipeSteps(r).map(step => `<li>${h(step)}</li>`).join('')}</ol>
    <div class="row" style="margin-top:12px"><label style="flex:1">${t('recipe.portions')}<input name="portions" inputmode="decimal" value="1"></label></div>
    <div class="btns end" style="margin-top:10px">
      <button type="button" class="btn" data-action="recipe-fav" data-id="${r.id}">${isFav(name) ? t('recipe.inFavs') : t('recipe.toFavs')}</button>
      <button class="btn primary">${t('recipe.addToMeal')}</button>
    </div>`,
    fd => {
      const p = num(fd.portions) || 1, mm = recipeMacros(r, p);
      const it = { id: uid(), date: state.date, time: nowTime(), name, carbs: mm.carbs, fiber: mm.fiber, fat: mm.fat, protein: mm.protein, grams: mm.grams, inc: false };
      db.foods.push(it); onFoodAdded(it);
      save();
      toast(t('toast.added', { name: name + (p !== 1 ? ` × ${fmt(p, 1)}` : '') }));
    });
}
