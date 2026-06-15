import { Markup, type Telegram } from 'telegraf';

import { featureConfig } from '../../core/config';
import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { escapeHtml } from '../../shared/format';
import { invitationsCallback } from '../invitations/schemas';
import { service as invitationsService } from '../invitations/service';
import { homeButton } from '../onboarding/menus';
import { listUserSubscriptions } from '../subscriptions/repo';

/** Whether this is the user's first paid period (→ they also need the main-group key). */
async function isFirstPaidPeriod(userId: number): Promise<boolean> {
  const subs = await listUserSubscriptions(db, userId);
  const periods = new Set(subs.map((s) => s.period));
  return periods.size <= 1;
}

/** Inline-button labels for the per-tier archive keys (used when handing over both at once). */
const ARCHIVE_BTN_LABEL: Readonly<Record<'regular' | 'plus', string>> = {
  regular: '🔑 Обычный архив',
  plus: '🔑 Расширенный архив',
};

/** Ping the совет that a paid archive has no bound chat, so no key can be minted. */
async function alertNoChat(
  telegram: Telegram,
  userId: number,
  period: string,
  type: 'regular' | 'plus',
): Promise<void> {
  const adminChat = featureConfig().adminNotificationsChat;
  if (!adminChat) return;
  const u = await db('users').where('id', userId).first('username');
  const who = escapeHtml(u?.username ? `@${u.username}` : `id:${userId}`);
  await telegram.sendMessage(
    adminChat,
    `⚠️ <b>Архив без двери</b>\nГоблин ${who} оплатил ${period}/${type}, но чат месяца не привязан — ключ выдать некуда. Привяжи группу через /admin → Months.`,
    { parse_mode: 'HTML' },
  );
}

/**
 * After a granted group payment — Stars OR SBP — DM the buyer their personal
 * one-time archive key(s) (plus the main-group key on their first paid period).
 * A plus buy hands over BOTH the regular and plus keys: the plus price is the
 * price for both groups. Best-effort: catches everything so it never breaks the
 * payment/confirm flow.
 */
export async function deliverAccessKeys(opts: {
  telegram: Telegram;
  userId: number;
  period: string;
  /** Archive tiers to hand keys for, in display order (regular before plus). */
  types: Array<'regular' | 'plus'>;
}): Promise<void> {
  const { telegram, userId, period, types } = opts;
  try {
    // Mint a one-time key per tier. A tier whose month chat isn't bound yet
    // yields no link — record it so we can still hand over the keys we do have
    // and ping admins to bind the rest.
    const keys: Array<{ type: 'regular' | 'plus'; link: string }> = [];
    const missing: Array<'regular' | 'plus'> = [];
    for (const type of types) {
      const result = await invitationsService.getOrCreateInvitationLink({ userId, period, type });
      if (result.status === 'no_chat') missing.push(type);
      else keys.push({ type, link: result.link });
    }

    // No requested archive has a door yet — nothing to hand over.
    if (keys.length === 0) {
      await telegram.sendMessage(
        userId,
        '🌑 Плата в казне, доступ за тобой записан — а дверь в этот архив библиотекарь ещё не отпер. Загляни позже через меню или жди: ключ сам придёт.',
        Markup.inlineKeyboard([[homeButton()]]),
      );
      for (const type of missing) await alertNoChat(telegram, userId, period, type);
      return;
    }

    // One button per archive key. With a single key keep the familiar generic
    // label; with two, name each by tier so the buyer can tell them apart.
    const archiveButtons =
      keys.length === 1
        ? [[Markup.button.url('🔑 Открыть архив ключом', keys[0]!.link)]]
        : keys.map((k) => [Markup.button.url(ARCHIVE_BTN_LABEL[k.type], k.link)]);

    if (await isFirstPaidPeriod(userId)) {
      const main = await invitationsService.createMainGroupLink(userId);
      if (main.status === 'created') {
        const body =
          keys.length === 1
            ? `🔥 Ну всё, ты теперь свой. Логово тебя приняло.\nВнизу два ключа — каждый пускает только тебя и только один раз.\nПервый — в главный зал, где собираются все. Второй — в месячный архив за ${period}, что ты взял.`
            : `🔥 Ну всё, ты теперь свой. Логово тебя приняло.\nВнизу три ключа — каждый пускает только тебя и только один раз, не раздавай.\nПервый — в главный зал, где собираются все. Второй — в обычный архив за ${period}. Третий — в расширенный архив за ${period}: за него ты и платил, обычный идёт довеском.`;
        await telegram.sendMessage(
          userId,
          body,
          Markup.inlineKeyboard([
            [Markup.button.url('🏰 Войти в логово', main.link)],
            ...archiveButtons,
            [homeButton()],
          ]),
        );
        for (const type of missing) await alertNoChat(telegram, userId, period, type);
        return;
      }
      logger.warn({ userId }, 'first paid period but MAIN_GROUP_ID unset — archive key only');
    }

    const laterBody =
      keys.length === 1
        ? '🔑 Готово, гоблин. Твой личный ключ от месячного архива — на кнопке ниже. Пустит только тебя и только раз — не зевай.'
        : `🔑 Готово, гоблин. Внизу два ключа — каждый пускает только тебя и только раз, не зевай.\nОдин — в обычный архив за ${period}, другой — в расширенный за ${period}. Брал расширенный — обычный получаешь в придачу.`;
    await telegram.sendMessage(
      userId,
      laterBody,
      Markup.inlineKeyboard([...archiveButtons, [homeButton()]]),
    );
    for (const type of missing) await alertNoChat(telegram, userId, period, type);
  } catch (err) {
    logger.error({ err, userId, period, types }, 'invite key delivery failed');
    try {
      await telegram.sendMessage(
        userId,
        '🌑 Доступ за тобой записан, не переживай. А вот ключ по дороге застрял — забери сам кнопкой ниже или жди, донесу.',
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🚪 Взять ключ',
              router.encode(invitationsCallback, { a: 'inviteMenu' }),
            ),
          ],
          [homeButton()],
        ]),
      );
    } catch (dmErr) {
      logger.error({ err: dmErr, userId }, 'invite delivery failure: buyer DM failed');
    }
    const adminChat = featureConfig().adminNotificationsChat;
    if (adminChat) {
      try {
        const u = await db('users').where('id', userId).first('username');
        const who = escapeHtml(u?.username ? `@${u.username}` : `id:${userId}`);
        const reason = escapeHtml(err instanceof Error ? err.message : String(err));
        await telegram.sendMessage(
          adminChat,
          `⚠️ <b>Ключ не доставлен</b>\nГоблин ${who} оплатил ${period}/${types.join('+')}, доступ записан, но выдать ключ не вышло: ${reason}`,
          { parse_mode: 'HTML' },
        );
      } catch (alertErr) {
        logger.error({ err: alertErr, userId }, 'invite delivery failure: admin alert failed');
      }
    }
  }
}
