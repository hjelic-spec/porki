// Testovi se izvode u hrvatskoj vremenskoj zoni (ljetno/zimsko računanje vremena)
process.env.TZ = 'Europe/Zagreb';

// Lokalno vrijeme u ms: at('2026-10-14 08:30')
export const at = s => { const [d, t = '00:00'] = s.split(' '), [y, m, dd] = d.split('-').map(Number), [H, M] = t.split(':').map(Number); return new Date(y, m - 1, dd, H, M).getTime(); };
export const emptyDb = () => ({ settings: {}, weights: {}, ketones: [], energy: {}, foods: [], favorites: [], products: {}, fasts: [], fast: null });
// Obrok (≈ 300 kcal) u zadano vrijeme
export const meal = (date, time, extra = {}) => ({ id: date + time, date, time, name: 'Obrok', carbs: 5, fiber: 0, fat: 25, protein: 15, ...extra });
export const near = (t, a, b, eps = 1e-9) => t.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
