#!/usr/bin/env node
/**
 * Local text-editing server for non-technical editors (e.g. on the same LAN).
 *
 *   node scripts/edit-texts-server.mjs      (or: npm run edit-texts)
 *
 * Prints a http://<lan-ip>:<port> link. Open it, edit any bot string in a
 * simple searchable list, click «Сохранить» — the change is written straight
 * into the .ts source (exact string replace). Then YOU review `git diff` and
 * commit. Safety: a change that drops/alters a {placeholder} or ${…} token is
 * rejected (so a broken interpolation can never ship), and quotes/newlines are
 * re-escaped for the literal's delimiter.
 *
 * Trusted LAN only — there is no auth and it writes to your working tree.
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const PORT = Number(process.env.PORT ?? 8787);
const CYR = /[Ѐ-ӿ]/;

// ───────────────────────── scanning ─────────────────────────
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'migrations' || name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** Char-scan for string/template literals (skips comments). */
function scanStrings(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      const start = i;
      i++;
      let inner = '';
      while (i < n) {
        const d = src[i];
        if (d === '\\') {
          inner += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (d === quote) {
          i++;
          break;
        }
        inner += d;
        i++;
      }
      tokens.push({ start, quote, inner });
      continue;
    }
    i++;
  }
  return tokens;
}

const lineOf = (src, off) => {
  let n = 1;
  for (let k = 0; k < off && k < src.length; k++) if (src[k] === '\n') n++;
  return n;
};

function classify(pre) {
  if (/(?:button\.callback|button\.url)\(\s*$/.test(pre)) return 'кнопка';
  if (/answerCbQuery\??\.?\(\s*$/.test(pre)) return 'всплывашка';
  if (/throw new Error\(\s*$/.test(pre)) return 'ошибка';
  return 'сообщение';
}

function groupOf(rel) {
  const m = /^src\/features\/([^/]+)\//.exec(rel);
  if (m) return m[1];
  if (rel.startsWith('src/core/')) return 'core';
  if (rel.startsWith('src/shared/')) return 'shared';
  return 'other';
}

/** human-readable view of a literal's raw inner content */
function unescapeInner(raw, delim) {
  if (delim === '`') return raw.replace(/\\`/g, '`').replace(/\\\\/g, '\\');
  return raw.replace(/\\(.)/g, (_m, c) =>
    c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c,
  );
}
/** re-escape an edited human string for its delimiter */
function escapeInner(human, delim) {
  if (delim === '`') return human.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  return human
    .replace(/\\/g, '\\\\')
    .replace(new RegExp(delim, 'g'), '\\' + delim)
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '');
}
const tokensOf = (s) => (s.match(/\$\{[^}]*\}|\{[A-Za-z_][A-Za-z0-9_]*\}/g) ?? []).slice().sort();

/** Scan all source, returning editable items. occ = which identical literal in the file. */
function scan() {
  const items = [];
  let id = 0;
  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file).split('\\').join('/');
    const occCount = new Map();
    for (const tok of scanStrings(src)) {
      if (!CYR.test(tok.inner)) continue;
      const occ = occCount.get(tok.inner) ?? 0;
      occCount.set(tok.inner, occ + 1);
      const pre = src.slice(Math.max(0, tok.start - 140), tok.start);
      items.push({
        id: id++,
        group: groupOf(rel),
        file: rel,
        line: lineOf(src, tok.start),
        kind: classify(pre),
        delim: tok.quote,
        raw: tok.inner, // exact source inner (for matching)
        occ,
        text: unescapeInner(tok.inner, tok.quote), // human view (for editing)
      });
    }
  }
  items.sort(
    (a, b) => a.group.localeCompare(b.group) || a.file.localeCompare(b.file) || a.line - b.line,
  );
  return items;
}

// ───────────────────────── applying ─────────────────────────
/**
 * Apply a batch of edits. Each: {file, delim, raw, occ, edited}. Groups by file,
 * computes all replacement spans up-front (so offsets don't drift), validates
 * placeholder integrity, then writes each file once. Returns per-id results.
 */
