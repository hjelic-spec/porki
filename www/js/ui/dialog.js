// Dijalog (donja ploča) s gornjom trakom koja ostaje vidljiva pri pomicanju
import { h } from '../core/format.js';
import { $ } from './dom.js';
import { render } from './render.js';

/* ================= Dijalozi ================= */
export const dlg = $('#dlg');
let dlgSubmit = null;
export function openDialog(html, onSubmit, onReady) {
  dlg.innerHTML = `<form class="sheet" method="dialog" novalidate>${html}</form>`;
  // Gornja traka koja ostaje vidljiva pri pomicanju: naslov, zatvori i glavni gumb (kopija donjeg)
  const form = dlg.querySelector('form'), title = form.querySelector('h2');
  if (title) {
    const submit = [...form.querySelectorAll('button')].filter(b => b.type === 'submit').at(-1);
    const head = document.createElement('div');
    head.className = 'sheet-head';
    head.innerHTML = `<span class="sheet-actions">${submit ? `<button class="btn primary sm">${h(submit.textContent.trim())}</button>` : ''}<button type="button" class="icon-btn" data-action="close" aria-label="Zatvori">✕</button></span>`;
    title.replaceWith(head);
    head.prepend(title);
  }
  dlgSubmit = onSubmit;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  onReady && onReady(dlg.querySelector('form'));
}
export function closeDialog() { dlg.close(); dlg.innerHTML = ''; }
dlg.addEventListener('submit', ev => {
  ev.preventDefault();
  if (!dlgSubmit) return closeDialog();
  const fd = Object.fromEntries(new FormData(ev.target));
  if (dlgSubmit(fd, ev.target) !== false) { closeDialog(); render(); }
});
dlg.addEventListener('click', ev => { if (ev.target === dlg) closeDialog(); });
