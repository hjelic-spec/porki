// Post: kartica na Danas, tjedni pregled, obavijesti i radnje (logika je u core/fast.js)
import * as F from '../core/fast.js';
import { addDays, dayLabel, DAYS, durTxt, fmt, hmTxt, iso, mean, num, parseISO, r1, toLocalInput, whenTxt } from '../core/format.js';
import { widgetSync } from '../native/widget.js';
import { db, lastMealBetween, save } from '../store.js';
import { chart } from '../ui/charts.js';
import { closeDialog, dlg, openDialog } from '../ui/dialog.js';
import { $, plugin, toast } from '../ui/dom.js';
import { render } from '../ui/render.js';

const { eatHours, goalLabel, H } = F;
let lastFastKey = null;
const lastMealTime = () => lastMealBetween(Date.now() - 48 * H, Date.now());

// Stanje posta s tekstovima za prikaz
function fastState(now = Date.now()) {
  const f = db.fast, st = F.fastStatus(db, now), eatMs = eatHours(f.goal) * H, goalMs = f.goal * H;
  if (st.eating) return { ...st,
    info: `Prozor za jelo do ${whenTxt(st.end)} (još ${durTxt(st.end - now)})${st.last ? ` · zadnji obrok ${hmTxt(st.last)}` : ''}`,
    phase: `Prozor za jelo · ${f.cycle || 1}. ciklus · zatim post ${f.goal} h od zadnjeg obroka` };
  return { ...st,
    info: st.done
      ? `Cilj od ${f.goal} h ostvaren u ${whenTxt(st.ps + goalMs)} · +${durTxt(st.el - goalMs)}${eatMs ? ' · prozor za jelo počinje prvim obrokom' : ''}`
      : `Početak ${whenTxt(st.ps)} · cilj u ${whenTxt(st.ps + goalMs)} (još ${durTxt(st.ps + goalMs - now)})`,
    phase: F.phaseText(st.el) + ((f.cycle || 1) > 1 ? ` · ${f.cycle}. ciklus` : '') };
}
export function fastCard() {
  if (db.fast) {
    if (F.advanceFast(db)) save();
    const st = fastState(), f = db.fast;
    lastFastKey = `${f.phase}-${f.phaseStart}-${st.done}`;
    const color = st.eating || st.done ? 'var(--good)' : 'var(--fast)';
    const fill = st.eating ? (1 - st.pct) * 100 : st.pct * 100;
    return `<section class="card" id="fastcard">
      <div class="card-h"><h2>Post ${goalLabel(f.goal)}</h2><span class="fast-badge ${st.eating || st.done ? 'eat' : 'fast'}">${st.eating ? 'Jelo' : st.done ? 'Možeš jesti' : 'Post'}</span></div>
      <div class="big" id="fastClock" style="color:${color}">${st.eating ? durTxt(st.end - Date.now()) : durTxt(st.el)}</div>
      <div class="muted small">${st.eating ? 'preostalo za jelo' : st.done ? 'trajanje posta – brojač ide dalje do prvog obroka' : 'trajanje posta'}</div>
      <div class="phasebar"><i id="fastFill" style="width:${fill}%;background:${color}"></i></div>
      <div class="small" id="fastInfo" style="margin-top:6px">${st.info}</div>
      <div class="small muted" id="fastPhase" style="margin-top:2px">${st.phase}</div>
      <div class="btns" style="margin-top:12px">
        ${st.eating
          ? '<button class="btn primary" style="flex:1" data-action="fast-now">Počni post</button>'
          : `<button class="btn ${st.done ? 'primary' : ''}" style="flex:1" data-action="fast-eat">Jedem sada</button>`}
        <button class="btn" data-action="fast-end">Završi</button><button class="btn" data-action="fast-edit">Uredi</button>
      </div>
      <p class="muted small" style="margin:8px 0 0">${st.eating ? 'Novi post počinje sam kad prozor istekne – od zadnjeg upisanog obroka.' : 'Upis obroka u Hrani sam pokreće prozor za jelo.'}</p>
    </section>`;
  }
  const last = db.fasts.at(-1), meal = lastMealTime(), g = db.settings.fastGoal;
  return `<section class="card">
    <div class="card-h"><h2>Post</h2><span class="muted">${last ? `zadnji: ${durTxt(last.end - last.start)}` : ''}</span></div>
    <div class="seg" style="display:flex;overflow-x:auto">${F.FAST_GOALS.map(v => `<button class="${g === v ? 'on' : ''}" data-action="fast-goal" data-v="${v}">${goalLabel(v)}</button>`).join('')}</div>
    <p class="muted small" style="margin:8px 0 0">${eatHours(g) ? `Post traje dok ne upišeš prvi obrok (cilj ${g} h), zatim ${eatHours(g)} h za jelo, pa opet post – sve dok ne dodirneš Završi.` : `Produženi post od ${g} h – traje do prvog obroka ili dok ga ne završiš.`}</p>
    <div class="btns" style="margin-top:12px">
      <button class="btn primary" style="flex:1" data-action="fast-start" data-from="now">Započni sada</button>
      ${meal ? `<button class="btn" data-action="fast-start" data-from="meal">Od zadnjeg obroka (${whenTxt(meal)})</button>` : ''}
    </div>
  </section>`;
}
function fastChanged(msg) {
  save(); scheduleFastNotif(); widgetSync();
  if (msg) toast(msg);
  if (!dlg.open) render();
}
function tickFast() {
  if (!db.fast) { lastFastKey = null; return; }
  if (F.advanceFast(db)) { fastChanged(`Prozor za jelo je završio – post od ${hmTxt(db.fast.phaseStart)}`); return; }
  const st = fastState(), f = db.fast, key = `${f.phase}-${f.phaseStart}-${st.done}`;
  if (lastFastKey && key !== lastFastKey) {
    lastFastKey = key;
    if (st.done && !st.eating) toast(`Cilj od ${f.goal} h ostvaren – možeš jesti`);
    if (!dlg.open) render();
    widgetSync();
    return;
  }
  lastFastKey = key;
  const c = $('#fastClock');
  if (!c) return;
  c.textContent = st.eating ? durTxt(st.end - Date.now()) : durTxt(st.el);
  $('#fastInfo').textContent = st.info;
  $('#fastFill').style.width = (st.eating ? (1 - st.pct) * 100 : st.pct * 100) + '%';
}
setInterval(tickFast, 1000);