function applyChanges(changes) {
  const results = {};
  const byFile = new Map();
  for (const ch of changes) {
    // placeholder guard (compare the human forms)
    const before = tokensOf(unescapeInner(ch.raw, ch.delim));
    const after = tokensOf(ch.edited);
    if (before.join('') !== after.join('')) {
      results[ch.id] = {
        ok: false,
        error: `Подстановки изменены: было [${before.join(', ') || '—'}], стало [${after.join(', ') || '—'}]. Верни их как было.`,
      };
      continue;
    }
    if (!byFile.has(ch.file)) byFile.set(ch.file, []);
    byFile.get(ch.file).push(ch);
  }

  for (const [rel, list] of byFile) {
    const abs = join(ROOT, rel);
    let src;
    try {
      src = readFileSync(abs, 'utf8');
    } catch {
      for (const ch of list) results[ch.id] = { ok: false, error: 'Файл не найден' };
      continue;
    }
    const spans = [];
    for (const ch of list) {
      const target = ch.delim + ch.raw + ch.delim;
      // find the occ-th occurrence
      let idx = -1;
      let from = 0;
      for (let k = 0; k <= ch.occ; k++) {
        idx = src.indexOf(target, from);
        if (idx < 0) break;
        from = idx + target.length;
      }
      if (idx < 0) {
        results[ch.id] = {
          ok: false,
          error: 'Текст не найден в файле (файл изменился — перезагрузи страницу)',
        };
        continue;
      }
      const replacement = ch.delim + escapeInner(ch.edited, ch.delim) + ch.delim;
      spans.push({ start: idx, end: idx + target.length, replacement, id: ch.id });
    }
    // apply descending so earlier offsets stay valid
    spans.sort((a, b) => b.start - a.start);
    for (const s of spans) {
      src = src.slice(0, s.start) + s.replacement + src.slice(s.end);
      results[s.id] = { ok: true };
    }
    try {
      writeFileSync(abs, src, 'utf8');
    } catch (err) {
      for (const s of spans)
        results[s.id] = { ok: false, error: 'Не удалось записать файл: ' + err.message };
    }
  }
  return results;
}

