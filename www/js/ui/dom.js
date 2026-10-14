// Zajedničko stanje sučelja i sitni pomoćnici za DOM
import { today, weekStart } from '../core/format.js';

export const $ = (s, el = document) => el.querySelector(s);
export const state = { tab: 'today', date: today(), week: weekStart(today()), wRange: 90 };
export const APK_URL = 'https://github.com/hjelic-spec/porki/releases/latest';
export const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
// Capacitor plugin (samo u Android aplikaciji)
export const plugin = name => NATIVE ? (window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || window.Capacitor.registerPlugin(name) : null;
export const pwa = { installEvt: null }; // Chrome "Instaliraj aplikaciju" (samo web)

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
