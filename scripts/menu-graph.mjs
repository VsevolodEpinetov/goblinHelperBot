#!/usr/bin/env node
/**
 * Build an interactive navigation graph of the bot's menus: screens are nodes,
 * inline buttons are labelled arrows to the screen they open.
 *
 * The button inventory is extracted MECHANICALLY (every
 * `Markup.button.callback(LABEL, router.encode(schema, { a: 'TARGET' }))`,
 * url buttons, literal-data buttons, and homeButton()/homeRow() → onHome),
 * grouped by the keyboard-builder function that contains it. The screen↔builder
 * wiring and a few inline/scene screens are curated in CONFIG below.
 *
 * Run:  node scripts/menu-graph.mjs            → writes ./menu-graph.html
 *       node scripts/menu-graph.mjs --dump     → prints the extracted builders
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const CYR = /[Ѐ-ӿ]/;

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

/** Slice the balanced (...) argument list starting at the '(' index `open`. */
function balanced(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return { args: src.slice(open + 1, i), end: i };
    } else if (c === "'" || c === '"' || c === '`') {
      // skip string
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') i++;
        i++;
      }
    }
  }
  return { args: src.slice(open + 1), end: src.length };
}

/** Split an arg list on top-level commas (ignoring nested (),{},[] and strings). */
function splitArgs(s) {
  const parts = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < s.length && s[i] !== c) {
        if (s[i] === '\\') i++;
        i++;
      }
    } else if (c === ',' && depth === 0) {
      parts.push(s.slice(last, i));
      last = i;
      // skip the comma
      parts[parts.length - 1] = parts[parts.length - 1];
      last = i + 1;
    }
  }
  parts.push(s.slice(last));
  return parts.map((p) => p.trim());
}

const strLits = (s) => [...s.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2]);

/** Pull the target screen/action from a button's data-expression. */
function targetOf(dataExpr) {
  const a = /\ba:\s*'([^']+)'/.exec(dataExpr) || /\ba:\s*"([^"]+)"/.exec(dataExpr);
  if (a) return a[1];
  // literal callback_data string e.g. 'sbp:queue', 'raid:confirm', `sbp:confirm:${id}`
  const lit = strLits(dataExpr)[0];
  if (lit) return lit.replace(/\$\{[^}]*\}/g, '*'); // collapse interpolation
  return null;
}

/** Module-level definitions only (anchored at column 0), so local consts like
 * `const rows = []` inside a builder body don't shadow the builder's name. */
function defs(src) {
  const out = [];
  const re =
    /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)|^(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*[:=]/gm;
  let m;
  while ((m = re.exec(src))) out.push({ name: m[1] || m[2], index: m.index });
  return out.sort((a, b) => a.index - b.index);
}

const builders = {}; // name -> [{label, target, file, line}]
const bodies = {}; // name -> source text of its definition (to find helper calls)
function add(name, btn) {
  (builders[name] ||= []).push(btn);
}
function lineOf(src, off) {
  let n = 1;
  for (let k = 0; k < off; k++) if (src[k] === '\n') n++;
  return n;
}

for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).split('\\').join('/');
  const ds = defs(src);
  // Record each top-level def's body (its slice up to the next top-level def),
  // so we can later see which helper builders it calls.
  for (let k = 0; k < ds.length; k++) {
    const end = k + 1 < ds.length ? ds[k + 1].index : src.length;
    bodies[ds[k].name] = (bodies[ds[k].name] ?? '') + src.slice(ds[k].index, end);
  }
  const enclosing = (off) => {
    let best = '(top)';
    for (const d of ds) {
      if (d.index < off) best = d.name;
      else break;
    }
    return best;
  };

  // button.callback(label, data) / button.url(label, url)
  const re = /Markup\.button\.(callback|url)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const { args } = balanced(src, m.index + m[0].length - 1);
    const [labelExpr = '', dataExpr = ''] = splitArgs(args);
    const labels = strLits(labelExpr);
    const label = labels.length ? labels.join(' / ') : labelExpr.trim().slice(0, 24);
    const target = m[1] === 'url' ? 'EXTERNAL(url)' : targetOf(dataExpr);
    add(enclosing(m.index), {
      label: label.replace(/\$\{[^}]*\}/g, '…'),
      target: target || '(unknown)',
      file: rel,
      line: lineOf(src, m.index),
    });
  }

  // homeButton() / homeRow() CALLS inside a fn (not their definitions) → onHome edge
  const hre = /\bhome(Button|Row)\s*\(\s*\)/g;
  while ((m = hre.exec(src))) {
    const fn = enclosing(m.index);
    if (fn === 'homeButton' || fn === 'homeRow') continue; // their own defs
    add(fn, { label: '« В логово', target: 'onHome', file: rel, line: lineOf(src, m.index) });
  }
}

