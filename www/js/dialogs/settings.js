// Postavke te način prehrane i dnevni ciljevi
import { fmt, h, num, r1, shortDate, today } from '../core/format.js';
import { ACTIVITY, calcTargets, dietOf, DIETS, PACE } from '../core/nutrition.js';
import { hc } from '../native/health.js';
import { db, latestWeight, save } from '../store.js';
import { openDialog } from '../ui/dialog.js';
import { $, APK_URL, NATIVE, toast } from '../ui/dom.js';

/* Postavke */
export function openSettings() {
  const s = db.settings;
  openDialog(`<h2>Postavke</h2>
    <div class="stack">
      <div class="grid2">
        <label>Visina (cm)<input name="heightCm" inputmode="decimal" value="${s.heightCm ?? ''}"></label>
        <label>Ciljna težina (kg)<input name="goalWeight" inputmode="decimal" value="${s.goalWeight ?? ''}"></label>
      </div>
      <h3 style="margin:6px 0 0;font-size:13px;color:var(--muted)">Prehrana</h3>
      <button type="button" class="btn block" data-action="goals">${h(dietOf(s.diet).name)} · izračunaj ciljeve ›</button>
      <h3 style="margin:6px 0 0;font-size:13px;color:var(--muted)">Dnevni ciljevi</h3>
      <div class="grid2">
        <label>Limit neto UH (g)<input name="carbLimit" inputmode="numeric" value="${s.carbLimit}"></label>
        <label>Proteini (g)<input name="proteinTarget" inputmode="numeric" value="${s.proteinTarget}"></label>
        <label>Masti (g)<input name="fatTarget" inputmode="numeric" value="${s.fatTarget}"></label>
        <label>Kalorije (kcal)<input name="kcalTarget" inputmode="numeric" value="${s.kcalTarget}"></label>
      </div>
      <p class="muted small" style="margin:0">Okvirno: strogi keto ≤ 20–25 g, LCHF ≤ 50 g, umjereni low-carb ≤ 100 g neto UH. Proteini oko 1,2–1,6 g po kg ciljne težine. Za automatski izračun koristi „Prehrana“ iznad.</p>
      <label class="chk"><input type="checkbox" name="carbsIncludeFiber" ${s.carbsIncludeFiber ? 'checked' : ''}> UH na deklaracijama uključuju vlakna (US proizvodi)</label>
      <h3 style="margin:6px 0 0;font-size:13px;color:var(--muted)">Health Connect</h3>
      ${NATIVE ? `
        <p class="muted small" style="margin:0">Status: ${{ available: hc.granted.length ? `povezano (${hc.granted.length} dozvole)` : 'dostupno, nema dozvola', not_installed: 'nije instaliran', update_required: 'potrebno ažuriranje', unavailable: 'nije podržan na ovom uređaju', error: 'greška' }[hc.status] || 'provjeravam…'}${hc.lastSync ? ` · zadnja sinkronizacija ${new Date(hc.lastSync).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
        <label class="chk"><input type="checkbox" name="healthWeight" ${s.healthWeight ? 'checked' : ''}> Uvozi težinu iz Health Connecta (za dane bez unosa)</label>
        <div class="btns"><button type="button" class="btn" data-action="hc-perm">Dozvole</button><button type="button" class="btn" data-action="hc-open">Otvori Health Connect</button></div>`
      : `<p class="muted small" style="margin:0">Web-verzija ne može čitati Health Connect – potrošnju upiši ručno ili instaliraj <a href="${APK_URL}" target="_blank" rel="noopener">Android aplikaciju</a> koja je čita automatski. Web i Android aplikacija imaju odvojene podatke (prenesi ih izvozom/uvozom).</p>
        <input type="hidden" name="healthWeight" value="${s.healthWeight ? 'on' : ''}">`}
      <h3 style="margin:6px 0 0;font-size:13px;color:var(--muted)">Podaci</h3>
      <p class="muted small" style="margin:0">Svi podaci su spremljeni samo na ovom uređaju. Zadnja kopija: ${s.lastBackup ? shortDate(s.lastBackup) + s.lastBackup.slice(0, 4) : 'nikad'}.</p>
      <div class="btns">
        <button type="button" class="btn" data-action="reports">✉ Izvještaji e-mailom</button>
        <button type="button" class="btn" data-action="export">Izvezi kopiju</button>
        <button type="button" class="btn" data-action="import">Uvezi kopiju</button>
        <button type="button" class="btn danger" data-action="wipe">Obriši sve</button>
      </div>
      <div class="btns end"><button type="button" class="btn" data-action="close">Odustani</button><button class="btn primary">Spremi</button></div>
    </div>`,
    fd => {
      const n = (v, d) => { const x = num(v); return x == null ? d : x; };
      Object.assign(db.settings, {
        heightCm: n(fd.heightCm, null), goalWeight: n(fd.goalWeight, null),
        carbLimit: n(fd.carbLimit, 25), proteinTarget: n(fd.proteinTarget, 100), fatTarget: n(fd.fatTarget, 130), kcalTarget: n(fd.kcalTarget, 0),
        carbsIncludeFiber: !!fd.carbsIncludeFiber, healthWeight: !!fd.healthWeight
      });
      save(); toast('Postavke spremljene');
    });
}

export function openGoals() {
  const s = db.settings, lw = latestWeight(today());
  const opt = (arr, v) => arr.map(([val, l]) => `<option value="${val}" ${+v === val ? 'selected' : ''}>${l}</option>`).join('');
  openDialog(`<h2>Prehrana i ciljevi</h2>
    <div class="stack">
      <label>Način prehrane<select name="diet">${DIETS.map(d => `<option value="${d.id}" ${(s.diet || 'lchf') === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}</select></label>
      <p class="muted small" id="dietDesc" style="margin:0"></p>
      <fieldset><legend>Spol</legend><div class="seg" style="display:flex">
        <label class="segopt"><input type="radio" name="sex" value="z" ${s.sex === 'z' ? 'checked' : ''}><span>Žensko</span></label>
        <label class="segopt"><input type="radio" name="sex" value="m" ${s.sex === 'm' ? 'checked' : ''}><span>Muško</span></label></div></fieldset>
      <div class="grid2">
        <label>Dob (godine)<input name="age" inputmode="numeric" value="${s.age ?? ''}"></label>
        <label>Visina (cm)<input name="height" inputmode="numeric" value="${s.heightCm ?? ''}"></label>
        <label>Težina (kg)<input name="weight" inputmode="decimal" value="${lw ? fmt(lw.kg, 1) : ''}"></label>
        <label>Ciljna težina (kg)<input name="goal" inputmode="decimal" value="${s.goalWeight ?? ''}"></label>
      </div>
      <label>Aktivnost<select name="activity">${opt(ACTIVITY, s.activity || 1.375)}</select></label>
      <label>Tempo<select name="pace">${opt(PACE, s.pace ?? 0.5)}</select></label>
      <div class="preview" id="goalPrev"></div>
      <p class="muted small" style="margin:0">Izračun: Mifflin-St Jeor × aktivnost − deficit za odabrani tempo (7700 kcal ≈ 1 kg). Kalorije ne idu ispod 1200 (Ž) / 1500 (M). Vrijednosti možeš kasnije ručno promijeniti u Postavkama.</p>
      <div class="btns end"><button type="button" class="btn" data-action="close">Odustani</button><button class="btn primary">Primijeni</button></div>
    </div>`,
    fd => {
      const p = goalInput(fd), t = calcTargets(p);
      if (!t) { toast('Upiši spol, dob, visinu i težinu'); return false; }
      Object.assign(db.settings, {
        diet: p.diet, dietChosen: true, sex: p.sex, age: p.age, heightCm: p.height, goalWeight: p.goal || db.settings.goalWeight,
        activity: p.activity, pace: p.pace, kcalTarget: t.kcal, carbLimit: t.carbs, proteinTarget: t.protein, fatTarget: t.fat
      });
      if (p.weight && db.weights[today()] == null && !latestWeight(today())) db.weights[today()] = r1(p.weight);
      save();
      toast(`${dietOf(p.diet).name}: ${fmt(t.kcal)} kcal · UH ${t.carbs} g · P ${t.protein} g · M ${t.fat} g`);
    },
    form => {
      const upd = () => {
        const fd = Object.fromEntries(new FormData(form)), p = goalInput(fd), t = calcTargets(p);
        $('#dietDesc').textContent = dietOf(p.diet).desc;
        $('#goalPrev').innerHTML = t
          ? `<b>${fmt(t.kcal)} kcal</b> dnevno · neto UH <b>${t.carbs} g</b> · proteini <b>${t.protein} g</b> · masti <b>${t.fat} g</b><br><span class="muted">Bazalni metabolizam ${fmt(t.bmr)} kcal · ukupna potrošnja ≈ ${fmt(t.tdee)} kcal</span>`
          : '<span class="muted">Upiši spol, dob, visinu i težinu za izračun.</span>';
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
