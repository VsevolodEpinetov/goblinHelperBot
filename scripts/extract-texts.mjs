#!/usr/bin/env node
/**
 * Extract every user-facing string from the bot's source into a browsable,
 * editable HTML map (texts-map.html).
 *
 * Heuristic: all user-facing copy is Russian, so we pull every string/template
 * literal that contains a Cyrillic character — code identifiers, log lines and
 * config keys are ASCII and fall away. A small char-scanner (not a regex) walks
 * each file so strings inside comments are skipped and multi-line template
 * literals are captured whole.
 *
 * Run: node scripts/extract-texts.mjs   →   writes ./texts-map.html
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const CYRILLIC = /[Ѐ-ӿ]/;

/** Recursively collect .ts files under src, skipping tests and migrations. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'migrations' || name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Walk the source char-by-char, emitting string/template literals with their
 * start offset. Skips // and /* *​/ comments. Template ${...} interpolations are
 * kept as part of the literal text (no nested-template support — none exists
 * in this codebase).
 */
function scanStrings(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    // comments
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

function lineOf(src, offset) {
  let line = 1;
  for (let k = 0; k < offset && k < src.length; k++) if (src[k] === '\n') line++;
  return line;
}

/** Best-effort classification from the code immediately preceding the literal. */
function classify(pre) {
  if (/(?:button\.callback|button\.url)\(\s*$/.test(pre)) return 'button';
  if (/answerCbQuery\??\.?\(\s*$/.test(pre)) return 'toast';
  if (/throw new Error\(\s*$/.test(pre)) return 'error';
  if (/(?:reply(?:With[A-Za-z]+)?|editMessageText|editMessageCaption|editOrReply|answerThenEdit|sendMessage)\([^)]*$/.test(pre))
    return 'message';
  return 'text';
}

function groupOf(relPath) {
  const m = /^src\/features\/([^/]+)\//.exec(relPath);
  if (m) return m[1];
  if (relPath.startsWith('src/core/')) return 'core';
  if (relPath.startsWith('src/shared/')) return 'shared';
  return 'other';
}

const items = [];
let id = 0;
for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).split('\\').join('/');
  for (const tok of scanStrings(src)) {
    if (!CYRILLIC.test(tok.inner)) continue;
    const line = lineOf(src, tok.start);
    const pre = src.slice(Math.max(0, tok.start - 140), tok.start);
    items.push({
      id: id++,
      group: groupOf(rel),
      file: rel,
      line,
      kind: classify(pre),
      delim: tok.quote,
      text: tok.inner,
    });
  }
}

// Stable order: group, then file, then line.
items.sort(
  (a, b) =>
    a.group.localeCompare(b.group) || a.file.localeCompare(b.file) || a.line - b.line,
);

const groups = [...new Set(items.map((i) => i.group))];
const generatedAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString().slice(0, 10)
  : 'snapshot';

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Goblin bot — карта текстов</title>
<style>
  :root { --bg:#0f1115; --panel:#171a21; --line:#262b36; --fg:#e6e6e6; --mut:#8a93a6; --accent:#e0a23b; --chg:#3ad17a; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--fg); }
  header { position:sticky; top:0; z-index:10; background:var(--panel); border-bottom:1px solid var(--line); padding:12px 16px; }
  h1 { font-size:15px; margin:0 0 8px; }
  .bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  input#q { flex:1; min-width:220px; padding:8px 10px; border:1px solid var(--line); background:var(--bg); color:var(--fg); border-radius:6px; }
  button { padding:8px 12px; border:1px solid var(--line); background:var(--bg); color:var(--fg); border-radius:6px; cursor:pointer; }
  button:hover { border-color:var(--accent); }
  .meta { color:var(--mut); font-size:12px; }
  nav { padding:8px 16px; border-bottom:1px solid var(--line); display:flex; gap:6px; flex-wrap:wrap; }
  nav a { color:var(--mut); text-decoration:none; font-size:12px; border:1px solid var(--line); padding:3px 8px; border-radius:999px; }
  nav a:hover { color:var(--accent); border-color:var(--accent); }
  main { padding:16px; max-width:1000px; margin:0 auto; }
  h2 { font-size:14px; color:var(--accent); margin:22px 0 8px; padding-top:6px; border-top:1px solid var(--line); }
  .item { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:10px 12px; margin:8px 0; }
  .item.changed { border-color:var(--chg); }
  .loc { display:flex; gap:8px; align-items:center; font-size:12px; color:var(--mut); margin-bottom:6px; }
  .badge { font-size:11px; padding:1px 7px; border-radius:999px; border:1px solid var(--line); text-transform:uppercase; letter-spacing:.04em; }
  .badge.button{color:#8ab4ff} .badge.toast{color:#e0a23b} .badge.message{color:#9fe0a0} .badge.error{color:#ff8a8a} .badge.text{color:var(--mut)}
  .path { font-family:ui-monospace,Menlo,Consolas,monospace; }
  textarea { width:100%; resize:vertical; min-height:42px; font:13px/1.45 ui-monospace,Menlo,Consolas,monospace; background:var(--bg); color:var(--fg); border:1px solid var(--line); border-radius:6px; padding:8px; white-space:pre-wrap; }
  textarea:focus { outline:1px solid var(--accent); }
  .ph { color:var(--accent); }
  .hidden { display:none; }
  #count { font-variant-numeric:tabular-nums; }
</style>
</head>
<body>
<header>
  <h1>🗺️ Карта текстов бота <span class="meta">— ${items.length} строк · ${groups.length} разделов · ${generatedAt}</span></h1>
  <div class="bar">
    <input id="q" type="search" placeholder="Поиск по тексту или файлу…" autocomplete="off">
    <span class="meta"><span id="count">${items.length}</span> показано · <span id="chg">0</span> изменено</span>
    <button id="export">⬇︎ Выгрузить изменения (JSON)</button>
    <button id="toggle">Свернуть всё</button>
  </div>
  <div class="meta" style="margin-top:6px">Правь текст прямо в полях. «Выгрузить изменения» соберёт только отредактированные строки (файл + было + стало) — отдай этот JSON разработчику или примени find/replace.</div>
</header>
<nav id="nav">${groups
  .map((g) => `<a href="#g-${esc(g)}">${esc(g)} (${items.filter((i) => i.group === g).length})</a>`)
  .join('')}</nav>
<main id="main"></main>
<script>
const DATA = ${JSON.stringify(items)};
const main = document.getElementById('main');
const groups = [...new Set(DATA.map(i => i.group))];
function highlightPlaceholders(s){
  // escape then re-mark \${...} and {name} placeholders
  const e = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return e;
}
for (const g of groups){
  const sec = document.createElement('section');
  const h = document.createElement('h2'); h.id = 'g-'+g; h.textContent = g;
  sec.appendChild(h);
  for (const it of DATA.filter(i=>i.group===g)){
    const div = document.createElement('div'); div.className='item'; div.dataset.id=it.id;
    div.dataset.hay = (it.text+' '+it.file).toLowerCase();
    const loc = document.createElement('div'); loc.className='loc';
    loc.innerHTML = '<span class="badge '+it.kind+'">'+it.kind+'</span>'
      + '<span class="path">'+it.file+':'+it.line+'</span>'
      + '<span class="meta">'+(it.delim==='\`'?'template':'string')+'</span>';
    const ta = document.createElement('textarea');
    ta.value = it.text;
    ta.dataset.original = it.text;
    const fit = () => { ta.style.height='auto'; ta.style.height=(ta.scrollHeight+4)+'px'; };
    ta.addEventListener('input', ()=>{ fit(); div.classList.toggle('changed', ta.value!==ta.dataset.original); recount(); });
    div.appendChild(loc); div.appendChild(ta);
    sec.appendChild(div);
    requestAnimationFrame(fit);
  }
  main.appendChild(sec);
}
function recount(){
  document.getElementById('chg').textContent = main.querySelectorAll('.item.changed').length;
}
document.getElementById('q').addEventListener('input', e=>{
  const q = e.target.value.toLowerCase().trim();
  let shown=0;
  for (const div of main.querySelectorAll('.item')){
    const ok = !q || div.dataset.hay.includes(q);
    div.classList.toggle('hidden', !ok); if(ok) shown++;
  }
  for (const sec of main.querySelectorAll('section')){
    const any = [...sec.querySelectorAll('.item')].some(d=>!d.classList.contains('hidden'));
    sec.classList.toggle('hidden', !any);
  }
  document.getElementById('count').textContent = shown;
});
document.getElementById('export').addEventListener('click', ()=>{
  const changes = [];
  for (const div of main.querySelectorAll('.item.changed')){
    const it = DATA[div.dataset.id];
    const ta = div.querySelector('textarea');
    changes.push({ file: it.file, line: it.line, kind: it.kind, delim: it.delim, original: ta.dataset.original, edited: ta.value });
  }
  const blob = new Blob([JSON.stringify(changes, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'text-changes.json'; a.click();
});
let collapsed=false;
document.getElementById('toggle').addEventListener('click', e=>{
  collapsed=!collapsed;
  for (const ta of main.querySelectorAll('textarea')) ta.classList.toggle('hidden', collapsed);
  e.target.textContent = collapsed ? 'Развернуть всё' : 'Свернуть всё';
});
</script>
</body>
</html>`;

const outPath = join(ROOT, 'texts-map.html');
writeFileSync(outPath, html, 'utf8');
console.log(`Wrote ${relative(ROOT, outPath)} — ${items.length} strings across ${groups.length} groups.`);
for (const g of groups) {
  console.log(`  ${g.padEnd(16)} ${items.filter((i) => i.group === g).length}`);
}
