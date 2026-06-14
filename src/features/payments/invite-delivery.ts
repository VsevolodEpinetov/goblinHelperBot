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

/**
 * After a granted group payment — Stars OR SBP — DM the buyer their personal
 * one-time archive key (plus the main-group key on their first paid period).
 * Best-effort: catches everything so it never breaks the payment/confirm flow.
 */
export async function deliverAccessKeys(opts: {
  telegram: Telegram;
  userId: number;
  period: string;
  type: 'regular' | 'plus';
}): Promise<void> {
  const { telegram, userId, period, type } = opts;
  try {
    const result = await invitationsService.getOrCreateInvitationLink({ userId, period, type });

    if (result.status === 'no_chat') {
      await telegram.sendMessage(
        userId,
        '🌑 Плата в казне, доступ за тобой записан — а дверь в этот архив библиотекарь ещё не отпер. Загляни позже через меню или жди: ключ сам придёт.',
        Markup.inlineKeyboard([[homeButton()]]),
      );
      const adminChat = featureConfig().adminNotificationsChat;
      if (adminChat) {
        const u = await db('users').where('id', userId).first('username');
        const who = escapeHtml(u?.username ? `@${u.username}` : `id:${userId}`);
        await telegram.sendMessage(
          adminChat,
          `⚠️ <b>Архив без двери</b>\nГоблин ${who} оплатил ${period}/${type}, но чат месяца не привязан — ключ выдать некуда. Привяжи группу через /admin → Months.`,
          { parse_mode: 'HTML' },
        );
      }
      return;
    }

    if (await isFirstPaidPeriod(userId)) {
      const main = await invitationsService.createMainGroupLink(userId);
      if (main.status === 'created') {
        await telegram.sendMessage(
          userId,
          `🔥 Ну всё, ты теперь свой. Логово тебя приняло.\nВнизу два ключа — каждый пускает только тебя и только один раз.\nПервый — в главный зал, где собираются все. Второй — в месячный архив за ${period}, что ты взял.`,
          Markup.inlineKeyboard([
            [Markup.button.url('🏰 Войти в логово', main.link)],
            [Markup.button.url('🔑 Открыть архив ключом', result.link)],
            [homeButton()],
          ]),
        );
        return;
      }
      logger.warn({ userId }, 'first paid period but MAIN_GROUP_ID unset — archive key only');
    }

    await telegram.sendMessage(
      userId,
      '🔑 Готово, гоблин. Твой личный ключ от месячного архива — на кнопке ниже. Пустит только тебя и только раз — не зевай.',
      Markup.inlineKeyboard([
        [Markup.button.url('🔑 Открыть архив ключом', result.link)],
        [homeButton()],
      ]),
    );
  } catch (err) {
    logger.error({ err, userId, period, type }, 'invite key delivery failed');
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
          `⚠️ <b>Ключ не доставлен</b>\nГоблин ${who} оплатил ${period}/${type}, доступ записан, но выдать ключ не вышло: ${reason}`,
          { parse_mode: 'HTML' },
        );
      } catch (alertErr) {
        logger.error({ err: alertErr, userId }, 'invite delivery failure: admin alert failed');
      }
    }
  }
}
