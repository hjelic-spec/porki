// Podaci aplikacije (localStorage) i pomoćne funkcije vezane uz trenutne podatke
import * as analysis from './core/analysis.js';
import * as fast from './core/fast.js';
import { dietLevel as levelFor, isLowCarb, recipeMacros as macrosOf } from './core/nutrition.js';
import * as weight from './core/weight.js';
import { toast } from './ui/dom.js';
import { nativeSave, widgetSync } from './native/widget.js';

const KEY = 'lchf-dnevnik-v1';
const DEFAULT_SETTINGS = {
  heightCm: null,
  goalWeight: null,
  carbLimit: 25,          // neto ugljikohidrati (g/dan)
  proteinTarget: 100,     // g/dan
  fatTarget: 130,         // g/dan (orijentacijski)
  kcalTarget: 1800,
  carbsIncludeFiber: false, // EU deklaracije: UH NE uključuju vlakna
  healthWeight: true,       // uvozi težinu iz Health Connecta za dane bez unosa
  lastBackup: null,
  hideInstall: false,
  fastGoal: 16,             // cilj posta u satima
  diet: 'lchf', dietChosen: false, sex: '', age: null, activity: 1.375, pace: 0.5,
  reportEmail: '', reportFrom: '', reportDay: 0, reportTime: '08:00'
};
export const emptyDb = () => ({ settings: { ...DEFAULT_SETTINGS }, weights: {}, ketones: [], energy: {}, foods: [], favorites: [], products: {}, fasts: [], fast: null });
// Spaja spremljene podatke sa zadanima (novi ključevi iz novijih verzija)
export const withDefaults = d => { const e = emptyDb(); return { ...e, ...d, settings: { ...e.settings, ...(d.settings || {}) } }; };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? withDefaults(JSON.parse(raw)) : emptyDb();
  } catch (err) {
    console.error(err);
    return emptyDb();
  }
}
export let db = load();
// Zamjena svih podataka (uvoz kopije, brisanje, vraćanje iz datoteke na Androidu)
export function setDb(d, persist = true) {
  db = d;
  if (persist) try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
}
export function save() {
  db.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Spremanje nije uspjelo: ' + e.message); }
  try { widgetSync(); } catch { /* widget još nije inicijaliziran */ }
  try { nativeSave(); } catch { /* samo Android */ }
}

/* Izračuni nad trenutnim podacima */
export const dayFood = d => analysis.dayFood(db, d);
export const weekData = ws => analysis.weekData(db, ws);
export const weekEnergyVsScale = ws => analysis.weekEnergyVsScale(db, ws);
export const weightDates = () => weight.weightDates(db.weights);
export const latestWeight = upto => weight.latestWeight(db.weights, upto);
export const avg7 = date => weight.avg7(db.weights, date);
export const weeklyRate = (end, days) => weight.weeklyRate(db.weights, end, days);
export const lowCarb = () => isLowCarb(db.settings.diet);
export const dietLevel = row => levelFor(row, db.settings.diet || 'lchf');
export const recipeMacros = (r, portions = 1) => macrosOf(r, FOOD_DB, portions);
export const lastMealBetween = (a, b) => fast.lastMealBetween(db.foods, a, b);
