// Unos i uređivanje hrane te favoriti
import { fmt, h, nowTime, num, r1, uid } from '../core/format.js';
import { kcalOf, netOf, totals } from '../core/nutrition.js';
import { dayFood, db, save } from '../store.js';
import { openDialog } from '../ui/dialog.js';
import { $, state, toast } from '../ui/dom.js';
import { onFoodAdded } from '../views/fast.js';
import { locale, t } from '../i18n/index.js';

/* Hrana */
export function openFood(pre = {}, editId = null) {
  const per100 = !!pre.per100;
  const v = k => pre[k] != null && pre[k] !== '' ? fmt(pre[k], 1).replace(/\s/g, '') : '';
  const inc = editId ? pre.inc : db.settings.carbsIncludeFiber;
  openDialog(`
    <h2>${editId ? t('foodForm.edit') : t('foodForm.add')}</h2><input type="hidden" name="code" value="${h(pre.code || '')}">${pre.code ? `<p class="muted small" style="margin:-6px 0 10px">${t('foodForm.barcode', { code: h(pre.code) })}</p>` : ''}
    <div class="stack">
      <label>${t('foodForm.name')}<input name="name" required value="${h(pre.name || '')}" placeholder="${t('foodForm.namePh')}" autocomplete="off"></label>
      <div class="grid2">
        <label class="chk" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="per100" ${per100 ? 'checked' : ''}> ${t('foodForm.per100')}</label>
        <label>${t('foodForm.grams')}<input name="grams" inputmode="decimal" value="${pre.grams ? Math.round(pre.grams) : ''}" placeholder="${per100 ? '100' : t('foodForm.optional')}"></label>
      </div>
      <div class="grid4">
        <label>${t('foodForm.carbs')}<input name="carbs" inputmode="decimal" value="${v('carbs')}" placeholder="0"></label>
        <label>${t('foodForm.fiber')}<input name="fiber" inputmode="decimal" value="${v('fiber')}" placeholder="0"></label>
        <label>${t('foodForm.fat')}<input name="fat" inputmode="decimal" value="${v('fat')}" placeholder="0"></label>
        <label>${t('foodForm.protein')}<input name="protein" inputmode="decimal" value="${v('protein')}" placeholder="0"></label>
      </div>
      <p class="muted small" style="margin:0">${inc ? t('foodForm.incFiber') : t('foodForm.euLabel')}</p>
      <div class="preview" id="fprev"></div>
      <div class="grid2">
        <label>${t('foodForm.time')}<input type="time" name="time" value="${h(pre.time || nowTime())}"></label>
        <label class="chk" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="fav" ${!editId && pre.fav ? 'checked' : ''}> ${t('foodForm.saveFav')}</label>
      </div>
      <div class="btns end">
        ${editId ? `<button type="button" class="btn danger" data-action="del-food" data-id="${editId}" style="margin-right:auto">${t('btn.delete')}</button>` : ''}
        <button type="button" class="btn" data-action="close">${t('btn.cancel')}</button>
        ${editId ? '' : `<button type="button" class="btn" data-action="food-store">${t('foodForm.store')}</button><button type="button" class="btn" data-action="fav-only">${t('foodForm.favOnly')}</button>`}
        <button class="btn primary">${editId ? t('btn.save') : t('foodForm.addBtn')}</button>
      </div>
    </div>`,
    fd => {
      const name = fd.name.trim();
      if (!name) { toast(t('toast.enterName')); return false; }
      const vals = { carbs: num(fd.carbs) || 0, fiber: num(fd.fiber) || 0, fat: num(fd.fat) || 0, protein: num(fd.protein) || 0 };
      const isPer = !!fd.per100, g = num(fd.grams);
      const old = editId ? db.foods.find(f => f.id === editId) : null;
      const code = pre.code || old?.code || null;
      let item = { id: editId || uid(), date: old ? old.date : state.date, time: fd.time || nowTime(), name, inc: old ? !!old.inc : !!db.settings.carbsIncludeFiber, ...(code ? { code } : {}) };
      if (isPer) {
        const grams = g || 100, k = grams / 100;
        item = { ...item, carbs: r1(vals.carbs * k), fiber: r1(vals.fiber * k), fat: r1(vals.fat * k), protein: r1(vals.protein * k), grams, src: vals };
      } else item = { ...item, ...vals, grams: g || null };
      if (old) db.foods[db.foods.indexOf(old)] = item; else { db.foods.push(item); onFoodAdded(item); }
      if (fd.fav) saveFavorite(item);
      if (code && isPer) db.products[code] = { name, ...vals, grams: g || 100, inc: item.inc };
      save();
      toast(editId ? t('toast.saved') : t('toast.added', { name }));
    },
    form => {
      const upd = () => {
        const fd = Object.fromEntries(new FormData(form));
        const k = fd.per100 ? (num(fd.grams) || 100) / 100 : 1;
        const f = { carbs: (num(fd.carbs) || 0) * k, fiber: (num(fd.fiber) || 0) * k, fat: (num(fd.fat) || 0) * k, protein: (num(fd.protein) || 0) * k, inc };
        const left = db.settings.carbLimit - totals(dayFood(state.date).filter(x => x.id !== editId)).net - netOf(f);
        $('#fprev').innerHTML = `<b>${fmt(kcalOf(f))} kcal</b> · ${t('tile.netCarbs')} ${fmt(netOf(f), 1)} g · ${t('abbr.fat')} ${fmt(f.fat, 1)} g · ${t('abbr.protein')} ${fmt(f.protein, 1)} g<br><span class="${left < 0 ? 'bad' : 'muted'}">${t('foodForm.after')} ${left >= 0 ? t('foodForm.leftDay', { g: fmt(left, 1) }) : t('foodForm.overDay', { g: fmt(-left, 1) })}</span>`;
        form.grams.placeholder = fd.per100 ? '100' : t('foodForm.optional');
      };
      form.addEventListener('input', upd);
      upd();
      if (!pre.name) form.name.focus();
    });
}
export const isFav = name => db.favorites.some(f => f.name.toLowerCase() === String(name).toLowerCase());
// Favorit iz stavke pretrage / baze / ručnog unosa (bez dodavanja u obrok)
export function toggleFavorite(it) {
  if (isFav(it.name)) {
    db.favorites = db.favorites.filter(f => f.name.toLowerCase() !== it.name.toLowerCase());
    save();
    return false;
  }
  db.favorites.push({
    id: uid(), name: it.name, per100: !!it.per100, grams: it.grams || null,
    carbs: it.carbs || 0, fiber: it.fiber || 0, fat: it.fat || 0, protein: it.protein || 0,
    inc: it.inc ?? !!db.settings.carbsIncludeFiber
  });
  db.favorites.sort((a, b) => a.name.localeCompare(b.name, locale()));
  save();
  return true;
}
export function saveFavorite(item) {
  const fav = item.src
    ? { id: uid(), name: item.name, per100: true, grams: item.grams, ...item.src, inc: item.inc }
    : { id: uid(), name: item.name, per100: false, grams: item.grams, carbs: item.carbs, fiber: item.fiber, fat: item.fat, protein: item.protein, inc: item.inc };
  db.favorites = db.favorites.filter(f => f.name.toLowerCase() !== item.name.toLowerCase());
  db.favorites.push(fav);
  db.favorites.sort((a, b) => a.name.localeCompare(b.name, locale()));
}
export function openFavs() {
  openDialog(`<h2>${t('fav.title')}</h2>
    <ul class="list">${db.favorites.map(f => `<li><div class="grow"><div class="name">${h(f.name)}</div>
      <div class="muted small">${f.per100 ? t('item.per100') : t('item.portion')}${f.grams ? ` · ${fmt(f.grams)} g` : ''} · ${t('abbr.carbs')} ${fmt(netOf(f), 1)} · ${t('abbr.fat')} ${fmt(f.fat, 1)} · ${t('abbr.protein')} ${fmt(f.protein, 1)}</div></div>
      <button type="button" class="x-btn" data-action="del-fav" data-id="${f.id}" aria-label="${t('btn.delete')}">✕</button></li>`).join('') || `<p class="empty">${t('fav.none')}</p>`}</ul>
    <p class="muted small" style="margin:10px 0 0">${t('fav.hint')}</p>
    <div class="btns end" style="margin-top:12px"><button type="button" class="btn" data-action="fav-new" style="margin-right:auto">${t('fav.new')}</button><button type="button" class="btn" data-action="close">${t('btn.close')}</button></div>`);
}
