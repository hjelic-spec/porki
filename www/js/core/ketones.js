// Keto-Diastix skala (ketoni: 15 s, glukoza: 30 s) – boje su orijentacijske; nazivi su u prijevodima
import { t } from '../i18n/index.js';

// svojstvo l = naziv razine na odabranom jeziku
const labelled = prefix => (k, i) => Object.defineProperty(k, 'l', { get: () => t(`${prefix}.${i}`), enumerable: true });
export const KET = [
  { mg: 0, mmol: 0, c: '#efe3c9' },
  { mg: 5, mmol: 0.5, c: '#e9c3bd' },
  { mg: 15, mmol: 1.5, c: '#d6909f' },
  { mg: 40, mmol: 4, c: '#ad4f78' },
  { mg: 80, mmol: 8, c: '#7a2453' },
  { mg: 160, mmol: 16, c: '#4c1238' }
].map(labelled('ket'));
export const GLU = [
  { mg: 0, c: '#79c2c9' },
  { mg: 100, c: '#8fc49b' },
  { mg: 250, c: '#9fb35c' },
  { mg: 500, c: '#a28f3e' },
  { mg: 1000, c: '#8c6a2c' },
  { mg: 2000, c: '#694a22' }
].map(labelled('glu'));
// Kratko tumačenje razine ketona
export const ketText = i => t(`ket.text.${i}`);
