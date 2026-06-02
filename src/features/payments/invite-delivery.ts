import { Markup, type Telegram } from 'telegraf';

import { logger } from '../../core/observability';
import { db } from '../../db/client';
import { escapeHtml } from '../../shared/format';
import { service as invitationsService } from '../invitations/service';
import { listUserSubscriptions } from '../subscriptions/repo';

const ADMIN_NOTIFICATIONS_CHAT = process.env.ADMIN_NOTIFICATIONS_CHAT ?? '';

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
        '🌑 Звёзды твои в казне, доступ за тобой записан — а вот дверь библиотекарь ещё не отпер. Добыча в целости, никуда не денется. Загляни позже через /start и жми кнопку, или жди — ключ придёт.',
      );
      if (ADMIN_NOTIFICATIONS_CHAT) {
        const u = await db('users').where('id', userId).first('username');
        const who = escapeHtml(u?.username ? `@${u.username}` : `id:${userId}`);
        await telegram.sendMessage(
          ADMIN_NOTIFICATIONS_CHAT,
          `⚠️ <b>Архив без двери</b>\nСвой ${who} оплатил ${period}/${type}, но чат месяца не привязан — ключ выдать некуда. Привяжи группу через /admin → Months.`,
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
          `🔥 Ну всё, ты теперь свой. Логово тебя приняло.\nВнизу два ключа — каждый пускает только тебя и только раз.\nОдин — в главный зал логова, где собираются все. Второй — в месячный архив за ${period}, что ты взял.`,
          Markup.inlineKeyboard([
            [Markup.button.url('🏰 Войти в логово', main.link)],
            [Markup.button.url('🔑 Открыть архив ключом', result.link)],
          ]),
        );
        return;
      }
      logger.warn({ userId }, 'first paid period but MAIN_GROUP_ID unset — archive key only');
    }

    await telegram.sendMessage(
      userId,
      '🔑 Готово, свой. Твой личный ключ к месячному архиву — на кнопке ниже. Пустит только тебя и только раз. Не зевай.',
      Markup.inlineKeyboard([[Markup.button.url('🔑 Открыть архив ключом', result.link)]]),
    );
  } catch (err) {
    logger.error({ err, userId, period, type }, 'invite key delivery failed');
  }
}
