import { bot } from '../../core/bot';
import { featureConfig } from '../../core/config';
import { logger } from '../../core/observability';
import { db } from '../../db/client';
import { getMonthChatId } from '../subscriptions/repo';

import {
  findActiveLink as repoFindActive,
  insertInvitation as repoInsert,
  type GroupType,
} from './repo';

export interface TelegramClient {
  createChatInviteLink(
    chatId: string,
    opts: { name?: string; createsJoinRequest?: boolean; memberLimit?: number },
  ): Promise<{
    invite_link: string;
    creator: { id: number };
    creates_join_request: boolean;
    is_primary: boolean;
    is_revoked: boolean;
    expire_date?: number;
    member_limit?: number;
    name?: string;
  }>;
  revokeChatInviteLink(chatId: string, inviteLink: string): Promise<unknown>;
}

export interface ServiceDeps {
  client: TelegramClient;
  getMonthChatId: (period: string, type: GroupType) => Promise<string | null>;
  findActiveLink: typeof repoFindActive;
  insertInvitation: typeof repoInsert;
  /** Returns the main community group chat id (MAIN_GROUP_ID), or undefined if unset. */
  mainGroupId?: () => string | undefined;
}

export type MainGroupLinkResult = { status: 'created'; link: string } | { status: 'no_main_group' };

export type GetOrCreateResult =
  | { status: 'created'; link: string; rowId: number }
  | { status: 'existing'; link: string; rowId: number }
  | { status: 'no_chat' };

export interface Service {
  getOrCreateInvitationLink(input: {
    userId: number;
    period: string;
    type: GroupType;
  }): Promise<GetOrCreateResult>;
  revokeInvitationLink(input: { chatId: string; telegramInviteLink: string }): Promise<boolean>;
  /** Mint a one-time join-request link to the main community group. */
  createMainGroupLink(userId: number): Promise<MainGroupLinkResult>;
}

/** Factory; production code uses `service` below. */
export function makeService(deps: ServiceDeps): Service {
  return {
    async getOrCreateInvitationLink(input): Promise<GetOrCreateResult> {
      const chatId = await deps.getMonthChatId(input.period, input.type);
      if (!chatId) return { status: 'no_chat' };

      const existing = await deps.findActiveLink(db, input.userId, input.period, input.type);
      if (existing) {
        return { status: 'existing', link: existing.telegramInviteLink, rowId: existing.id };
      }

      try {
        const apiResult = await deps.client.createChatInviteLink(chatId, {
          name: `u${input.userId}_${input.period}_${input.type}`,
          createsJoinRequest: true,
        });
        const rowId = await deps.insertInvitation(db, {
          userId: input.userId,
          groupPeriod: input.period,
          groupType: input.type,
          telegramInviteLink: apiResult.invite_link,
          telegramMetadata: {
            creator_id: apiResult.creator.id,
            is_primary: apiResult.is_primary,
            is_revoked: apiResult.is_revoked,
            expire_date: apiResult.expire_date ?? null,
            member_limit: apiResult.member_limit ?? null,
            name: apiResult.name ?? null,
          },
          createsJoinRequest: apiResult.creates_join_request,
        });
        return { status: 'created', link: apiResult.invite_link, rowId };
      } catch (err) {
        logger.error({ err, input }, 'invitations: createChatInviteLink failed');
        throw err;
      }
    },

    async createMainGroupLink(userId): Promise<MainGroupLinkResult> {
      const chatId = deps.mainGroupId?.();
      if (!chatId) return { status: 'no_main_group' };
      const apiResult = await deps.client.createChatInviteLink(chatId, {
        name: `u${userId}_main`,
        createsJoinRequest: true,
      });
      return { status: 'created', link: apiResult.invite_link };
    },

    async revokeInvitationLink({ chatId, telegramInviteLink }): Promise<boolean> {
      try {
        await deps.client.revokeChatInviteLink(chatId, telegramInviteLink);
        return true;
      } catch (err) {
        logger.warn({ err, chatId, telegramInviteLink }, 'invitations: revoke failed (continuing)');
        return false;
      }
    },
  };
}

/** Production service bound to the real Telegram client + repos. */
export const service: Service = makeService({
  client: {
    async createChatInviteLink(chatId, opts) {
      const result = await bot.telegram.createChatInviteLink(chatId, {
        name: opts.name,
        creates_join_request: opts.createsJoinRequest,
        member_limit: opts.memberLimit,
      });
      return result as Awaited<ReturnType<TelegramClient['createChatInviteLink']>>;
    },
    async revokeChatInviteLink(chatId, inviteLink) {
      return bot.telegram.revokeChatInviteLink(chatId, inviteLink);
    },
  },
  getMonthChatId: (period, type) => getMonthChatId(db, period, type),
  findActiveLink: repoFindActive,
  insertInvitation: repoInsert,
  mainGroupId: () => featureConfig().mainGroupId,
});