/* Obavijesti (Android) */
export const LN = plugin('LocalNotifications');
const FAST_NOTIF = 1601, FAST_NOTIF_N = 8;
async function cancelFastNotif() {
  if (LN) try { await LN.cancel({ notifications: [...Array(FAST_NOTIF_N)].map((_, i) => ({ id: FAST_NOTIF + i })) }); } catch { /* nema zakazanih */ }
}
// Cilj posta ostvaren, kraj prozora za jelo i cilj sljedećeg posta (od zadnjeg obroka u prozoru)
export async function scheduleFastNotif() {
  if (!LN) return;
  try {
    await cancelFastNotif();
    if (!db.fast) return;
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') return;
    const f = db.fast, eatMs = eatHours(f.goal) * H;
    const text = {
      goal: { title: 'Cilj posta je ostvaren', body: eatMs ? `${f.goal} h posta – možeš jesti. Prozor za jelo (${eatHours(f.goal)} h) počinje prvim upisanim obrokom.` : `Cilj od ${f.goal} h je ostvaren.` },
      'eat-end': { title: 'Prozor za jelo je završio', body: `Počinje post od ${f.goal} h (od zadnjeg obroka).` }
    };
    const fut = F.fastNotifications(db);
    if (fut.length) await LN.schedule({ notifications: fut.map((n, i) => ({ id: FAST_NOTIF + i, ...text[n.kind], schedule: { at: new Date(n.at), allowWhileIdle: true }, isExactNotification: false })) });
  } catch (e) { console.error(e); }
}

