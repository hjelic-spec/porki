// Skener barkoda (BarcodeDetector ili ZXing)
import { dlg, openDialog } from '../ui/dialog.js';
import { $, toast } from '../ui/dom.js';
import { lookupBarcode } from './search.js';
import { t } from '../i18n/index.js';

const scan = { stream: null, timer: 0, reader: null, done: true };
function stopScanner() {
  scan.done = true;
  clearTimeout(scan.timer);
  try { scan.reader && scan.reader.reset(); } catch { /* ignore */ }
  scan.reader = null;
  if (scan.stream) scan.stream.getTracks().forEach(tr => tr.stop());
  scan.stream = null;
}
dlg.addEventListener('close', stopScanner);
const loadScript = src => new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = () => fail(new Error(t('scan.loadFailed', { src })));
  document.head.appendChild(s);
});
export async function openScanner() {
  stopScanner();
  openDialog(`<h2>${t('scan.title')}</h2>
    <div class="scanbox"><video id="scanv" playsinline muted></video><i></i></div>
    <p class="muted small" id="scanmsg">${t('scan.starting')}</p>
    <div class="row">
      <input name="code" inputmode="numeric" placeholder="${t('scan.manualPh')}" autocomplete="off">
      <button class="btn">${t('scan.find')}</button>
    </div>
    <div class="btns end" style="margin-top:10px"><button type="button" class="btn" data-action="close">${t('btn.cancel')}</button></div>`,
    fd => {
      const c = (fd.code || '').replace(/\D/g, '');
      if (c.length < 8) { toast(t('scan.digits')); return false; }
      stopScanner(); lookupBarcode(c);
      return false;
    });
  scan.done = false;
  const msg = text => { const m = $('#scanmsg'); if (m) m.textContent = text; };
  if (!navigator.mediaDevices?.getUserMedia) return msg(t('scan.noCameraBrowser'));
  try {
    scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (e) {
    return msg(e.name === 'NotAllowedError' ? t('scan.denied') : t('scan.noCamera'));
  }
  const video = $('#scanv');
  if (scan.done || !video) return stopScanner();
  video.srcObject = scan.stream;
  await video.play().catch(() => {});
  msg(t('scan.aim'));
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
  } catch (e) { return msg(t('scan.notLoaded')); }
  if (scan.done) return;
  const F = ZXing.BarcodeFormat, hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128]);
  scan.reader = new ZXing.BrowserMultiFormatReader(hints);
  scan.reader.decodeFromStream(scan.stream, video, r => { if (r) found(r.getText()); }).catch(() => {});
}
