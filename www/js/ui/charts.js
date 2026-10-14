// Grafovi (SVG): stupci, linije i točke, prsten i traka napretka
import { fmt, h, sum } from '../core/format.js';

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw || 1)), m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
export function chart(o) {
  const W = 340, H = o.h || 170, L = 34, R = 6, T = 10, B = 20;
  const n = o.labels.length;
  const vals = [], stackTot = new Array(n).fill(0);
  let hasStack = false;
  for (const s of o.series) {
    if (s.type === 'bar' && s.stack) { hasStack = true; s.values.forEach((v, i) => stackTot[i] += v || 0); }
    else s.values.forEach(v => { if (v != null) vals.push(v); });
  }
  if (hasStack) vals.push(...stackTot.filter(v => v));
  if (!vals.length) return `<p class="empty">${o.empty || 'Nema podataka za ovo razdoblje.'}</p>`;
  (o.refs || []).forEach(r => r.y != null && vals.push(r.y));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (o.zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (hi === lo) { hi += 1; if (!o.zero) lo -= 1; }
  if (!o.zero) { const p = (hi - lo) * 0.1; lo -= p; hi += p; }
  const step = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step + 1e-9) * step; hi = Math.ceil(hi / step - 1e-9) * step;
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const cw = (W - L - R) / n, x = i => L + cw * (i + 0.5);
  const dec = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  let g = '';
  for (let v = lo; v <= hi + step / 2; v += step) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="grid"/><text x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" class="ax" text-anchor="end">${fmt(v, dec)}</text>`;
  }
  const base = new Array(n).fill(0);
  const bw = Math.max(1.5, Math.min(cw * 0.62, 26));
  for (const s of o.series.filter(s => s.type === 'bar')) {
    s.values.forEach((v, i) => {
      if (v == null || v === 0) return;
      const b0 = s.stack ? base[i] : Math.max(lo, 0), b1 = b0 + (s.stack ? v : v - (lo > 0 ? lo : 0));
      const y0 = y(b0), y1 = y(s.stack ? b1 : v);
      const col = typeof s.color === 'function' ? s.color(v, i) : s.color;
      g += `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.8, Math.abs(y0 - y1)).toFixed(1)}" rx="${Math.min(3, bw / 3).toFixed(1)}" style="fill:${col}"><title>${h(o.labels[i])}: ${fmt(v, s.dec || 0)} ${s.name || ''}</title></rect>`;
      if (s.stack) base[i] = b1;
    });
  }
  for (const s of o.series.filter(s => s.type === 'line')) {
    let d = '', pen = false;
    s.values.forEach((v, i) => {
      if (v == null) { if (!s.span) pen = false; return; }
      d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true;
    });
    if (d) g += `<path d="${d}" fill="none" style="stroke:${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ' stroke-dasharray="4 3"' : ''}/>`;
  }
  for (const s of o.series.filter(s => s.type === 'dots')) {
    const rr = n > 120 ? 1.4 : n > 45 ? 2 : 3;
    s.values.forEach((v, i) => {
      if (v == null) return;
      g += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${rr}" style="fill:${s.color}" opacity="${s.opacity || 1}"><title>${h(o.labels[i])}: ${fmt(v, s.dec || 0)} ${s.name || ''}</title></circle>`;
    });
  }
  for (const r of o.refs || []) {
    if (r.y == null) continue;
    g += `<line x1="${L}" x2="${W - R}" y1="${y(r.y).toFixed(1)}" y2="${y(r.y).toFixed(1)}" class="ref" style="stroke:${r.color}"/>`;
    if (r.label) g += `<text x="${W - R}" y="${(y(r.y) - 3).toFixed(1)}" text-anchor="end" class="reflbl" style="fill:${r.color}">${h(r.label)}</text>`;
  }
  const every = Math.ceil(n / (o.maxLabels || 7));
  o.labels.forEach((lb, i) => {
    if ((n - 1 - i) % every === 0) g += `<text x="${x(i).toFixed(1)}" y="${H - 5}" class="ax" text-anchor="middle">${h(lb)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${h(o.title || 'graf')}">${g}</svg>`;
}

export function donut(parts, size = 92) {
  const tot = sum(parts.map(p => p.v)), r = 38, c = 2 * Math.PI * r;
  let off = 0, s = `<circle cx="50" cy="50" r="${r}" fill="none" style="stroke:var(--soft)" stroke-width="13"/>`;
  if (tot) for (const p of parts) {
    const len = c * p.v / tot;
    s += `<circle cx="50" cy="50" r="${r}" fill="none" style="stroke:${p.color}" stroke-width="13" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 50 50)"/>`;
    off += len;
  }
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="donut">${s}${parts.center || ''}</svg>`;
}

export function pbar(label, val, target, color, limit = false) {
  const pct = target ? Math.min(100, val / target * 100) : 0;
  const over = limit && target && val > target;
  return `<div class="pbar"><div class="pbar-h"><span>${label}</span><span class="${over ? 'bad' : ''}"><b>${fmt(val)}</b> / ${fmt(target)} g</span></div>
    <div class="track"><i style="width:${pct}%;background:${over ? 'var(--bad)' : color}"></i></div></div>`;
}
