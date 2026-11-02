// Post: kartica na Danas, tjedni pregled, obavijesti i radnje (logika je u core/fast.js)
import * as F from '../core/fast.js';
import { addDays, dayLabel, dayShort, durTxt, fmt, hmTxt, iso, mean, num, r1, toLocalInput, whenTxt } from '../core/format.js';
import { t } from '../i18n/index.js';
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
    info: t('fast.infoEat', { end: whenTxt(st.end), left: durTxt(st.end - now) }) + (st.last ? ' · ' + t('fast.lastMeal', { time: hmTxt(st.last) }) : ''),
    phase: t('fast.phaseEat', { cycle: f.cycle || 1, goal: f.goal }) };
  return { ...st,
    info: st.done
      ? t('fast.infoDone', { goal: f.goal, at: whenTxt(st.ps + goalMs), over: durTxt(st.el - goalMs) }) + (eatMs ? ' · ' + t('fast.windowStartsMeal') : '')
      : t('fast.infoFast', { start: whenTxt(st.ps), at: whenTxt(st.ps + goalMs), left: durTxt(st.ps + goalMs - now) }),
    phase: F.phaseText(st.el) + ((f.cycle || 1) > 1 ? ' · ' + t('fast.cycle', { n: f.cycle }) : '') };
}
export function fastCard() {
  if (db.fast) {
    if (F.advanceFast(db)) save();
    const st = fastState(), f = db.fast;
    lastFastKey = `${f.phase}-${f.phaseStart}-${st.done}`;
    const color = st.eating || st.done ? 'var(--good)' : 'var(--fast)';
    const fill = st.eating ? (1 - st.pct) * 100 : st.pct * 100;
    return `<section class="card" id="fastcard">
      <div class="card-h"><h2>${t('fast.title')} ${goalLabel(f.goal)}</h2><span class="fast-badge ${st.eating || st.done ? 'eat' : 'fast'}">${st.eating ? t('fast.badgeEat') : st.done ? t('fast.badgeDone') : t('fast.title')}</span></div>
      <div class="big" id="fastClock" style="color:${color}">${st.eating ? durTxt(st.end - Date.now()) : durTxt(st.el)}</div>
      <div class="muted small">${st.eating ? t('fast.leftToEat') : st.done ? t('fast.durationDone') : t('fast.duration')}</div>
      <div class="phasebar"><i id="fastFill" style="width:${fill}%;background:${color}"></i></div>
      <div class="small" id="fastInfo" style="margin-top:6px">${st.info}</div>
      <div class="small muted" id="fastPhase" style="margin-top:2px">${st.phase}</div>
      <div class="btns" style="margin-top:12px">
        ${st.eating
          ? `<button class="btn primary" style="flex:1" data-action="fast-now">${t('fast.startNow')}</button>`
          : `<button class="btn ${st.done ? 'primary' : ''}" style="flex:1" data-action="fast-eat">${t('fast.eatNow')}</button>`}
        <button class="btn" data-action="fast-end">${t('fast.end')}</button><button class="btn" data-action="fast-edit">${t('fast.edit')}</button>
      </div>
      <p class="muted small" style="margin:8px 0 0">${st.eating ? t('fast.hintEat') : t('fast.hintFast')}</p>
    </section>`;
  }
  const last = db.fasts.at(-1), meal = lastMealTime(), g = db.settings.fastGoal;
  return `<section class="card">
    <div class="card-h"><h2>${t('fast.title')}</h2><span class="muted">${last ? t('fast.lastDur', { d: durTxt(last.end - last.start) }) : ''}</span></div>
    <div class="seg" style="display:flex;overflow-x:auto">${F.FAST_GOALS.map(v => `<button class="${g === v ? 'on' : ''}" data-action="fast-goal" data-v="${v}">${goalLabel(v)}</button>`).join('')}</div>
    <p class="muted small" style="margin:8px 0 0">${eatHours(g) ? t('fast.explainCycle', { g, eat: eatHours(g) }) : t('fast.explainLong', { g })}</p>
    <div class="btns" style="margin-top:12px">
      <button class="btn primary" style="flex:1" data-action="fast-start" data-from="now">${t('fast.startNowBtn')}</button>
      ${meal ? `<button class="btn" data-action="fast-start" data-from="meal">${t('fast.fromMeal', { when: whenTxt(meal) })}</button>` : ''}
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
  if (F.advanceFast(db)) { fastChanged(t('fast.toastWindowEnded', { time: hmTxt(db.fast.phaseStart) })); return; }
  const st = fastState(), f = db.fast, key = `${f.phase}-${f.phaseStart}-${st.done}`;
  if (lastFastKey && key !== lastFastKey) {
    lastFastKey = key;
    if (st.done && !st.eating) toast(t('fast.toastGoal', { goal: f.goal }));
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
      goal: { title: t('notif.goalTitle'), body: eatMs ? t('notif.goalBody', { goal: f.goal, eat: eatHours(f.goal) }) : t('notif.goalBodyLong', { goal: f.goal }) },
      'eat-end': { title: t('notif.eatEndTitle'), body: t('notif.eatEndBody', { goal: f.goal }) }
    };
    const fut = F.fastNotifications(db);
    if (fut.length) await LN.schedule({ notifications: fut.map((n, i) => ({ id: FAST_NOTIF + i, ...text[n.kind], schedule: { at: new Date(n.at), allowWhileIdle: true }, isExactNotification: false })) });
  } catch (e) { console.error(e); }
}

/* Radnje */
export function startFast(from) {
  const start = from === 'meal' ? lastMealTime() || Date.now() : Date.now();
  F.startFast(db, db.settings.fastGoal, start);
  fastChanged(eatHours(db.fast.goal) ? t('fast.toastStarted', { label: goalLabel(db.fast.goal) }) : t('fast.toastStartedLong', { goal: db.fast.goal }));
}
// Kraj faze posta u trenutku at (prvi obrok): zapis u povijest i početak prozora za jelo
export function startEating(at = Date.now(), ask = true) {
  F.advanceFast(db);
  const f = db.fast;
  if (!f || f.phase !== 'fast') return false;
  const el = F.fastElapsedAt(f, at);
  if (ask && el < f.goal * H && !confirm(t('fast.confirmBreak', { d: durTxt(el), goal: f.goal }))) return false;
  const r = F.startEating(db, at);
  if (r.ended) { cancelFastNotif(); fastChanged(t('fast.toastEnded', { d: durTxt(r.el) })); return true; }
  fastChanged(t('fast.toastEating', { d: durTxt(r.el), end: hmTxt(r.t + eatHours(f.goal) * H) }));
  return true;
}
// Ručni početak posta tijekom prozora za jelo – od zadnjeg obroka ako postoji
export function startFastNow() {
  F.advanceFast(db);
  const r = F.startFastFromWindow(db);
  if (r) fastChanged(t('fast.toastFrom', { time: hmTxt(db.fast.phaseStart) }) + (r.last ? ' ' + t('fast.fromLastMeal') : ''));
}
// Poziva se nakon upisa hrane: prvi obrok nakon početka posta otvara prozor za jelo,
// a obrok u prozoru za jelo pomiče obavijest o cilju sljedećeg posta
export function onFoodAdded(item) {
  if (!db.fast || !F.isMeal(item)) return;
  if (F.advanceFast(db)) save();
  if (db.fast.phase === 'eat') { scheduleFastNotif(); return; }
  if (!F.mealEndsFast(db, item)) return;
  const at = F.foodTime(item);
  setTimeout(() => startEating(Math.min(at, Date.now()), true), 300);
}
export function endFast() {
  if (!db.fast) return;
  F.advanceFast(db);
  const f = db.fast, st = fastState();
  const msg = st.eating ? t('fast.confirmEndTracking', { label: goalLabel(f.goal) })
    : !st.done ? t('fast.confirmEnd', { d: durTxt(st.el), goal: f.goal }) : null;
  if (msg && !confirm(msg)) return;
  F.endFast(db);
  cancelFastNotif();
  fastChanged(st.eating ? t('fast.toastTrackingEnded') : t('fast.toastEnded', { d: durTxt(st.el) }));
}
export function cancelFast() {
  if (!confirm(t('fast.confirmCancel'))) return;
  db.fast = null; cancelFastNotif(); save(); closeDialog(); render();
}
export function openFastEdit() {
  if (!db.fast) return;
  F.advanceFast(db);
  const f = db.fast;
  openDialog(`<h2>${t('fast.editTitle')}</h2>
    <div class="stack">
      <label>${t('fast.phaseLabel')}<select name="phase"><option value="fast" ${f.phase === 'fast' ? 'selected' : ''}>${t('fast.title')}</option><option value="eat" ${f.phase === 'eat' ? 'selected' : ''}>${t('fast.window')}</option></select></label>
      <label>${t('fast.phaseStart')}<input type="datetime-local" name="start" value="${toLocalInput(f.phaseStart)}" max="${toLocalInput(Date.now())}"></label>
      <label>${t('fast.goalHours')}<input name="goal" inputmode="numeric" value="${f.goal}"></label>
      <div class="btns end">
        <button type="button" class="btn danger" data-action="fast-cancel" style="margin-right:auto">${t('fast.cancel')}</button>
        <button type="button" class="btn" data-action="close">${t('btn.cancel')}</button><button class="btn primary">${t('btn.save')}</button>
      </div>
    </div>`,
    fd => {
      const start = new Date(fd.start).getTime(), g = num(fd.goal);
      if (!start || start > Date.now()) { toast(t('fast.errFuture')); return false; }
      if (!g || g < 1 || g > 120) { toast(t('fast.errGoal')); return false; }
      db.fast = { goal: g, phase: fd.phase === 'eat' && eatHours(g) ? 'eat' : 'fast', phaseStart: start, cycle: f.cycle || 1 };
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
  return `<section class="card"><div class="card-h"><h2>${t('fast.title')}</h2><span class="muted">${wf.length ? t('fast.reached', { n: reached, of: wf.length }) : ''}</span></div>
    ${wf.length ? `<div class="tiles">
      <div class="tile"><b>${wf.length}</b><span>${t('fast.count')}</span></div>
      <div class="tile"><b>${fmt(mean(durs) / H, 1)} h</b><span>${t('fast.avgDur')}</span></div>
      <div class="tile"><b>${fmt(Math.max(...durs) / H, 1)} h</b><span>${t('fast.longest')}</span></div></div>
    ${chart({ labels: [...Array(7)].map((_, i) => dayShort(addDays(ws, i))), h: 140, zero: true, series: [{ type: 'bar', values: hours, color: 'var(--accent)', dec: 1, name: 'h' }], refs: [{ y: db.settings.fastGoal, color: 'var(--muted)', label: t('chart.goal', { v: db.settings.fastGoal + ' h' }) }] })}
    <ul class="list">${wf.slice().reverse().map(f => `<li><div class="grow"><b>${durTxt(f.end - f.start)}</b> <span class="muted small">${t('fast.goalH', { goal: f.goal })}</span><div class="muted small">${dayLabel(iso(new Date(f.start)))} ${hmTxt(f.start)} → ${hmTxt(f.end)}</div></div>
      <button class="x-btn" data-action="del-fast" data-id="${f.id}" aria-label="${t('btn.delete')}">✕</button></li>`).join('')}</ul>`
    : `<p class="muted" style="margin:0">${t('fast.noneWeek')}</p>`}
  </section>`;
}
