// Skener barkoda (BarcodeDetector ili ZXing)
import { dlg, openDialog } from '../ui/dialog.js';
import { $, toast } from '../ui/dom.js';
import { lookupBarcode } from './search.js';

const scan = { stream: null, timer: 0, reader: null, done: true };
function stopScanner() {
  scan.done = true;
  clearTimeout(scan.timer);
  try { scan.reader && scan.reader.reset(); } catch { /* ignore */ }
  scan.reader = null;
  if (scan.stream) scan.stream.getTracks().forEach(t => t.stop());
  scan.stream = null;
}
dlg.addEventListener('close', stopScanner);
const loadScript = src => new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Ne mogu učitati ' + src));
  document.head.appendChild(s);
});
export async function openScanner() {
  stopScanner();
  openDialog(`<h2>Skeniraj barkod</h2>
    <div class="scanbox"><video id="scanv" playsinline muted></video><i></i></div>
    <p class="muted small" id="scanmsg">Pokrećem kameru…</p>
    <div class="row">
      <input name="code" inputmode="numeric" placeholder="ili upiši barkod" autocomplete="off">
      <button class="btn">Traži</button>
    </div>
    <div class="btns end" style="margin-top:10px"><button type="button" class="btn" data-action="close">Odustani</button></div>`,
    fd => {
      const c = (fd.code || '').replace(/\D/g, '');
      if (c.length < 8) { toast('Barkod ima 8–14 znamenki'); return false; }
      stopScanner(); lookupBarcode(c);
      return false;
    });
  scan.done = false;
  const msg = t => { const m = $('#scanmsg'); if (m) m.textContent = t; };
  if (!navigator.mediaDevices?.getUserMedia) return msg('Kamera nije dostupna u ovom pregledniku – upiši barkod ručno.');
  try {
    scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (e) {
    return msg(e.name === 'NotAllowedError' ? 'Pristup kameri nije dopušten – dopusti ga u postavkama ili upiši barkod.' : 'Kamera nije dostupna – upiši barkod ručno.');
  }
  const video = $('#scanv');
  if (scan.done || !video) return stopScanner();
  video.srcObject = scan.stream;
  await video.play().catch(() => {});
  msg('Usmjeri kameru prema barkodu…');
  const found = code => {
    if (scan.done) return;
    stopScanner();
    if (navigator.vibrate) navigator.vibrate(60);
    lookupBarcode(code);
  };
  if ('BarcodeDetector' in window) {
    try {
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      const tick = async () => {
        if (scan.done) return;
        try { const r = await det.detect(video); if (r.length) return found(r[0].rawValue); } catch { /* sljedeći okvir */ }
        scan.timer = setTimeout(tick, 200);
      };
      return tick();
    } catch { /* format nije podržan – ZXing */ }
  }
  try {
    if (!window.ZXing) await loadScript('vendor/zxing.min.js');
  } catch (e) { return msg('Skener se nije učitao – upiši barkod ručno.'); }
  if (scan.done) return;
  const F = ZXing.BarcodeFormat, hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128]);
  scan.reader = new ZXing.BrowserMultiFormatReader(hints);
  scan.reader.decodeFromStream(scan.stream, video, r => { if (r) found(r.getText()); }).catch(() => {});
}