// ── Second pass: the MESSAGE text of each screen. A screen's text is the
// string passed at the send-site (editOrReply/reply/editMessageText/…) that
// also references that screen's keyboard builder. Identifiers (ABOUT_TEXT,
// PENDING_TEXT, header) are resolved to their literal(s) in the same file.
const builderTexts = {}; // builderName -> [{text, file, line}]
// Shared rows are used by many screens — never treat them as "the" screen kb.
const TEXT_EXCLUDE = new Set(['homeRow', 'homeButton', 'oldArchivesRow', 'archiveKeysRow']);
const builderNameList = Object.keys(builders)
  .filter((n) => !TEXT_EXCLUDE.has(n))
  .sort((a, b) => Number(/(Keyboard|Kb)$/.test(b)) - Number(/(Keyboard|Kb)$/.test(a)) || b.length - a.length);

function resolveConst(fileSrc, name) {
  const i = fileSrc.search(new RegExp(`\\bconst\\s+${name}\\s*=`));
  if (i < 0) return [];
  const seg = fileSrc.slice(i, i + 2000);
  return strLits(seg.slice(seg.indexOf('=') + 1)).filter((s) => CYR.test(s));
}

for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).split('\\').join('/');
  const SEND =
    /\b(editOrReply|answerThenEdit|reply|replyWithHTML|editMessageText|editMessageCaption|sendMessage)\s*\(/g;
  let m;
  while ((m = SEND.exec(src))) {
    const { args } = balanced(src, m.index + m[0].length - 1);
    const builder = builderNameList.find((n) => new RegExp(`\\b${n}\\b`).test(args));
    if (!builder) continue;
    const texts = [];
    for (const p of splitArgs(args)) {
      if (new RegExp(`\\b${builder}\\b`).test(p)) continue;
      const lits = strLits(p).filter((s) => CYR.test(s));
      if (lits.length) texts.push(...lits);
      else {
        const id = p.trim();
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) texts.push(...resolveConst(src, id));
      }
    }
    const line = lineOf(src, m.index);
    (builderTexts[builder] ||= []).push(...texts.map((t) => ({ text: t, file: rel, line })));
  }
}

if (process.argv.includes('--dump')) {
  console.log(JSON.stringify({ builders, builderTexts }, null, 2));
  process.exit(0);
}

