// Unos ketona, potrošnje energije (i za više dana unatrag) te brzi unos težine
import { addDays, cleanNum, dayLabel, dayShort, fmt, nowTime, num, r1, sgn, shortDate, today, uid } from '../core/format.js';
import { t } from '../i18n/index.js';
import { GLU, KET } from '../core/ketones.js';
import { burnedOf } from '../core/nutrition.js';
import { db, latestWeight, save } from '../store.js';
import { dlg, openDialog } from '../ui/dialog.js';
import { NATIVE, state, toast } from '../ui/dom.js';

/* Ketoni */
export function openKetone() {
  const sw = (arr, name, sel, sub) => arr.map((k, i) => `<label class="sw"><input type="radio" name="${name}" value="${i}" ${i === sel ? 'checked' : ''}><span style="background:${k.c}"></span><small>${k.l}${sub ? '<br>' + sub(k) : ''}</small></label>`).join('');
  openDialog(`<h2>${t('ketForm.title')}</h2>
    <div class="stack">
      <fieldset><legend>${t('ketForm.ket')}</legend><div class="swatches">${sw(KET, 'ket', 1, k => k.mmol + ' mmol')}</div></fieldset>
      <fieldset><legend>${t('ketForm.glu')}</legend><div class="swatches">${sw(GLU, 'glu', 0)}</div></fieldset>
      <p class="muted small" style="margin:0">${t('ketForm.colors')}</p>
      <div class="grid2">
        <label>${t('form.date')}<input type="date" name="date" value="${state.date}" max="${today()}"></label>
        <label>${t('foodForm.time')}<input type="time" name="time" value="${nowTime()}"></label>
      </div>
      <label>${t('ketForm.note')}<input name="note" placeholder="${t('ketForm.notePh')}" autocomplete="off"></label>
      <div class="btns end"><button type="button" class="btn" data-action="close">${t('btn.cancel')}</button><button class="btn primary">${t('btn.save')}</button></div>
    </div>`,
    fd => {
      const k = { id: uid(), date: fd.date || state.date, time: fd.time || nowTime(), ket: +fd.ket || 0, glu: +fd.glu || 0, note: (fd.note || '').trim() };
      db.ketones.push(k); save();
      if (k.glu > 0) toast(t('ketForm.gluToast'));
      else toast(t('toast.savedWhat', { what: KET[k.ket].l }));
    });
}

/* Energija */
export function openEnergy() {
  const e = db.energy[state.date] || {};
  openDialog(`<h2>${t('energyForm.title', { day: dayLabel(state.date) })}</h2>
    <div class="stack">
      <label>${t('energyForm.total')}<input name="total" inputmode="numeric" value="${e.total ?? ''}" placeholder="${t('energyForm.totalPh')}"></label>
      <div class="grid2">
        <label>${t('energyForm.active')}<input name="active" inputmode="numeric" value="${e.active ?? ''}"></label>
        <label>${t('energyForm.basal')}<input name="basal" inputmode="numeric" value="${e.basal ?? ''}"></label>
      </div>
      <label>${t('energyForm.steps')}<input name="steps" inputmode="numeric" value="${e.steps ?? ''}"></label>
      <p class="muted small" style="margin:0">${t('energyForm.help')}${NATIVE ? ' ' + t('energyForm.manualWins') : ''}</p>
      <div class="btns end">
        ${db.energy[state.date] ? `<button type="button" class="btn danger" data-action="del-energy" style="margin-right:auto">${t('btn.delete')}</button>` : ''}
        <button type="button" class="btn" data-action="close">${t('btn.cancel')}</button><button class="btn primary">${t('btn.save')}</button>
      </div>
    </div>`,
    fd => {
      const n = v => { const x = cleanNum(v, true); return x == null ? null : Math.round(x); };
      const en = { total: n(fd.total), active: n(fd.active), basal: n(fd.basal), steps: n(fd.steps), src: 'manual' };
      if (en.total == null && en.active == null && en.basal == null && en.steps == null) { toast(t('energyForm.enterOne')); return false; }
      db.energy[state.date] = en;
      save(); toast(t('toast.saved'));
    });
}

