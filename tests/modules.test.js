// Statička provjera modula u www/js: svaki uvoz postoji, a service worker sprema svaki modul za rad bez interneta
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const www = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
const modules = walk(path.join(www, 'js'));
const rel = f => path.relative(www, f).split(path.sep).join('/');
const exportsOf = src => new Set([...src.matchAll(/^export (?:async )?(?:function\*? |const |let )([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));

test('svaki uvezeni modul i ime postoje', () => {
  for (const f of modules) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^import (?:\{([^}]*)\}|\* as \w+) from '([^']+)';/gm)) {
      const target = path.join(path.dirname(f), m[2]);
      assert.ok(fs.existsSync(target), `${rel(f)}: ne postoji ${m[2]}`);
      if (!m[1]) continue;
      const ex = exportsOf(fs.readFileSync(target, 'utf8'));
      for (const name of m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean))
        assert.ok(ex.has(name), `${rel(f)}: ${m[2]} ne izvozi ${name}`);
    }
  }
});

test('service worker sprema sve module i index.html učitava ulaznu točku', () => {
  const sw = fs.readFileSync(path.join(www, 'sw.js'), 'utf8');
  for (const f of modules) assert.ok(sw.includes(`'./${rel(f)}'`), `sw.js ne sprema ${rel(f)}`);
  const html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="js\/app\.js"><\/script>/);
});
