// Keto-Diastix skala (ketoni: 15 s, glukoza: 30 s) – boje su orijentacijske

/* Keto-Diastix skala (ketoni: 15 s, glukoza: 30 s) – boje su orijentacijske */
export const KET = [
  { l: 'Negativno', mg: 0, mmol: 0, c: '#efe3c9' },
  { l: 'Trag', mg: 5, mmol: 0.5, c: '#e9c3bd' },
  { l: 'Malo', mg: 15, mmol: 1.5, c: '#d6909f' },
  { l: 'Umjereno', mg: 40, mmol: 4, c: '#ad4f78' },
  { l: 'Puno', mg: 80, mmol: 8, c: '#7a2453' },
  { l: 'Jako puno', mg: 160, mmol: 16, c: '#4c1238' }
];
export const GLU = [
  { l: 'Negativno', mg: 0, c: '#79c2c9' },
  { l: 'Trag', mg: 100, c: '#8fc49b' },
  { l: '250', mg: 250, c: '#9fb35c' },
  { l: '500', mg: 500, c: '#a28f3e' },
  { l: '1000', mg: 1000, c: '#8c6a2c' },
  { l: '≥2000', mg: 2000, c: '#694a22' }
];
export const KET_TEXT = ['Nema ketona u urinu', 'Lagana ketoza', 'Lagana ketoza', 'Nutritivna ketoza', 'Visoki ketoni – pij dovoljno vode', 'Vrlo visoki ketoni – pij vodu, prati se'];
