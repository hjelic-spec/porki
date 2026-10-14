// Sigurnosna kopija: izvoz i uvoz podataka
import { today } from './core/format.js';
import { WB } from './native/widget.js';
import { db, save, setDb, withDefaults } from './store.js';
import { closeDialog } from './ui/dialog.js';
import { NATIVE, toast } from './ui/dom.js';
import { render } from './ui/render.js';

export function exportData() {
  if (NATIVE && WB) {
    // Android: izbornik Dijeli (Google disk, Datoteke, e-mail…); datum kopije tek kad je odredište odabrano
    WB.shareBackup({ json: JSON.stringify(db, null, 1), filename: `porki-${today()}.json` })
      .then(() => toast('Odaberi Google disk ili drugo mjesto za kopiju'))
      .catch(e => toast('Izvoz nije uspio: ' + e.message));
    return;
  }
  db.settings.lastBackup = today(); save();
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `porki-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Kopija izvezena');
}
export function importData() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const d = JSON.parse(await inp.files[0].text());
      if (!d || typeof d !== 'object' || !('weights' in d || 'foods' in d)) throw new Error('Nepoznat format');
      if (!confirm('Uvoz će zamijeniti sve trenutne podatke. Nastaviti?')) return;
      setDb(withDefaults(d), false);
      save(); closeDialog(); render(); toast('Podaci uvezeni');
    } catch (err) { toast('Uvoz nije uspio: ' + err.message); }
  };
  inp.click();
}