// ───────────────────────────── CURATION ─────────────────────────────
// screen node id → keyboard builder(s) whose buttons are its outgoing edges,
// plus extra inline edges that don't live in a named builder.
const SCREENS = [
  // entry / onboarding
  { id: 'cmd:/start', label: '/start', kind: 'entry', inline: [] },
  { id: 'newbie', label: 'Ворота (новичок)', kind: 'onb', builders: ['startMenuForNewbie'] },
  { id: 'onAbout', label: 'Что это за место', kind: 'onb', builders: ['aboutMenu'] },
  { id: 'onApplyStart', label: 'Обряд допуска (сцена)', kind: 'scene', inline: [
    { label: '✅ Подать прошение', target: 'onboarding:submit' },
    { label: '❌ Уйти прочь', target: 'onboarding:cancel' },
  ], texts: [
    '📜 <b>Обряд допуска</b>\n\nНе молчи, чужак. Совет не впускает безымянных. Напиши о себе своими словами — кто ты, чего ищешь в логове и как набрёл на наши тропы. Пиши сообщениями, хоть несколькими…',
    '🕯 Подшил к прошению. Хочешь — добавь ещё сообщением. Закончил — жми «Подать прошение», передумал — «Уйти прочь».',
  ] },
  { id: 'pending', label: 'Прошение на рассмотрении', kind: 'onb', builders: ['pendingStatusKeyboard'] },
  { id: 'onHome', label: '🏠 Логово (хаб участника)', kind: 'home', builders: ['memberHubKeyboard'], texts: [
    '🔥 Снова в логове, свой. Выбирай кнопкой ниже.',
    '🔥 С возвращением, свой. Месячный архив за этот цикл луны уже твой — всё открыто. Выбирай кнопкой ниже: архив, профиль, кикстартеры или рейды.',
    '🪙 Ты свой, в логово пущен. Только свежий месячный архив ещё не взят — казна логова пополнения от тебя не видела. Жми кнопку ниже, бери архив. Профиль, кикстартеры и рейды — там же.',
  ] },
  { id: 'adminStart', label: '🏠 Хаб (админ /start)', kind: 'home', inline: [
    { label: '(меню участника)', target: 'onHome' },
    { label: '🛠 Админка', target: 'onAdminHub' },
  ] },

  // subscriptions
  { id: 'subOpen', label: '🪙 Месячный архив', kind: 'sub', builders: ['buyKeyboard', 'upgradeKeyboard', 'oldArchivesKeyboard'] },
  { id: 'subOldList', label: '📚 Старые архивы', kind: 'sub', builders: ['oldMonthsListKeyboard'] },
  { id: 'subOldMonth', label: '📦 Архив за месяц', kind: 'sub', builders: ['oldMonthTierKeyboard'] },
  { id: 'subBuy', label: '⭐ Счёт (Stars)', kind: 'pay', inline: [], texts: ['(счёт Telegram Stars — товар «Месячный архив за <период>», тариф и цена в ⭐; оплата в интерфейсе Telegram)'] },
  { id: 'subOldBuy', label: '⭐ Счёт за старый архив', kind: 'pay', inline: [], texts: ['(счёт Telegram Stars — «Старый архив за <период>», цена ×3 в ⭐)'] },
  { id: 'subUpgrade', label: '⭐ Счёт-расширение', kind: 'pay', inline: [], texts: ['(счёт Telegram Stars — «Расширение архива за <период>», доплата в ⭐)'] },
  { id: 'subSbp', label: '🧾 СБП (сцена)', kind: 'scene', inline: [
    { label: '« Отмена', target: 'onHome' },
  ], texts: [
    '🪙 Кидай скрин перевода по СБП за <тариф> архив — <период>. К оплате: <сумма> — ни рублём меньше. Куда слать рубли: <реквизиты>. Совет глянет и зачтёт руками — это не мигом, потерпи. Передумал — жми «Отмена».',
    '🪙 Уволок твой скрин наверх, совету. Зачтут перевод — ключ от архива придёт сам. Жди, не дёргай.',
  ] },
  { id: 'ksStars', label: '⭐ Счёт за кикстартер', kind: 'pay', inline: [], texts: ['(счёт Telegram Stars — название кикстартера и цена в ⭐)'] },

  // loyalty
  { id: 'profile', label: '👤 Профиль', kind: 'loy', builders: ['profileKeyboard'], texts: [
    '(карточка из данных: ранг/уровень, опыт, до след. уровня, 🏅 заслуги, 📜 свитки, 🗝 архивы)',
  ] },
  { id: 'leaders', label: '🏆 Лучшие в логове', kind: 'loy', builders: ['leaderboardKeyboard'], texts: [
    '(топ-10 из данных) + строка о тебе: «👁‍🗨 Твоё место в стае — N-е, опыта набрал …» / «🕯 А тебя в этом списке нет…» / «Пока пусто — никто ещё опыта не натаскал.»',
  ] },

  // kickstarters
  { id: 'ksList', label: '🎯 Кикстартеры', kind: 'ks', builders: ['catalogKeyboard'] },
  { id: 'ksMine', label: '🎯 Мои кикстартеры', kind: 'ks', builders: ['myKickstartersKeyboard'] },
  { id: 'ksView', label: '🎯 Карточка кикстартера', kind: 'ks', builders: ['userViewKeyboard'], texts: ['(карточка строится из данных: название, автор, цена, пледж, число фото/файлов)'] },
  { id: 'ksScrollAsk', label: '🎟 Отдать свиток?', kind: 'ks', builders: ['scrollConfirmKeyboard'] },
  { id: 'ksBuyScroll', label: '📦 Выдача файлов (свиток)', kind: 'terminal', inline: [{ label: 'файлы + карточка', target: 'ksView' }], texts: ['(списывает 1 свиток, шлёт файлы кикстартера, обновляет карточку как «куплено»)'] },
  { id: 'ksAdminMenu', label: '✏️ Кикстартер (админ)', kind: 'admin', builders: ['adminEditKeyboard'] },

  // raids
  { id: 'raidList', label: '⚔️ Рейды', kind: 'raid', builders: ['raidListKeyboard'] },
  { id: 'raidMine', label: '🛡 Мои рейды', kind: 'raid', builders: ['myRaidsKeyboard'] },
  { id: 'raidView', label: '⚔️ Карточка рейда', kind: 'raid', builders: ['raidViewKeyboard'], texts: ['(карточка строится из данных: название, описание, ссылка, цена, участники, дата)'] },
  { id: 'raidCompleteAsk', label: '✅ Завершить рейд?', kind: 'raid', builders: ['raidConfirmKeyboard'] },
  { id: 'raidCancelAsk', label: '❌ Отменить рейд?', kind: 'raid', builders: ['raidConfirmKeyboard'] },
  { id: 'raidCreate', label: '⚔️ Затеять рейд (сцена)', kind: 'scene', inline: [
    { label: '✅ Создать', target: 'raid:confirm' },
    { label: '« Назад', target: 'raidCreate' },
    { label: '❌ Отмена', target: 'onHome' },
  ], texts: ['(пошаговый мастер: название → фото → ссылка → цена → описание → дата → предпросмотр с кнопками «✅ Создать / « Назад / ❌ Отмена»)'] },
  { id: 'raid:confirm', label: '⚔️ Рейд создан', kind: 'terminal', inline: [
    { label: '🛡 Мои рейды', target: 'raidMine' },
    { label: '« В логово', target: 'onHome' },
  ], texts: ['⚔️ Рейд #<N> выкинут на доску в логове — теперь гоблины видят его и могут вписаться.'] },

  // invitations
  { id: 'inviteMenu', label: '🚪 Войти в архивы', kind: 'inv', builders: ['joinLinkKeyboard'] },
  { id: 'inviteGet', label: '🔑 Ссылка на архив', kind: 'inv', inline: [
    { label: '🚪 Другой месяц', target: 'inviteMenu' },
    { label: '« В логово', target: 'onHome' },
  ], texts: ['Готово, держи ссылку: <ссылка>', 'Твоя ссылка: <ссылка>  (если уже была выдана)'] },
  { id: 'inviteMain', label: '🏰 Ключ от главного зала', kind: 'inv', inline: [
    { label: '🏰 Войти в логово', target: 'EXTERNAL(url)' },
    { label: '🚪 Войти в архивы', target: 'inviteMenu' },
    { label: '« В логово', target: 'onHome' },
  ], texts: ['🏰 Держи ключ от главного зала логова. Пустит только тебя — не раздавай.'] },

  // promo
  { id: 'promoGet', label: '🎁 Подачка', kind: 'promo', inline: [{ label: '« В логово', target: 'onHome' }], texts: [
    '🪙 Держи добычу и проваливай — заглянешь ещё, ворота на месте.',
    '🌑 Сундук с подачками пуст — всё растащили. Загляни позже.  (тост, если пусто)',
    'Рано пришёл — подачку ты уже хватал. Жди ещё <время>.  (тост, кулдаун)',
  ] },

  // admin hub & tools
  { id: 'onAdminHub', label: '⚔️ Зал совета (админка)', kind: 'admin', builders: ['adminHubKeyboard'] },
  { id: 'adMonths', label: '📅 Месяцы', kind: 'admin', builders: ['monthsKeyboard'], texts: ['(список месяцев: «<период>/<тариф>: chat=… joined=… paid=…»)'] },
  { id: 'onAdminList', label: '📨 Прошения (список)', kind: 'admin', builders: ['adminListItemButton', 'adminFilterRow', 'adminPagination'], texts: ['(список прошений с фильтром ⏳/✅/🙅 и пагинацией)'] },
  { id: 'onAdminView', label: '📨 Прошение (карточка)', kind: 'admin', builders: ['adminViewKeyboard'], texts: ['(карточка прошения: кто подал, роли, текст прошения)'] },
  { id: 'adUser', label: '🔍 Карточка гоблина', kind: 'admin', builders: ['userCard'], texts: ['(карточка гоблина: статус, роли, заслуги, баланс)'] },
  { id: 'adHealth', label: '🩺 Проверить логово', kind: 'admin', builders: ['backToHubKeyboard'] },
  { id: 'adAddMonth', label: '➕ Добавить месяц (сцена)', kind: 'scene', inline: [] },
  { id: 'adSetMonthChat', label: '🔗 Привязать чат (форвард)', kind: 'scene', inline: [] },
  { id: 'sbp:queue', label: '🧾 СБП на проверку', kind: 'admin', inline: [] },
  { id: 'pay:hist:*', label: '💳 Платежи гоблина', kind: 'admin', inline: [] },
  { id: 'bindHere', label: '🔗 Привязать чат (/this_is)', kind: 'admin', builders: ['bindChatKeyboard'] },
  { id: 'cmd:/this_is', label: '/this_is (в чате архива)', kind: 'entry', inline: [{ label: 'команда', target: 'bindHere' }] },
  { id: 'polMenu', label: '📊 Опросы', kind: 'admin', builders: ['adminMenu'] },
];

