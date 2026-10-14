// Health Connect (Android) i uvoz potrošnje/težine preko URL-a
import { addDays, cleanNum, pad, r1, shortDate, today } from '../core/format.js';
import { db, save } from '../store.js';
import { dlg } from '../ui/dialog.js';
import { plugin, state, toast } from '../ui/dom.js';
import { render } from '../ui/render.js';

function parseHealth(text) {
  const out = {};
  text = String(text || '').trim();
  try {
    const j = JSON.parse(text);
    if (j && typeof j === 'object') { for (const [k, v] of Object.entries(j)) out[k.toLowerCase()] = v; return out; }
  } catch { /* nije JSON */ }
  const q = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text;
  for (const part of q.split(/[&;\n]/)) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    let v = part.slice(i + 1).trim();
    try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch { /* ostavi */ }
    out[part.slice(0, i).trim().toLowerCase()] = v;
  }
  return out;
}
// Uvoz preko URL-a (npr. iz automatizacije): ?date=2026-10-04&total=2300&active=520&steps=8000&weight=84.2
export function applyHealth(text) {
  const p = parseHealth(text);
  let date = today();
  if (p.date) {
    const m = String(p.date).match(/(\d{4})-(\d{1,2})-(\d{1,2})/) || String(p.date).match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    if (m) date = m[1].length === 4 ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  }
  const int = v => { const x = cleanNum(v, true); return x == null ? null : Math.round(x); };
  const total = int(p.total), active = int(p.active), basal = int(p.basal ?? p.resting), steps = int(p.steps);
  const weight = cleanNum(p.weight);
  if (total == null && active == null && basal == null && steps == null && weight == null) return false;
  if (total != null || active != null || basal != null || steps != null) {
    const e = db.energy[date] || {};
    db.energy[date] = { total: total ?? e.total ?? null, active: active ?? e.active ?? null, basal: basal ?? e.basal ?? null, steps: steps ?? e.steps ?? null, src: 'health' };
  }
  if (weight != null && weight > 20 && weight < 400) db.weights[date] = r1(weight);
  save();
  state.date = date;
  toast(`Uvezeno za ${shortDate(date)}`);
  return true;
}

/* ================= Health Connect (Android aplikacija) ================= */
export const HB = plugin('HealthBridge');
export const hc = { status: null, granted: [], syncing: false, lastSync: 0 };
async function hcRefresh() {
  try { const r = await HB.status(); hc.status = r.status; hc.granted = r.granted || []; }
  catch (e) { hc.status = 'error'; console.error(e); }
}
export async function hcRequest() {
  try {
    const r = await HB.requestAccess();
    hc.granted = r.granted || [];
    if (!hc.granted.length) toast('Pristup nije odobren');
  } catch (e) { toast('Dozvole: ' + e.message); }
}
export async function hcSync(manual = false, days = 7) {
  if (!HB || hc.syncing) return;
  hc.syncing = true;
  if (manual) render();
  try {
    await hcRefresh();
    if (hc.status !== 'available') { if (manual) toast('Health Connect nije dostupan'); return; }
    if (!hc.granted.length) {
      if (!manual) return;
      await hcRequest();
      if (!hc.granted.length) return;
    }
    const r = await HB.readDays({ from: addDays(today(), -(days - 1)), to: today() });
    const rnd = v => v == null ? null : Math.round(v);
    for (const x of r.days || []) {
      const e = db.energy[x.date];
      if (!(e && e.src === 'manual') && (x.total != null || x.active != null || x.steps != null)) {
        db.energy[x.date] = {
          total: rnd(x.total), active: rnd(x.active),
          basal: x.total != null && x.active != null ? Math.max(0, Math.round(x.total - x.active)) : null,
          steps: rnd(x.steps), src: 'health'
        };
      } else if (e && e.src === 'health' && x.total == null && x.active == null && x.steps == null) {
        delete db.energy[x.date]; // ranije spremljena procjena bez stvarnih podataka
      }
      if (db.settings.healthWeight && x.weight != null && db.weights[x.date] == null) db.weights[x.date] = r1(x.weight);
    }
    hc.lastSync = Date.now();
    save();
    if (manual) toast('Sinkronizirano s Health Connectom');
  } catch (e) {
    console.error(e);
    if (manual) toast('Sinkronizacija nije uspjela: ' + e.message);
  } finally {
    hc.syncing = false;
    if (!dlg.open) render();
  }
}
