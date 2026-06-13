import { type Context, type Telegraf } from 'telegraf';

import { requireRoles } from '../../core/permissions';
import { db } from '../../db/client';
import { escapeHtml } from '../../shared/format';
import { adminHubKeyboard } from '../onboarding/admin/menus';

import { bindChatKeyboard, userListKeyboard } from './menus';
import { searchUsers } from './repo';
import { normalizePeriodInput, parseTier, parseUserQuery, tierWord } from './service';

const ADMIN_ROLES = ['admin', 'adminPlus', 'super'] as const;

const BIND_COMMAND = /^\/(?:this_is|thisis|bind)(?:@\w+)?(?:\s|$)/i;

/**
 * Drive the `/this_is` flow: parse «period [tier]» from the command text and
 * post a tier-confirmation prompt in the SAME chat. The actual bind happens on
 * the button tap (a verified-staff callback), which is what makes this safe in
 * channels — where the command post itself carries no user to authorize.
 */
async function promptBindArchive(ctx: Context, rawText: string): Promise<void> {
  const chat = ctx.chat;
  if (!chat || chat.type === 'private') {
    await ctx.reply(
      '🌑 Не тут. Команду эту ори внутри самого архива — в той группе или канале, что метим. Со мной с глазу на глаз чат не привяжешь.',
    );
    return;
  }
  const args = rawText.replace(BIND_COMMAND, '').trim();
  const parts = args.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    await ctx.reply(
      '⚔️ Скажи, какой цикл луны метим: <code>/this_is 2026_05</code>. Можешь дописать и закром — <code>/this_is 2026_05 расширенный</code> (или обычный), тогда спрашивать не стану.',
      { parse_mode: 'HTML' },
    );
    return;
  }
  const period = normalizePeriodInput(parts[0]!);
  if (!period) {
    await ctx.reply(
      `🕯 «<code>${escapeHtml(parts[0]!)}</code>» — не похоже на цикл луны. Жду вида <code>2026_05</code>: год, чёрточка, месяц.`,
      { parse_mode: 'HTML' },
    );
    return;
  }
  const tier = parseTier(parts[1]);
  const title = escapeHtml('title' in chat ? chat.title : 'этот чат');
  if (tier) {
    await ctx.reply(
      `⚖️ Этот чат — <b>${title}</b> — привязать как <b>${tierWord(tier)}</b> архив за <b>${period}</b>? Подтверди ниже.`,
      { parse_mode: 'HTML', ...bindChatKeyboard(period, tier) },
    );
    return;
  }
  await ctx.reply(
    `⚖️ Этот чат — <b>${title}</b> — метим как архив за <b>${period}</b>. Какой закром, велишь? Жми ниже.`,
    { parse_mode: 'HTML', ...bindChatKeyboard(period) },
  );
}

export function registerAdminCommands(bot: Telegraf): void {
  bot.command('admin', requireRoles(...ADMIN_ROLES), async (ctx) => {
    // Same hub the «Админка» button renders — one keyboard, two entrances.
    await ctx.reply('Админ-меню:', adminHubKeyboard());
  });

  bot.command('admin_find', requireRoles(...ADMIN_ROLES), async (ctx) => {
    const argv = ctx.message.text.replace(/^\/admin_find\s*/i, '').trim();
    if (!argv) {
      await ctx.reply('Использование: /admin_find <id или @username>');
      return;
    }
    try {
      const q = parseUserQuery(argv);
      const rows = await searchUsers(db, q, 20);
      if (rows.length === 0) {
        await ctx.reply('Не найдено.');
        return;
      }
      await ctx.reply(`Найдено: ${rows.length}`, userListKeyboard(rows));
    } catch (err) {
      await ctx.reply((err as Error).message);
    }
  });

  // `/this_is <period> [tier]` inside an archive group — staff-gated by user.
  bot.command(['this_is', 'thisis', 'bind'], requireRoles(...ADMIN_ROLES), async (ctx) => {
    await promptBindArchive(ctx, ctx.message.text);
  });

  // Same command inside a CHANNEL: channel posts carry no user, so we can't
  // gate the prompt on roles here — but only channel admins can post, and the
  // actual bind is gated on the (verified-staff) button tap.
  bot.on('channel_post', async (ctx, next) => {
    const post = ctx.channelPost;
    const text = post && 'text' in post ? post.text : undefined;
    if (!text || !BIND_COMMAND.test(text)) return next();
    await promptBindArchive(ctx, text);
  });
}
