// Iscrtavanje aktivne kartice
import { dayLabel, today } from '../core/format.js';
import { getLang, t } from '../i18n/index.js';
import { $, state } from './dom.js';
import { viewAnalysis } from '../views/analysis.js';
import { viewFood } from '../views/food.js';
import { viewKetones } from '../views/ketones.js';
import { viewRecipes } from '../views/recipes.js';
import { viewToday } from '../views/today.js';
import { viewWeight } from '../views/weight.js';

const VIEWS = { today: viewToday, food: viewFood, weight: viewWeight, ketones: viewKetones, analysis: viewAnalysis, recipes: viewRecipes };
// Statični tekst iz index.html (navigacija, oznake gumba)
function translateStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  // opis aplikacije i manifest (ime i opis pri instalaciji web-verzije) na odabranom jeziku
  $('meta[name=description]').content = t('app.description');
  const manifest = getLang() === 'en' ? 'manifest-en.webmanifest' : 'manifest.webmanifest';
  if ($('link[rel=manifest]').getAttribute('href') !== manifest) $('link[rel=manifest]').setAttribute('href', manifest);
}
export function render() {
  translateStatic();
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  const showDate = state.tab === 'today' || state.tab === 'food';
  $('#datebar').hidden = !showDate;
  if (showDate) {
    $('#dateLabel').textContent = (state.date === today() ? t('nav.todayPrefix') : '') + dayLabel(state.date);
    $('#nextDay').disabled = state.date >= today();
  }
  $('#view').innerHTML = VIEWS[state.tab]();
}
