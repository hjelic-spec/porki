// Postavke te način prehrane i dnevni ciljevi
import { fmt, fullDate, h, num, r1, today } from '../core/format.js';
import { ACTIVITY, calcTargets, dietOf, DIETS, PACE } from '../core/nutrition.js';
import { getLang, LANGS, locale, setLang, t } from '../i18n/index.js';
import { hc } from '../native/health.js';
import { scheduleReportNotif } from '../reports.js';
import { scheduleFastNotif } from '../views/fast.js';
import { db, latestWeight, save } from '../store.js';
import { openDialog } from '../ui/dialog.js';
import { $, APK_URL, NATIVE, toast } from '../ui/dom.js';

/* Postavke */
export function openSettings() {
  const s = db.settings;
  openDialog(`<h2>${t('settings.title')}</h2>
    <div class="stack">
      <label>${t('settings.language')}<select name="lang">${Object.entries(LANGS).map(([id, name]) => `<option value="${id}" ${getLang() === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
      <div class="grid2">
        <label>${t('settings.height')}<input name="heightCm" inputmode="decimal" value="${s.heightCm ?? ''}"></label>
        <label>${t('settings.goalWeight')}<input name="goalWeight" inputmode="decimal" value="${s.goalWeight ?? ''}"></label>
      </div>
      <h3 style="margin:6px 0 0;font-size:13px;color:var(--muted)">${t('settings.diet')}</h3>
      <button type="button" class="btn block" data-action="goals">${h(dietOf(s.diet).name)} · ${t('settings.calcTargets')} ›</button>
      <h3 style="margin:6px 0 0;font-size:13px;color:var(--muted)">${t('settings.targets')}</h3>
      <div class="grid2">
        <label>${t('settings.carbLimit')}<input name="carbLimit" inputmode="numeric" value="${s.carbLimit}"></label>
        <label>${t('foodForm.protein')}<input name="proteinTarget" inputmode="numeric" value="${s.proteinTarget}"></label>
        <label>${t('foodForm.fat')}<input name="fatTarget" inputmode="numeric" value="${s.fatTarget}"></label>
        <label>${t('settings.kcal')}<input name="kcalTarget" inputmode="numeric" value="${s.kcalTarget}"></label>
      </div>
      <p class="muted small" style="margin:0">${t('settings.targetsHelp')}</p>
      <label class="chk"><input type="checkbox" name="carbsIncludeFiber" ${s.carbsIncludeFiber ? 'checked' : ''}> ${t('settings.incFiber')}</label>
      <h3 style="margin:6px 0 0;font-size:13px;color:var(--muted)">Health Connect</h3>
      ${NATIVE ? `
        <p class="muted small" style="margin:0">${t('hc.status')} ${hc.status === 'available' ? (hc.granted.length ? t('hc.connected', { n: hc.granted.length }) : t('hc.noPerms')) : hc.status ? t('hc.st.' + hc.status) : t('hc.checking')}${hc.lastSync ? ' · ' + t('hc.lastSync', { time: new Date(hc.lastSync).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) }) : ''}</p>
        <label class="chk"><input type="checkbox" name="healthWeight" ${s.healthWeight ? 'checked' : ''}> ${t('settings.hcWeight')}</label>
        <div class="btns"><button type="button" class="btn" data-action="hc-perm">${t('settings.hcPerms')}</button><button type="button" class="btn" data-action="hc-open">${t('settings.hcOpen')}</button></div>`
      : `<p class="muted small" style="margin:0">${t('settings.webHc', { url: APK_URL })}</p>
        <input type="hidden" name="healthWeight" value="${s.healthWeight ? 'on' : ''}">`}
      <h3 style="margin:6px 0 0;font-size:13px;color:var(--muted)">${t('settings.data')}</h3>
      <p class="muted small" style="margin:0">${t('settings.dataInfo', { date: s.lastBackup ? fullDate(s.lastBackup) : t('settings.never') })}</p>
      <div class="btns">
        <button type="button" class="btn" data-action="reports">${t('settings.reports')}</button>
        <button type="button" class="btn" data-action="export">${t('settings.export')}</button>
        <button type="button" class="btn" data-action="import">${t('settings.import')}</button>
        <button type="button" class="btn danger" data-action="wipe">${t('settings.wipe')}</button>
      </div>
      <div class="btns end"><button type="button" class="btn" data-action="close">${t('btn.cancel')}</button><button class="btn primary">${t('btn.save')}</button></div>
    </div>`,
    fd => {
      const n = (v, d) => { const x = num(v); return x == null ? d : x; };
      Object.assign(db.settings, {
        heightCm: n(fd.heightCm, null), goalWeight: n(fd.goalWeight, null),
        carbLimit: n(fd.carbLimit, 25), proteinTarget: n(fd.proteinTarget, 100), fatTarget: n(fd.fatTarget, 130), kcalTarget: n(fd.kcalTarget, 0),
        carbsIncludeFiber: !!fd.carbsIncludeFiber, healthWeight: !!fd.healthWeight, lang: fd.lang || getLang()
      });
      const langChanged = db.settings.lang !== getLang();
      setLang(db.settings.lang);
      save(); toast(t('settings.saved'));
      if (langChanged) { scheduleFastNotif(); if (db.settings.reportDay) scheduleReportNotif(); } // obavijesti na novom jeziku
    });
}

export function openGoals() {
  const s = db.settings, lw = latestWeight(today());
  const opt = (arr, v) => arr.map(([val, key]) => `<option value="${val}" ${+v === val ? 'selected' : ''}>${t(key)}</option>`).join('');
  openDialog(`<h2>${t('goals.title')}</h2>
    <div class="stack">
      <label>${t('goals.diet')}<select name="diet">${DIETS.map(d => `<option value="${d.id}" ${(s.diet || 'lchf') === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label>
      <p class="muted small" id="dietDesc" style="margin:0"></p>
      <fieldset><legend>${t('goals.sex')}</legend><div class="seg" style="display:flex">
        <label class="segopt"><input type="radio" name="sex" value="z" ${s.sex === 'z' ? 'checked' : ''}><span>${t('goals.female')}</span></label>
        <label class="segopt"><input type="radio" name="sex" value="m" ${s.sex === 'm' ? 'checked' : ''}><span>${t('goals.male')}</span></label></div></fieldset>
      <div class="grid2">
        <label>${t('goals.age')}<input name="age" inputmode="numeric" value="${s.age ?? ''}"></label>
        <label>${t('settings.height')}<input name="height" inputmode="numeric" value="${s.heightCm ?? ''}"></label>
        <label>${t('goals.weight')}<input name="weight" inputmode="decimal" value="${lw ? fmt(lw.kg, 1) : ''}"></label>
        <label>${t('settings.goalWeight')}<input name="goal" inputmode="decimal" value="${s.goalWeight ?? ''}"></label>
      </div>
      <label>${t('goals.activity')}<select name="activity">${opt(ACTIVITY, s.activity || 1.375)}</select></label>
      <label>${t('goals.pace')}<select name="pace">${opt(PACE, s.pace ?? 0.5)}</select></label>
      <div class="preview" id="goalPrev"></div>
      <p class="muted small" style="margin:0">${t('goals.help')}</p>
      <div class="btns end"><button type="button" class="btn" data-action="close">${t('btn.cancel')}</button><button class="btn primary">${t('goals.apply')}</button></div>
    </div>`,
    fd => {
      const p = goalInput(fd), tg = calcTargets(p);
      if (!tg) { toast(t('goals.missing')); return false; }
      Object.assign(db.settings, {
        diet: p.diet, dietChosen: true, sex: p.sex, age: p.age, heightCm: p.height, goalWeight: p.goal || db.settings.goalWeight,
        activity: p.activity, pace: p.pace, kcalTarget: tg.kcal, carbLimit: tg.carbs, proteinTarget: tg.protein, fatTarget: tg.fat
      });
      if (p.weight && db.weights[today()] == null && !latestWeight(today())) db.weights[today()] = r1(p.weight);
      save();
      toast(`${dietOf(p.diet).name}: ${fmt(tg.kcal)} kcal · ${t('abbr.carbs')} ${tg.carbs} g · ${t('abbr.protein')} ${tg.protein} g · ${t('abbr.fat')} ${tg.fat} g`);
    },
    form => {
      const upd = () => {
        const fd = Object.fromEntries(new FormData(form)), p = goalInput(fd), tg = calcTargets(p);
        $('#dietDesc').textContent = dietOf(p.diet).desc;
        $('#goalPrev').innerHTML = tg
          ? `${t('goals.preview', { kcal: fmt(tg.kcal), carbs: tg.carbs, protein: tg.protein, fat: tg.fat })}<br><span class="muted">${t('goals.previewBmr', { bmr: fmt(tg.bmr), tdee: fmt(tg.tdee) })}</span>`
          : `<span class="muted">${t('goals.previewMissing')}</span>`;
      };
      form.addEventListener('input', upd);
      form.addEventListener('change', upd);
      upd();
    });
}
const goalInput = fd => ({
  diet: fd.diet || 'lchf', sex: fd.sex || '', age: num(fd.age), height: num(fd.height), weight: num(fd.weight), goal: num(fd.goal),
  activity: num(fd.activity) || 1.375, pace: num(fd.pace) ?? 0.5
});
