// Datumi, brojevi i oblikovanje teksta – bez pristupa podacima ili DOM-u
import { list, locale, t } from '../i18n/index.js';

export const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
export const today = () => iso(new Date());
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
export const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
export const r1 = n => Math.round(n * 10) / 10;
export const fmt = (n, dec = 0) => (n == null || isNaN(n)) ? '–' : Number(n).toLocaleString(locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const sgn = (n, dec = 1) => n == null ? '–' : (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n), dec);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
export const sum = a => a.reduce((x, y) => x + (y || 0), 0);
// Kratki naziv dana u tjednu za datum 'YYYY-MM-DD'
export const dayShort = s => list('days')[parseISO(s).getDay()];
export const dayLabel = s => { const d = parseISO(s); return t('date.label', { wd: dayShort(s), d: d.getDate(), mon: list('months')[d.getMonth()] }); };
export const shortDate = s => { const d = parseISO(s); return t('date.short', { d: d.getDate(), m: d.getMonth() + 1 }); };
// Datum s godinom
export const fullDate = s => { const d = parseISO(s); return t('date.full', { d: d.getDate(), m: d.getMonth() + 1, y: d.getFullYear() }); };
export const weekStart = s => { const d = parseISO(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); };
export const toMin = hm => { const [H, M] = String(hm || '0:0').split(':').map(Number); return H * 60 + (M || 0); };
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
// Broj iz slobodnog teksta (1.234 / 1,234 / 2.300,5 …); integer = tisućice bez decimala
export function cleanNum(v, integer = false) {
  if (v == null) return null;
  let s = String(v).replace(/[^\d.,-]/g, '');
  if (!s || s === '-') return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = integer && /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (integer && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
export const durTxt = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(m / 60)} h ${pad(m % 60)} min`; };
export const hmTxt = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const whenTxt = ms => { const d = iso(new Date(ms)); return (d === today() ? '' : d === addDays(today(), -1) ? t('date.yesterday') + ' ' : d === addDays(today(), 1) ? t('date.tomorrow') + ' ' : shortDate(d) + ' ') + hmTxt(ms); };
export const toLocalInput = ms => { const d = new Date(ms); return `${iso(d)}T${hmTxt(ms)}`; };