// Some callback targets re-render an existing screen rather than open a new one.
const ALIAS = {
  onStatus: 'cmd:/start',
  onCancel: 'newbie',
  'onboarding:submit': 'pending',
  'onboarding:cancel': 'newbie',
  onApplyStart: 'onApplyStart',
  onAdminBack: 'onAdminList',
  onAdminFilter: 'onAdminList',
  raidJoin: 'raidView',
  raidLeave: 'raidView',
  raidClose: 'raidView',
  raidComplete: 'raidView',
  raidCancel: 'raidView',
  inviteGet: 'inviteGet',
  invitePage: 'inviteMenu',
  adGrantRole: 'adUser',
  adRemoveRole: 'adUser',
  adGrantScroll: 'adUser',
  adChangeBalance: 'adUser',
  adGrantAch: 'adUser',
  adFriend: 'adUser',
  adFind: 'adUser',
  adKsAdd: 'ksAdminMenu',
  bindCancel: 'onAdminHub',
  onAdminApprove: 'onAdminList',
  onAdminReject: 'onAdminList',
  onAdminHub: 'onAdminHub',
  ksEdit: 'ksAdminMenu',
  subSbp: 'subSbp',
};

const screenById = new Map(SCREENS.map((s) => [s.id, s]));
const KIND_COLOR = {
  entry: '#9b59b6', home: '#e0a23b', onb: '#7f8c8d', sub: '#27ae60', loy: '#2980b9',
  ks: '#16a085', raid: '#c0392b', inv: '#8e44ad', promo: '#d35400', admin: '#34495e',
  scene: '#f39c12', pay: '#1abc9c', terminal: '#95a5a6',
};

