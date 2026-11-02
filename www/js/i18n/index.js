// Prijevodi: t('ključ', { parametri }) vraća tekst na odabranom jeziku (hrvatski je zadani i rezervni)
import en from './en.js';
import hr from './hr.js';

export const LANGS = { hr: 'Hrvatski', en: 'English' };
const DICTS = { hr, en };
const LOCALES = { hr: 'hr-HR', en: 'en-GB' };
let lang = 'hr', plurals = new Intl.PluralRules('hr');

export function setLang(l) {
  lang = DICTS[l] ? l : 'hr';
  plurals = new Intl.PluralRules(lang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
export const getLang = () => lang;
export const locale = () => LOCALES[lang];
// Jezik uređaja: hrvatski (i srodni jezici) → hr, sve ostalo → en
export const deviceLang = (langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []) =>
  langs.some(l => /^(hr|bs|sr|sh)\b/i.test(l || '')) ? 'hr' : 'en';

const fill = (s, p) => p ? s.replace(/\{(\w+)\}/g, (m, k) => p[k] ?? m) : s;
// Vrijednost može biti tekst, množina { one, few, other } (bira se prema p.n) ili funkcija (p) => tekst
export function t(key, p) {
  const v = DICTS[lang][key] ?? hr[key];
  if (v == null) return key;
  if (typeof v === 'function') return v(p || {});
  if (typeof v === 'object') return fill(v[plurals.select(p?.n ?? 0)] ?? v.other, p);
  return fill(v, p);
}
// Popis (npr. nazivi dana) iz rječnika
export const list = key => DICTS[lang][key] ?? hr[key];
