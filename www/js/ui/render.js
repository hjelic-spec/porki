// Iscrtavanje aktivne kartice
import { dayLabel, today } from '../core/format.js';
import { $, state } from './dom.js';
import { viewAnalysis } from '../views/analysis.js';
import { viewFood } from '../views/food.js';
import { viewKetones } from '../views/ketones.js';
import { viewRecipes } from '../views/recipes.js';
import { viewToday } from '../views/today.js';
import { viewWeight } from '../views/weight.js';

const VIEWS = { today: viewToday, food: viewFood, weight: viewWeight, ketones: viewKetones, analysis: viewAnalysis, recipes: viewRecipes };
export function render() {
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  const showDate = state.tab === 'today' || state.tab === 'food';
  $('#datebar').hidden = !showDate;
  if (showDate) {
    $('#dateLabel').textContent = (state.date === today() ? 'Danas · ' : '') + dayLabel(state.date);
    $('#nextDay').disabled = state.date >= today();
  }
  $('#view').innerHTML = VIEWS[state.tab]();
}
