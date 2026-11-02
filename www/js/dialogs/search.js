// Pretraga namirnica: moje namirnice, baza po sekcijama i Open Food Facts
import { fmt, h, norm, r1 } from '../core/format.js';
import { dietOf, kcalOf, netOf } from '../core/nutrition.js';
import { db, dietLevel } from '../store.js';
import { dlg, openDialog } from '../ui/dialog.js';
import { $, state, toast } from '../ui/dom.js';
import { quickItems } from '../views/food.js';
import { isFav, openFood } from './food.js';
import { getLang, t } from '../i18n/index.js';

const ketoTitles = () => ['keto', 'lchf'].includes(db.settings.diet || 'lchf');
const secTitle = s => ketoTitles() ? s.title : (s.ntitle || s.title);
const secIntro = s => ketoTitles() ? s.intro : (s.nintro || s.intro);
const grpTitle = g => ketoTitles() ? g.title : (g.ntitle || g.title);
const SEC_BY_TITLE = new Map(FOOD_SECTIONS.map(s => [s.title, s]));
export const dbItem = row => { const [name, carbs, fiber, fat, protein, grams, , section] = row; const sc = SEC_BY_TITLE.get(section); return { name, carbs, fiber, fat, protein, grams, per100: true, level: dietLevel(row), section: sc ? secTitle(sc) : section, tag: 'db' }; };
function searchItems(q) {
  // svaka riječ upita mora se pojaviti; zadnje slovo duljih riječi se zanemaruje (orah → orasi)
  const words = norm(q).split(/\s+/).filter(Boolean).map(w => w.length >= 4 ? w.slice(0, -1) : w);
  const out = [], seen = new Set();
  const push = (it, tag) => {
    const k = norm(it.name);
    if (seen.has(k) || !words.every(w => k.includes(w))) return;
    seen.add(k); out.push({ ...it, tag });
  };
  db.favorites.forEach(f => push(f, 'fav'));
  Object.entries(db.products).forEach(([code, p]) => push({ per100: true, ...p, code }, 'code'));
  quickItems().filter(x => !x.fav).forEach(r => push(r, 'recent'));
  if (!words.length) return out; // bez upita: moje namirnice po podnaslovima, ispod popis po sekcijama
  FOOD_DB.forEach(row => push(dbItem(row), 'db'));
  return out.slice(0, 40);
}
const TAGS = { fav: '★', code: '▥', recent: '↺', db: '', off: '' };
const levelPill = l => l === 'limit' || l === 'avoid' ? `<span class="pill ${l}">${t('level.' + l)}</span>` : '';
function itemRow(it, src, i, sub = true) {
  return `<li><button type="button" class="tap" data-action="pick" data-src="${src}" data-i="${i}">
    <div class="name">${TAGS[it.tag] && sub ? `<span class="tag">${TAGS[it.tag]}</span> ` : ''}${h(it.name)} ${levelPill(it.level)}</div>
    <div class="muted small">${it.per100 ? t('item.per100') : t('item.portion')} · ${t('abbr.carbs')} ${fmt(netOf(it), 1)} · ${t('abbr.fat')} ${fmt(it.fat, 1)} · ${t('abbr.protein')} ${fmt(it.protein, 1)} · ${fmt(kcalOf(it))} kcal${sub && it.section ? ` · ${h(it.section)}` : ''}</div>
  </button><button type="button" class="star ${isFav(it.name) ? 'on' : ''}" data-action="fav-item" data-src="${src}" data-i="${i}" aria-label="${t('fav.add')}">★</button></li>`;
}
const resultRows = (list, src) => list.map((it, i) => itemRow(it, src, i)).join('');
// Moje namirnice u podnaslovima koji se otvaraju dodirom
function myFoodGroups(list) {
  const groups = [['fav', '★ ' + t('fav.title')], ['code', t('search.saved')], ['recent', t('search.recent')]];
  return groups.map(([tag, title]) => {
    const rows = list.map((it, i) => [it, i]).filter(([it]) => it.tag === tag);
    if (!rows.length) return '';
    return `<details class="fsec mine"><summary><span>${title}</span><span class="muted small">${rows.length}</span></summary>
      <ul class="list">${rows.map(([it, i]) => itemRow(it, 's', i, false)).join('')}</ul></details>`;
  }).join('');
}
function foodSections() {
  const showAll = !!state.foodShowAll;
  let idx = 0;
  return FOOD_SECTIONS.map((s, si) => {
    let count = 0;
    const groups = s.groups.map(g => {
      const rows = g.items.map(row => { const i = idx++; const full = FOOD_DB[i]; return { it: dbItem(full), i }; })
        .filter(({ it }) => showAll || it.level !== 'avoid');
      if (!rows.length) return '';
      count += rows.length;
      const lv = new Set(rows.map(r => r.it.level));
      const groupLevel = lv.size === 1 ? [...lv][0] : '';
      return `<h4 class="fgrp">${h(grpTitle(g))} ${levelPill(groupLevel)}</h4>
        <ul class="list">${rows.map(({ it, i }) => itemRow(groupLevel ? { ...it, level: '' } : it, 'd', i, false)).join('')}</ul>`;
    }).join('');
    if (!count) return '';
    return `<details class="fsec">
      <summary><span>${si + 1}. ${h(secTitle(s))}</span><span class="muted small">${count}</span></summary>
      <p class="muted small fsec-intro">${h(secIntro(s))}</p>${groups}
    </details>`;
  }).join('');
}
export function openFoodSearch() {
  state.offres = [];
  const d = dietOf(db.settings.diet);
  openDialog(`<h2>${t('foodForm.add')}</h2>
    <div class="row">
      <input name="q" type="search" placeholder="${t('search.placeholder')}" autocomplete="off" enterkeyhint="search">
      <button type="button" class="btn" data-action="scan">${t('food.scan')}</button>
    </div>
    <div id="sbody" style="margin-top:6px"></div>
    <div id="offres"></div>
    <div class="btns" style="margin-top:10px">
      <button type="button" class="btn" data-action="off-search">${t('search.online')}</button>
      <button type="button" class="btn" data-action="food-manual">${t('search.manual')}</button>
      <button type="button" class="btn ghost" data-action="close" style="margin-left:auto">${t('btn.close')}</button>
    </div>
    <p class="muted small" style="margin:8px 0 0">${t('search.help', { diet: h(d.name) })}</p>`,
    () => { offSearch(); return false; },
    form => {
      const upd = () => {
        const q = form.q.value.trim();
        state.sres = searchItems(q);
        const showAll = !!state.foodShowAll;
        $('#sbody').innerHTML = q
          ? `<ul class="list">${state.sres.length ? resultRows(state.sres, 's') : `<li class="muted small">${t('search.noLocal')}</li>`}</ul>`
          : `${state.sres.length ? `<h3 class="fhead">${t('search.mine')}</h3>${myFoodGroups(state.sres)}` : ''}
             <div class="fhead-row"><h3 class="fhead">${t('search.foodsFor', { diet: h(d.name) })}</h3>
               <button type="button" class="btn ghost sm" data-action="food-showall">${showAll ? t('search.onlySuitable') : t('search.showAll')}</button></div>
             ${foodSections()}`;
      };
      state.foodSearchUpd = upd;
      form.q.addEventListener('input', upd);
      upd();
    });
}