/* Radnje */
export function startFast(from) {
  const start = from === 'meal' ? lastMealTime() || Date.now() : Date.now();
  F.startFast(db, db.settings.fastGoal, start);
  fastChanged(eatHours(db.fast.goal) ? `Post ${goalLabel(db.fast.goal)} započet` : `Post započet · cilj ${db.fast.goal} h`);
}
// Kraj faze posta u trenutku t (prvi obrok): zapis u povijest i početak prozora za jelo
export function startEating(t = Date.now(), ask = true) {
  F.advanceFast(db);
  const f = db.fast;
  if (!f || f.phase !== 'fast') return false;
  const el = F.fastElapsedAt(f, t);
  if (ask && el < f.goal * H && !confirm(`Prekinuti post nakon ${durTxt(el)}? (cilj ${f.goal} h)`)) return false;
  const r = F.startEating(db, t);
  if (r.ended) { cancelFastNotif(); fastChanged(`Post završen: ${durTxt(r.el)}`); return true; }
  fastChanged(`Post: ${durTxt(r.el)} · prozor za jelo do ${hmTxt(r.t + eatHours(f.goal) * H)}`);
  return true;
}
// Ručni početak posta tijekom prozora za jelo – od zadnjeg obroka ako postoji
export function startFastNow() {
  F.advanceFast(db);
  const r = F.startFastFromWindow(db);
  if (r) fastChanged(`Post od ${hmTxt(db.fast.phaseStart)}${r.last ? ' (zadnji obrok)' : ''}`);
}
// Poziva se nakon upisa hrane: prvi obrok nakon početka posta otvara prozor za jelo,
// a obrok u prozoru za jelo pomiče obavijest o cilju sljedećeg posta
export function onFoodAdded(item) {
  if (!db.fast || !F.isMeal(item)) return;
  if (F.advanceFast(db)) save();
  if (db.fast.phase === 'eat') { scheduleFastNotif(); return; }
  if (!F.mealEndsFast(db, item)) return;
  const t = F.foodTime(item);
  setTimeout(() => startEating(Math.min(t, Date.now()), true), 300);
}
export function endFast() {
  if (!db.fast) return;
  F.advanceFast(db);
  const f = db.fast, st = fastState();
  const msg = st.eating ? `Završiti praćenje posta ${goalLabel(f.goal)}?`
    : !st.done ? `Post traje ${durTxt(st.el)} od ciljanih ${f.goal} h. Završiti post?` : null;
  if (msg && !confirm(msg)) return;
  F.endFast(db);
  cancelFastNotif();
  fastChanged(st.eating ? 'Praćenje posta završeno' : `Post završen: ${durTxt(st.el)}`);
}
export function cancelFast() {
  if (!confirm('Poništiti trenutni post bez spremanja?')) return;
  db.fast = null; cancelFastNotif(); save(); closeDialog(); render();
}
export function openFastEdit() {
  if (!db.fast) return;
  F.advanceFast(db);
  const f = db.fast;
  openDialog(`<h2>Uredi post</h2>
    <div class="stack">
      <label>Faza<select name="phase"><option value="fast" ${f.phase === 'fast' ? 'selected' : ''}>Post</option><option value="eat" ${f.phase === 'eat' ? 'selected' : ''}>Prozor za jelo</option></select></label>
      <label>Početak faze<input type="datetime-local" name="start" value="${toLocalInput(f.phaseStart)}" max="${toLocalInput(Date.now())}"></label>
      <label>Cilj posta (sati)<input name="goal" inputmode="numeric" value="${f.goal}"></label>
      <div class="btns end">
        <button type="button" class="btn danger" data-action="fast-cancel" style="margin-right:auto">Poništi post</button>
        <button type="button" class="btn" data-action="close">Odustani</button><button class="btn primary">Spremi</button>
      </div>
    </div>`,
    fd => {
      const t = new Date(fd.start).getTime(), g = num(fd.goal);
      if (!t || t > Date.now()) { toast('Početak ne može biti u budućnosti'); return false; }
      if (!g || g < 1 || g > 120) { toast('Cilj mora biti između 1 i 120 h'); return false; }
      db.fast = { goal: g, phase: fd.phase === 'eat' && eatHours(g) ? 'eat' : 'fast', phaseStart: t, cycle: f.cycle || 1 };
      F.advanceFast(db);
      save(); scheduleFastNotif(); widgetSync();
    });
}
export function fastWeekCard(ws, we) {
  const wf = db.fasts.filter(f => { const d = iso(new Date(f.end)); return d >= ws && d <= we; });
  if (!wf.length && !db.fast) return '';
  const hours = [...Array(7)].map((_, i) => {
    const d = addDays(ws, i), l = wf.filter(f => iso(new Date(f.end)) === d);
    return l.length ? r1(Math.max(...l.map(f => (f.end - f.start) / H))) : null;
  });
  const durs = wf.map(f => f.end - f.start), reached = wf.filter(f => f.end - f.start >= f.goal * H).length;
  return `<section class="card"><div class="card-h"><h2>Post</h2><span class="muted">${wf.length ? `cilj ostvaren ${reached}/${wf.length}` : ''}</span></div>
    ${wf.length ? `<div class="tiles">
      <div class="tile"><b>${wf.length}</b><span>postova</span></div>
      <div class="tile"><b>${fmt(mean(durs) / H, 1)} h</b><span>Ø trajanje</span></div>
      <div class="tile"><b>${fmt(Math.max(...durs) / H, 1)} h</b><span>najduži</span></div></div>
    ${chart({ labels: [...Array(7)].map((_, i) => DAYS[parseISO(addDays(ws, i)).getDay()]), h: 140, zero: true, series: [{ type: 'bar', values: hours, color: 'var(--accent)', dec: 1, name: 'h' }], refs: [{ y: db.settings.fastGoal, color: 'var(--muted)', label: 'cilj ' + db.settings.fastGoal + ' h' }] })}
    <ul class="list">${wf.slice().reverse().map(f => `<li><div class="grow"><b>${durTxt(f.end - f.start)}</b> <span class="muted small">cilj ${f.goal} h</span><div class="muted small">${dayLabel(iso(new Date(f.start)))} ${hmTxt(f.start)} → ${hmTxt(f.end)}</div></div>
      <button class="x-btn" data-action="del-fast" data-id="${f.id}" aria-label="Obriši">✕</button></li>`).join('')}</ul>`
    : '<p class="muted" style="margin:0">Ovaj tjedan još nema završenih postova.</p>'}
  </section>`;
}
