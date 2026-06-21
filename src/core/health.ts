import type { Telegram } from 'telegraf';

import type { FeatureConfig } from './config';
import { logger } from './observability';

export interface HealthCheck {
  name: string;
  /** 'ok' — probed and working; 'fail' — probed and broken; 'off' — not configured. */
  status: 'ok' | 'fail' | 'off';
  detail?: string;
}

function errText(err: unknown): string {
  return (
    (err as { description?: string }).description ??
    (err instanceof Error ? err.message : String(err))
  );
}

/** Probe one topic by sending a typing action into it — the cheapest call that
 * fails when the thread does not exist in the group. */
async function probeTopic(
  telegram: Telegram,
  name: string,
  groupId: string,
  topicId: number | undefined,
): Promise<HealthCheck> {
  if (!topicId) return { name, status: 'off', detail: 'not set (posts go to General)' };
  try {
    await telegram.sendChatAction(groupId, 'typing', { message_thread_id: topicId });
    return { name, status: 'ok', detail: `topic ${topicId}` };
  } catch (err) {
    return { name, status: 'fail', detail: `topic ${topicId}: ${errText(err)}` };
  }
}

/**
 * Actively verify the env-configured chats/topics against the live Telegram
 * API: groups reachable, the bot an admin where it must moderate, topics real.
 * Static validation can't catch a rotated group id — this does.
 */
export async function runConfigHealthChecks(
  telegram: Telegram,
  fc: FeatureConfig,
  botId: number,
): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  if (!fc.mainGroupId) {
    checks.push({ name: 'main group', status: 'off', detail: 'MAIN_GROUP_ID not set' });
  } else {
    try {
      const chat = await telegram.getChat(fc.mainGroupId);
      const title = 'title' in chat ? chat.title : fc.mainGroupId;
      checks.push({ name: 'main group', status: 'ok', detail: `«${title}» (${fc.mainGroupId})` });

      // The bot must be an admin there: it deletes/reposts raid cards, approves
      // join requests, and (without admin) would not even SEE plain messages —
      // which silently kills message XP.
      try {
        const me = await telegram.getChatMember(fc.mainGroupId, botId);
        const isAdmin = me.status === 'administrator' || me.status === 'creator';
        checks.push(
          isAdmin
            ? { name: 'bot is group admin', status: 'ok', detail: me.status }
            : {
                name: 'bot is group admin',
                status: 'fail',
                detail: `status=${me.status} — message XP and raid cards will not work`,
              },
        );
      } catch (err) {
        checks.push({ name: 'bot is group admin', status: 'fail', detail: errText(err) });
      }

      checks.push(await probeTopic(telegram, 'raids topic', fc.mainGroupId, fc.raidsTopicId));
      checks.push(
        await probeTopic(telegram, 'kickstarters topic', fc.mainGroupId, fc.kickstartersTopicId),
      );
      checks.push(await probeTopic(telegram, 'RPG topic', fc.mainGroupId, fc.rpgTopicId));
      checks.push(await probeTopic(telegram, 'polls topic', fc.mainGroupId, fc.pollsTopicId));
    } catch (err) {
      checks.push({
        name: 'main group',
        status: 'fail',
        detail: `${fc.mainGroupId}: ${errText(err)}`,
      });
    }
  }

  if (!fc.adminNotificationsChat) {
    checks.push({
      name: 'admin chat',
      status: 'off',
      detail: 'ADMIN_NOTIFICATIONS_CHAT not set — applications will NOT reach the council',
    });
  } else {
    try {
      const chat = await telegram.getChat(fc.adminNotificationsChat);
      const title = 'title' in chat ? chat.title : fc.adminNotificationsChat;
      checks.push({
        name: 'admin chat',
        status: 'ok',
        detail: `«${title}» (${fc.adminNotificationsChat})`,
      });
    } catch (err) {
      checks.push({
        name: 'admin chat',
        status: 'fail',
        detail: `${fc.adminNotificationsChat}: ${errText(err)}`,
      });
    }
  }

  return checks;
}

const STATUS_MARK: Record<HealthCheck['status'], string> = { ok: '✅', fail: '❌', off: '➖' };

export function formatHealthChecks(checks: HealthCheck[]): string[] {
  return checks.map((c) => `${STATUS_MARK[c.status]} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}

/**
 * Boot-time wiring: run the probes, log everything, and if something is broken
 * push the failures into the admin chat (when that chat itself is alive) so
 * misconfiguration is impossible to miss without reading server logs.
 */
export async function reportConfigHealthOnBoot(
  telegram: Telegram,
  fc: FeatureConfig,
  botId: number,
): Promise<void> {
  let checks: HealthCheck[];
  try {
    checks = await runConfigHealthChecks(telegram, fc, botId);
  } catch (err) {
    logger.error({ err }, 'config health checks failed to run');
    return;
  }
  for (const c of checks) {
    const line = `config check: ${c.name} — ${c.status}${c.detail ? ` (${c.detail})` : ''}`;
    if (c.status === 'fail') logger.error(line);
    else logger.info(line);
  }
  const failed = checks.filter((c) => c.status === 'fail');
  if (failed.length === 0) return;
  const adminChatOk = checks.some((c) => c.name === 'admin chat' && c.status === 'ok');
  if (!fc.adminNotificationsChat || !adminChatOk) return;
  try {
    await telegram.sendMessage(
      fc.adminNotificationsChat,
      [
        '🔥 Тревога, совет! Логово проснулось, но не все ходы целы — вот что сломано:',
        '',
        ...formatHealthChecks(failed),
      ].join('\n'),
    );
  } catch (err) {
    logger.error({ err }, 'config health alert: admin chat send failed');
  }
}