/* Open Food Facts */
const OFF_FIELDS = 'code,product_name,product_name_hr,product_name_en,generic_name,brands,nutriments,serving_quantity';
async function offFetch(url) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ac.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}
function offToItem(p, code) {
  const n = p.nutriments || {};
  const v = k => { const x = n[k + '_100g']; return x == null || x === '' || isNaN(+x) ? null : +x; };
  if (v('carbohydrates') == null && v('fat') == null && v('proteins') == null) return null;
  const brand = p.brands ? String(p.brands).split(',')[0].trim() : '';
  const local = getLang() === 'en' ? p.product_name_en : p.product_name_hr;
  const name = [local || p.product_name || p.generic_name || t('search.product'), brand].filter(Boolean).join(' – ');
  return { name, carbs: r1(v('carbohydrates') || 0), fiber: r1(v('fiber') || 0), fat: r1(v('fat') || 0), protein: r1(v('proteins') || 0),
    grams: +p.serving_quantity > 0 ? Math.round(+p.serving_quantity) : 100, per100: true, code: code || p.code || null, tag: 'off' };
}
const offErr = e => e.name === 'AbortError' ? t('search.errTimeout') : navigator.onLine === false ? t('search.errOffline') : e.message;
export async function offSearch() {
  const q = (dlg.querySelector('[name=q]') || {}).value?.trim();
  const box = $('#offres');
  if (!box) return;
  if (!q || q.length < 2) { toast(t('search.min2')); return; }
  box.innerHTML = `<p class="muted small">${t('search.searching')}</p>`;
  try {
    const j = await offFetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`);
    state.offres = (j.products || []).map(p => offToItem(p)).filter(Boolean);
    if (!$('#offres')) return;
    $('#offres').innerHTML = state.offres.length
      ? `<h3 style="font-size:13px;color:var(--muted);margin:12px 0 0">Open Food Facts</h3><ul class="list">${resultRows(state.offres, 'o')}</ul>`
      : `<p class="muted small">${t('search.noOnline')}</p>`;
  } catch (e) {
    if ($('#offres')) $('#offres').innerHTML = `<p class="muted small">${t('search.onlineFailed', { err: h(offErr(e)) })}</p>`;
  }
}
export async function lookupBarcode(code) {
  const known = db.products[code];
  if (known) return openFood({ per100: true, ...known, code });
  const msg = $('#scanmsg');
  if (msg) msg.textContent = t('search.lookingUp', { code });
  try {
    const j = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
    const it = j.status === 1 && j.product ? offToItem(j.product, code) : null;
    if (it) return openFood(it);
    toast(t('search.notFound'));
  } catch (e) {
    toast(t('search.failed', { err: offErr(e) }));
  }
  openFood({ code, per100: true });
}