/* Potrošnja za više dana unatrag */
export function openEnergyBulk(days = 30) {
  const dates = [...Array(days)].map((_, i) => addDays(today(), -i));
  const val = v => v == null ? '' : Math.round(v);
  openDialog(`<h2>${t('bulk.title')}</h2>
    <div class="seg" style="margin-bottom:10px">${[30, 60, 90].map(n => `<button type="button" class="${n === days ? 'on' : ''}" data-action="energy-bulk" data-days="${n}">${t('n.days', { n })}</button>`).join('')}</div>
    <p class="muted small" style="margin:0 0 10px">${t('bulk.help')}${NATIVE ? ' ' + t('bulk.manualWins') : ''}</p>
    <div class="row" style="margin-bottom:12px">
      <input name="fill" inputmode="numeric" placeholder="${t('bulk.fillPh')}" autocomplete="off" aria-label="${t('bulk.fillAria')}">
      <button type="button" class="btn" data-action="energy-fill">${t('bulk.fill')}</button>
    </div>
    <div class="bulk-head muted small"><span>${t('th.day')}</span><span>${t('bulk.kcal')}</span><span>${t('energyForm.steps')}</span></div>
    <div class="bulk">${dates.map(d => {
      const e = db.energy[d];
      return `<div class="bulk-row">
        <label for="t_${d}"><b>${dayShort(d)}</b> ${shortDate(d)}${e ? `<small class="muted">${e.src === 'health' ? 'HC' : t('bulk.manual')}</small>` : ''}</label>
        <input id="t_${d}" name="t_${d}" inputmode="numeric" value="${val(burnedOf(e))}" autocomplete="off">
        <input name="s_${d}" inputmode="numeric" value="${val(e?.steps)}" autocomplete="off" aria-label="${t('energyForm.steps')} ${shortDate(d)}">
      </div>`;
    }).join('')}</div>
    <div class="btns end" style="margin-top:12px"><button type="button" class="btn" data-action="close">${t('btn.cancel')}</button><button class="btn primary">${t('btn.save')}</button></div>`,
    fd => {
      const n = v => { const x = cleanNum(v, true); return x == null ? null : Math.round(x); };
      let changed = 0;
      for (const d of dates) {
        const e = db.energy[d], tot = n(fd['t_' + d]), s = n(fd['s_' + d]);
        const oldT = burnedOf(e) == null ? null : Math.round(burnedOf(e)), oldS = e?.steps == null ? null : Math.round(e.steps);
        if (tot === oldT && s === oldS) continue;
        changed++;
        if (tot == null && s == null) { delete db.energy[d]; continue; }
        const keepParts = e && tot === oldT; // ukupno nepromijenjeno – zadrži aktivno/mirovanje
        db.energy[d] = { total: tot, active: keepParts ? e.active ?? null : null, basal: keepParts ? e.basal ?? null : null, steps: s, src: 'manual' };
      }
      save();
      toast(changed ? t('bulk.savedDays', { days: t('n.days', { n: changed }) }) : t('toast.noChanges'));
    });
}
export function fillEmptyEnergy() {
  const f = dlg.querySelector('[name=fill]'), v = cleanNum(f && f.value, true);
  if (v == null || v < 500 || v > 10000) { toast(t('bulk.range')); return; }
  let n = 0;
  dlg.querySelectorAll('.bulk input[name^="t_"]').forEach(inp => { if (!inp.value.trim()) { inp.value = Math.round(v); n++; } });
  toast(n ? t('bulk.filled', { days: t('n.days', { n }) }) : t('bulk.noEmpty'));
}

export function openWeightQuick() {
  const d = today(), w = db.weights[d], prev = latestWeight(addDays(d, -1));
  openDialog(`<h2>${t('weightQuick.title')}</h2>
    <div class="row">
      <input name="kg" inputmode="decimal" autocomplete="off" value="${w != null ? fmt(w, 1) : ''}" placeholder="${prev ? fmt(prev.kg, 1) : t('weight.placeholder')}" style="font-size:28px;font-weight:700" aria-label="${t('weight.aria')}">
      <span class="muted">kg</span>
    </div>
    <p class="muted small" style="margin:8px 0 0">${prev ? t('weightQuick.last', { kg: fmt(prev.kg, 1), date: shortDate(prev.date) }) : t('today.weighHint') + '.'}</p>
    <div class="btns end" style="margin-top:12px"><button type="button" class="btn" data-action="close">${t('btn.cancel')}</button><button class="btn primary">${t('btn.save')}</button></div>`,
    fd => {
      const kg = num(fd.kg);
      if (kg == null || kg < 20 || kg > 400) { toast(t('weight.invalid')); return false; }
      db.weights[d] = r1(kg);
      save();
      toast(t('weight.savedToast', { kg: fmt(kg, 1) }) + (prev ? ` (${sgn(kg - prev.kg)})` : ''));
    },
    form => setTimeout(() => form.kg.focus(), 150));
}