// home helpers are handled by the homeButton()/homeRow() pass — don't recurse
// into them or we'd double-add the onHome edge.
const NO_RECURSE = new Set(['homeButton', 'homeRow']);

/** All buttons of a builder, inlining any button-bearing helper it calls
 * (oldArchivesRow, raidItemRow, adminPagination, memberHubRows, …). */
function collectButtons(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const out = [...(builders[name] ?? [])];
  const body = bodies[name] ?? '';
  for (const helper of Object.keys(builders)) {
    if (helper === name || NO_RECURSE.has(helper)) continue;
    if (new RegExp(`\\b${helper}\\s*\\(`).test(body)) out.push(...collectButtons(helper, seen));
  }
  return out;
}

// Relabel a dynamic per-item button (whose label is a code fragment) by what it opens.
const DYNAMIC_LABEL = {
  ksView: '▸ кикстартер',
  raidView: '▸ рейд',
  subOldMonth: '▸ месяц',
  onAdminView: '▸ прошение',
  inviteGet: '▸ месяц',
  adUser: '▸ гоблин',
};
function cleanLabel(label, target) {
  if (target === 'subSbp') return '🧾 СБП'; // label is computed by sbpLabel()
  // Dynamic = a bare identifier, a function-call fragment, or only ellipsis.
  // (A real button like "🪙 Обычный — …" keeps its interpolated-price ellipsis.)
  const looksDynamic =
    /^[A-Za-z_]+$/.test(label) || /\b[A-Za-z_]+\(/.test(label) || /^…+$/.test(label) || label === '';
  if (looksDynamic) return DYNAMIC_LABEL[target] ?? '▸ (из списка)';
  return label;
}

// Collect outgoing buttons for a screen (from its builders + inline).
function buttonsFor(s) {
  const out = [];
  for (const b of s.builders ?? []) out.push(...collectButtons(b));
  for (const btn of s.inline ?? []) out.push(btn);
  return out;
}

const nodes = new Map();
const edges = [];
const SYNTH_LABELS = {
  'EXTERNAL(url)': '🌐 Внешняя ссылка',
  polCoreList: '📊 Студии: список',
  polCoreReset: '📊 Студии: сброс',
  polDynList: '📊 Динам. список',
  polDynReset: '📊 Динам. сброс',
  'raid:confirm': '⚔️ Рейд создан',
  'onboarding:submit': 'Прошение отправлено',
};
function ensureNode(id) {
  if (nodes.has(id)) return;
  const s = screenById.get(id);
  if (s) nodes.set(id, { id, label: s.label, kind: s.kind });
  else nodes.set(id, { id, label: SYNTH_LABELS[id] ?? id, kind: 'terminal' });
}

// /start fans out to the standing-specific entry screens.
for (const t of ['newbie', 'pending', 'onHome', 'adminStart'])
  edges.push({ from: 'cmd:/start', to: t, label: 'по статусу' });

const seenEdge = new Set();
function pushEdge(from, to, label) {
  const key = `${from}|${to}|${label}`;
  if (seenEdge.has(key)) return;
  seenEdge.add(key);
  edges.push({ from, to, label });
}
for (const e of edges) seenEdge.add(`${e.from}|${e.to}|${e.label}`); // seed with /start edges

for (const s of SCREENS) {
  ensureNode(s.id);
  for (const btn of buttonsFor(s)) {
    let to = btn.target;
    if (ALIAS[to]) to = ALIAS[to];
    if (to === s.id) continue; // drop self-loops (pagination/re-render)
    if (to === '(unknown)') continue; // dynamic target (pagination a:action var)
    ensureNode(to);
    pushEdge(s.id, to, cleanLabel(btn.label, to));
  }
}
// Per-node detail metadata for the side panel: message texts + in/out buttons.
const META = {};
for (const id of nodes.keys()) {
  const s = screenById.get(id);
  const texts = [];
  if (s) {
    for (const b of s.builders ?? []) for (const t of builderTexts[b] ?? []) texts.push(t);
    for (const t of s.texts ?? []) texts.push({ text: t, file: '(curated)', line: 0 });
  }
  const seen = new Set();
  const uniqTexts = texts.filter((t) => !seen.has(t.text) && seen.add(t.text));
  const labelOf = (nid) => nodes.get(nid)?.label ?? nid;
  META[id] = {
    label: nodes.get(id).label,
    kind: nodes.get(id).kind,
    texts: uniqTexts,
    out: edges.filter((e) => e.from === id).map((e) => ({ label: e.label, to: e.to, toLabel: labelOf(e.to) })),
    inn: edges.filter((e) => e.to === id).map((e) => ({ label: e.label, from: e.from, fromLabel: labelOf(e.from) })),
  };
}

const visNodes = [...nodes.values()].map((n) => ({
  id: n.id,
  label: META[n.id].texts.length ? n.label : n.label,
  color: { background: KIND_COLOR[n.kind] ?? '#888', border: '#0008' },
  font: { color: '#fff' },
  shape: 'box',
}));
const visEdges = edges.map((e, i) => ({
  id: i,
  from: e.from,
  to: e.to,
  label: e.label,
  arrows: 'to',
  font: { size: 10, color: '#cbd5e1', strokeWidth: 3, strokeColor: '#0f1115' },
  color: { color: '#4a5568', highlight: '#e0a23b' },
  smooth: { type: 'cubicBezier' },
}));

const legend = Object.entries(KIND_COLOR)
  .map(([k, c]) => `<span class="lg"><i style="background:${c}"></i>${k}</span>`)
  .join('');

const KIND_COLOR_JSON = JSON.stringify(KIND_COLOR);
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Goblin bot — граф меню</title>
<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<style>
  html,body{margin:0;height:100%;background:#0f1115;color:#e6e6e6;font:13px -apple-system,Segoe UI,Roboto,sans-serif}
  #bar{position:absolute;z-index:5;top:0;left:0;right:0;padding:8px 12px;background:#171a21cc;border-bottom:1px solid #262b36;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  #net{position:absolute;top:0;left:0;right:380px;bottom:0}
  #panel{position:absolute;top:0;right:0;bottom:0;width:380px;background:#13161d;border-left:1px solid #262b36;overflow:auto;padding:14px 16px 40px}
  #panel.empty{color:#8a93a6;display:flex;align-items:center;justify-content:center;text-align:center;padding:40px}
  select,button{background:#0f1115;color:#e6e6e6;border:1px solid #262b36;border-radius:6px;padding:6px 9px}
  .lg{display:inline-flex;align-items:center;gap:4px;color:#aab;font-size:11px;margin-right:2px}
  .lg i{width:11px;height:11px;border-radius:3px;display:inline-block}
  h1{font-size:13px;margin:0 8px 0 0}
  .muted{color:#8a93a6}
  .badge{font-size:11px;padding:1px 8px;border-radius:999px;color:#fff}
  .ptitle{font-size:15px;margin:6px 0 2px}
  .sec{margin:16px 0 6px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8a93a6}
  pre.msg{white-space:pre-wrap;word-break:break-word;background:#0f1115;border:1px solid #262b36;border-radius:8px;padding:9px 10px;margin:6px 0;font:12.5px/1.5 ui-monospace,Menlo,Consolas,monospace}
  pre.msg .src{display:block;color:#5b6473;font-size:10px;margin-top:6px}
  .ph{color:#e0a23b}
  .btnrow{display:flex;gap:6px;align-items:baseline;padding:4px 0;border-bottom:1px solid #1d212b;cursor:pointer}
  .btnrow:hover{background:#171a2155}
  .btnlbl{flex:1}
  .arrow{color:#5b6473}
  .to{color:#8ab4ff}
  @media(max-width:760px){#net{right:0;bottom:45%}#panel{top:55%;width:auto;left:0;border-left:0;border-top:1px solid #262b36}}
</style></head><body>
<div id="bar">
  <h1>🗺️ Граф меню</h1>
  <label class="muted">направление
    <select id="dir"><option value="UD">сверху вниз</option><option value="LR">слева направо</option><option value="">свободно (физика)</option></select>
  </label>
  <button id="fit">⤢ Вписать</button>
  <span class="muted">${visNodes.length} экранов · ${visEdges.length} переходов · клик по узлу — тексты и кнопки</span>
  <span style="flex:1"></span>
  ${legend}
</div>
<div id="net"></div>
<div id="panel" class="empty">Кликни по экрану — покажу его тексты и кнопки.</div>
<script>
const META = ${JSON.stringify(META)};
const KIND_COLOR = ${KIND_COLOR_JSON};
const nodes = new vis.DataSet(${JSON.stringify(visNodes)});
const edges = new vis.DataSet(${JSON.stringify(visEdges)});
const container = document.getElementById('net');
function opts(dir){
  return {
    layout: dir ? { hierarchical: { enabled:true, direction:dir, sortMethod:'directed', nodeSpacing:150, levelSeparation:150 } } : { hierarchical:false },
    physics: dir ? false : { stabilization:true, barnesHut:{ springLength:160 } },
    interaction: { hover:true, dragNodes:true, multiselect:false, navigationButtons:true, keyboard:true },
    edges: { font:{ align:'middle' } },
    nodes: { margin:8, widthConstraint:{ maximum:180 } },
  };
}
let network = new vis.Network(container, { nodes, edges }, opts('UD'));
document.getElementById('dir').addEventListener('change', e=> network.setOptions(opts(e.target.value)));
document.getElementById('fit').addEventListener('click', ()=>network.fit({animation:true}));

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const ph = s => esc(s).replace(/\\\$\\{[^}]*\\}|\\{[a-zA-Z_]+\\}/g, m=>'<span class="ph">'+m+'</span>');
const panel = document.getElementById('panel');

function render(id){
  const m = META[id];
  if(!m){ panel.className='empty'; panel.textContent='—'; return; }
  panel.className='';
  let h = '<span class="badge" style="background:'+(KIND_COLOR[m.kind]||'#888')+'">'+m.kind+'</span>';
  h += '<div class="ptitle">'+esc(m.label)+'</div><div class="muted">'+esc(id)+'</div>';
  h += '<div class="sec">Текст экрана ('+m.texts.length+')</div>';
  if(m.texts.length){
    for(const t of m.texts) h += '<pre class="msg">'+ph(t.text)+'<span class="src">'+esc(t.file)+(t.line?(':'+t.line):'')+'</span></pre>';
  } else {
    h += '<div class="muted">— нет статичного текста (строится из данных или задаётся в обработчике). См. texts-map.html.</div>';
  }
  h += '<div class="sec">Кнопки → куда ведут ('+m.out.length+')</div>';
  if(m.out.length) for(const o of m.out)
    h += '<div class="btnrow" data-go="'+esc(o.to)+'"><span class="btnlbl">'+esc(o.label)+'</span><span class="arrow">→</span><span class="to">'+esc(o.toLabel)+'</span></div>';
  else h += '<div class="muted">— конечный экран</div>';
  h += '<div class="sec">Откуда приходят ('+m.inn.length+')</div>';
  if(m.inn.length) for(const o of m.inn)
    h += '<div class="btnrow" data-go="'+esc(o.from)+'"><span class="to">'+esc(o.fromLabel)+'</span><span class="arrow">—'+esc(o.label)+'→</span></div>';
  else h += '<div class="muted">— только по команде / прямой ссылке</div>';
  panel.innerHTML = h;
  panel.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click', ()=>{
    const t=el.getAttribute('data-go'); network.selectNodes([t]); network.focus(t,{scale:1.1,animation:true}); render(t);
  }));
}
network.on('selectNode', p=> render(p.nodes[0]));
network.on('deselectNode', ()=>{ panel.className='empty'; panel.textContent='Кликни по экрану — покажу его тексты и кнопки.'; });
</script>
</body></html>`;

writeFileSync(join(ROOT, 'menu-graph.html'), html, 'utf8');
console.log(`Wrote menu-graph.html — ${visNodes.length} nodes, ${visEdges.length} edges.`);
// report unresolved targets so curation gaps are visible
const unknown = [...nodes.values()].filter((n) => !screenById.has(n.id) && !n.id.startsWith('EXTERNAL'));
if (unknown.length) console.log('Synthesized (non-screen) targets:', unknown.map((n) => n.id).join(', '));