// ───────────────────────── page ─────────────────────────
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(items) {
  const groups = [...new Set(items.map((i) => i.group))];
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Тексты бота — редактор</title>
<style>
  :root{--bg:#0f1115;--panel:#171a21;--line:#262b36;--fg:#e9e9ee;--mut:#8a93a6;--acc:#e0a23b;--ok:#3ad17a;--bad:#ff6b6b}
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
  header{position:sticky;top:0;z-index:9;background:var(--panel);border-bottom:1px solid var(--line);padding:12px 18px}
  h1{font-size:17px;margin:0 0 8px}
  .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  input#q{flex:1;min-width:240px;padding:10px 12px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;font-size:15px}
  button{padding:10px 16px;border:1px solid var(--line);background:#222733;color:var(--fg);border-radius:8px;cursor:pointer;font-size:15px}
  button.save{background:var(--acc);color:#1a1a1a;border-color:var(--acc);font-weight:600}
  button:disabled{opacity:.5;cursor:default}
  .hint{color:var(--mut);font-size:13px;margin-top:8px}
  .hint b{color:var(--acc)}
  main{max-width:920px;margin:0 auto;padding:16px 18px 80px}
  h2{font-size:14px;color:var(--acc);margin:24px 0 8px;border-top:1px solid var(--line);padding-top:10px}
  .item{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0}
  .item.changed{border-color:var(--acc)}
  .item.saved{border-color:var(--ok)}
  .item.bad{border-color:var(--bad)}
  .meta{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--mut);margin-bottom:6px}
  .badge{font-size:11px;padding:1px 8px;border-radius:999px;border:1px solid var(--line)}
  textarea{width:100%;resize:vertical;min-height:46px;font:15px/1.5 inherit;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:10px}
  textarea:focus{outline:2px solid var(--acc)}
  .ph{color:var(--acc);font-size:12px;margin-top:5px}
  .warn{color:var(--bad);font-size:12.5px;margin-top:5px;display:none}
  .item.bad .warn{display:block}
  .status{font-size:12.5px;color:var(--ok);margin-top:5px;display:none}
  .item.saved .status{display:block}
  .hidden{display:none}
  #count{font-variant-numeric:tabular-nums}
</style></head><body>
<header>
  <h1>✍️ Тексты бота</h1>
  <div class="row">
    <input id="q" type="search" placeholder="Поиск по тексту…" autocomplete="off">
    <span class="hint" style="margin:0"><span id="count">${items.length}</span> строк · <span id="chg">0</span> изменено</span>
    <button class="save" id="save" disabled>💾 Сохранить</button>
  </div>
  <div class="hint">Меняй текст прямо в полях и жми <b>«Сохранить»</b>. <b>{слова в фигурных скобках}</b> и <b>\${…}</b> — это подстановки (имя, цена, дата): их <b>не трогай</b>, иначе строка не сохранится.</div>
</header>
<main id="main"></main>
<script>
var DATA = ${JSON.stringify(items)};
var main = document.getElementById('main');
var groups = DATA.reduce(function(a,i){ if(a.indexOf(i.group)<0)a.push(i.group); return a; }, []);
function tokens(s){ var m = s.match(/\\$\\{[^}]*\\}|\\{[A-Za-z_][A-Za-z0-9_]*\\}/g) || []; return m.slice().sort().join('\\u0001'); }
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

groups.forEach(function(g){
  var sec = document.createElement('section');
  var h = document.createElement('h2'); h.textContent = g; sec.appendChild(h);
  DATA.filter(function(i){return i.group===g;}).forEach(function(it){
    var div = document.createElement('div'); div.className='item'; div.dataset.id=it.id;
    div.dataset.hay = (it.text+' '+it.file).toLowerCase();
    var meta = document.createElement('div'); meta.className='meta';
    meta.innerHTML = '<span class="badge">'+it.kind+'</span><span>'+esc(it.file)+'</span>';
    var ta = document.createElement('textarea'); ta.value = it.text;
    ta.dataset.orig = it.text; ta.dataset.tok = tokens(it.text);
    var phs = it.text.match(/\\$\\{[^}]*\\}|\\{[A-Za-z_][A-Za-z0-9_]*\\}/g);
    var ph = document.createElement('div'); ph.className='ph';
    ph.textContent = phs ? ('подстановки (не трогай): '+phs.join('  ')) : '';
    var warn = document.createElement('div'); warn.className='warn'; warn.textContent='⚠ Подстановки изменены — верни их как было, иначе не сохранится.';
    var status = document.createElement('div'); status.className='status'; status.textContent='✓ Сохранено';
    function fit(){ ta.style.height='auto'; ta.style.height=(ta.scrollHeight+4)+'px'; }
    ta.addEventListener('input', function(){
      fit();
      div.classList.remove('saved');
      var changed = ta.value !== ta.dataset.orig;
      div.classList.toggle('changed', changed);
      div.classList.toggle('bad', changed && tokens(ta.value)!==ta.dataset.tok);
      recount();
    });
    div.appendChild(meta); div.appendChild(ta); if(phs) div.appendChild(ph);
    div.appendChild(warn); div.appendChild(status);
    sec.appendChild(div);
    requestAnimationFrame(fit);
  });
  main.appendChild(sec);
});
function recount(){
  var chg = main.querySelectorAll('.item.changed').length;
  document.getElementById('chg').textContent = chg;
  document.getElementById('save').disabled = chg===0;
}
document.getElementById('q').addEventListener('input', function(e){
  var q = e.target.value.toLowerCase().trim(); var shown=0;
  main.querySelectorAll('.item').forEach(function(d){ var ok=!q||d.dataset.hay.indexOf(q)>=0; d.classList.toggle('hidden',!ok); if(ok)shown++; });
  main.querySelectorAll('section').forEach(function(s){ var any=false; s.querySelectorAll('.item').forEach(function(d){ if(!d.classList.contains('hidden'))any=true; }); s.classList.toggle('hidden',!any); });
  document.getElementById('count').textContent = shown;
});
document.getElementById('save').addEventListener('click', function(){
  var btn=this; var changes=[];
  main.querySelectorAll('.item.changed').forEach(function(div){
    var it = DATA[div.dataset.id]; var ta = div.querySelector('textarea');
    changes.push({ id: it.id, file: it.file, delim: it.delim, raw: it.raw, occ: it.occ, edited: ta.value });
  });
  if(!changes.length) return;
  btn.disabled=true; btn.textContent='Сохраняю…';
  fetch('/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes)})
    .then(function(r){return r.json();})
    .then(function(res){
      changes.forEach(function(ch){
        var div = main.querySelector('.item[data-id="'+ch.id+'"]'); var ta=div.querySelector('textarea');
        var r = res[ch.id]||{};
        if(r.ok){ ta.dataset.orig=ta.value; ta.dataset.tok=tokens(ta.value); div.classList.remove('changed','bad'); div.classList.add('saved'); }
        else { div.classList.add('bad'); var w=div.querySelector('.warn'); w.textContent='⚠ '+(r.error||'Не сохранено'); }
      });
      recount(); btn.textContent='💾 Сохранить';
    })
    .catch(function(){ btn.disabled=false; btn.textContent='💾 Сохранить'; alert('Ошибка сети'); });
});
</script>
</body></html>`;
}

// ───────────────────────── server ─────────────────────────
const server = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(scan()));
    return;
  }
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let results;
      try {
        results = applyChanges(JSON.parse(body));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
        return;
      }
      const okCount = Object.values(results).filter((r) => r.ok).length;
      console.log(
        `saved ${okCount}/${Object.keys(results).length} change(s) — review with: git diff`,
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results));
    });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

/** On WSL2, eth0 is a NAT'd address other LAN machines can't reach. Ask Windows
 * for its real LAN IPv4 (best-effort) so we print a link that actually works. */
function isWSL() {
  try {
    return /microsoft/i.test(readFileSync('/proc/version', 'utf8'));
  } catch {
    return false;
  }
}
function windowsLanIp() {
  // execFileSync (no shell) so PowerShell's $_ isn't eaten by /bin/sh.
  const ps =
    "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and " +
    "$_.IPAddress -notlike '169.254.*' -and $_.IPAddress -notlike '172.*' } | " +
    'Select-Object -First 1 -ExpandProperty IPAddress';
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    return out.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

server.listen(PORT, '0.0.0.0', () => {
  const lanIps = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log('\n  ✍️  Редактор текстов запущен.\n');
  console.log(`     На этом ПК:        http://localhost:${PORT}`);

  if (isWSL()) {
    const wslIp = lanIps[0];
    const winIp = windowsLanIp();
    console.log('\n  ⚠ Запущено в WSL2 — адрес ' + wslIp + ' из локальной сети НЕ виден.');
    if (winIp) {
      console.log(`     Для жены:          http://${winIp}:${PORT}`);
      console.log('\n  Чтобы это заработало, ОДИН раз выполни в Windows PowerShell ОТ АДМИНА:');
      console.log(
        `     netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=${PORT} connectaddress=${wslIp} connectport=${PORT}`,
      );
      console.log(
        `     netsh advfirewall firewall add rule name="goblin-edit ${PORT}" dir=in action=allow protocol=TCP localport=${PORT}`,
      );
      console.log(`  (IP WSL ${wslIp} меняется после перезагрузки — тогда команду повтори с новым адресом.)`);
    } else {
      console.log('     (не смог определить LAN-IP Windows — см. ipconfig, нужен адрес 192.168.x.x)');
    }
  } else {
    for (const ip of lanIps) console.log(`     Для жены (в сети): http://${ip}:${PORT}`);
  }
  console.log('\n  Она правит тексты и жмёт «Сохранить» → пишется в исходники.');
  console.log('  Ты потом смотришь  git diff  и коммитишь. Ctrl+C — остановить.\n');
});
