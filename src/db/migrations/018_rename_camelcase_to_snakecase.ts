import type { Knex } from 'knex';

/**
 * Migration 018 — Rename every camelCase identifier to snake_case.
 *
 * This is the riskiest migration in the rewrite: it renames ~14 tables
 * and dozens of columns. Every step is guarded by `hasTable` / `hasColumn`
 * so the migration is idempotent and safe to re-run.
 *
 * The full manifest is built from:
 *   - src/db/migrations/legacy/*.js (every column declared by a tracked migration)
 *   - src/db/migrations/017_create_retroactive_tables.ts (retroactive tables)
 *   - modules/db/helpers.js (the canonical reference for columns on
 *     `userPurchases`, `userRoles`, `userGroups`, `userKickstarters` —
 *     tables that predate the migrations directory)
 *
 * Already-snake_case tables intentionally NOT touched here:
 *   user_levels, xp_transactions, user_achievements, level_management_log,
 *   promo_files, user_promo_usage, polls_core_studios, polls_studios,
 *   raids, raid_photos, raid_participants, lots, lot_*, settings,
 *   user_preferences, user_favorites.
 *
 * `userLoyalty` is intentionally NOT renamed here — migration 021 drops it.
 */

interface TableRename {
  /** Old table name (camelCase). Omit if only column renames. */
  oldTable?: string;
  /** New table name (snake_case). Omit if only column renames. */
  newTable?: string;
  /** Column renames within the (post-rename) table. */
  columns: Record<string, string>;
}

/**
 * `key` is the OLD table name (or current name if no table rename).
 * Iteration order is insertion order, which matters for the
 * symmetric down-migration: we reverse it.
 */
const RENAMES: Record<string, TableRename> = {
  // ── Tables that keep their name, only camelCase columns to rename ──────

  users: {
    columns: {
      firstName: 'first_name',
      lastName: 'last_name',
      createdAt: 'created_at',
    },
  },

  months: {
    columns: {
      chatId: 'chat_id',
      counterJoined: 'counter_joined',
      counterPaid: 'counter_paid',
      createdAt: 'created_at',
    },
  },

  applications: {
    columns: {
      userId: 'user_id',
      firstName: 'first_name',
      lastName: 'last_name',
      invitationCode: 'invitation_code',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  kickstarters: {
    columns: {
      pledgeName: 'pledge_name',
      pledgeCost: 'pledge_cost',
      createdAt: 'created_at',
    },
  },

  // ── Tables to rename + column renames ──────────────────────────────────

  userPurchases: {
    oldTable: 'userPurchases',
    newTable: 'user_purchases',
    columns: {
      userId: 'user_id',
    },
  },

  userRoles: {
    oldTable: 'userRoles',
    newTable: 'user_roles',
    columns: {
      userId: 'user_id',
    },
  },

  userGroups: {
    oldTable: 'userGroups',
    newTable: 'user_groups',
    columns: {
      userId: 'user_id',
    },
  },

  userKickstarters: {
    oldTable: 'userKickstarters',
    newTable: 'user_kickstarters',
    columns: {
      userId: 'user_id',
      kickstarterId: 'kickstarter_id',
    },
  },

  paymentTracking: {
    oldTable: 'paymentTracking',
    newTable: 'payment_tracking',
    columns: {
      userId: 'user_id',
      subscriptionType: 'subscription_type',
      invoiceMessageId: 'invoice_message_id',
      telegramPaymentChargeId: 'telegram_payment_charge_id',
      isUpgrade: 'is_upgrade',
      createdAt: 'created_at',
      completedAt: 'completed_at',
    },
  },

  invitationLinks: {
    oldTable: 'invitationLinks',
    newTable: 'invitation_links',
    columns: {
      userId: 'user_id',
      groupPeriod: 'group_period',
      groupType: 'group_type',
      telegramInviteLink: 'telegram_invite_link',
      telegramInviteLinkName: 'telegram_invite_link_name',
      telegramInviteLinkCreatorId: 'telegram_invite_link_creator_id',
      telegramInviteLinkIsPrimary: 'telegram_invite_link_is_primary',
      telegramInviteLinkIsRevoked: 'telegram_invite_link_is_revoked',
      telegramInviteLinkExpireDate: 'telegram_invite_link_expire_date',
      telegramInviteLinkMemberLimit: 'telegram_invite_link_member_limit',
      createsJoinRequest: 'creates_join_request',
      useCount: 'use_count',
      usedAt: 'used_at',
      createdAt: 'created_at',
    },
  },

  kickstarterPromoMessages: {
    oldTable: 'kickstarterPromoMessages',
    newTable: 'kickstarter_promo_messages',
    columns: {
      kickstarterId: 'kickstarter_id',
      messageId: 'message_id',
      chatId: 'chat_id',
      topicId: 'topic_id',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  userScrolls: {
    oldTable: 'userScrolls',
    newTable: 'user_scrolls',
    columns: {
      userId: 'user_id',
      scrollId: 'scroll_id',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  scrollLogs: {
    oldTable: 'scrollLogs',
    newTable: 'scroll_logs',
    columns: {
      userId: 'user_id',
      scrollId: 'scroll_id',
      createdAt: 'created_at',
    },
  },

  kickstarterPhotos: {
    oldTable: 'kickstarterPhotos',
    newTable: 'kickstarter_photos',
    columns: {
      kickstarterId: 'kickstarter_id',
      fileId: 'file_id',
    },
  },

  kickstarterFiles: {
    oldTable: 'kickstarterFiles',
    newTable: 'kickstarter_files',
    columns: {
      kickstarterId: 'kickstarter_id',
      fileId: 'file_id',
    },
  },
};

async function renameTableIfExists(knex: Knex, oldName: string, newName: string): Promise<void> {
  if (await knex.schema.hasTable(oldName)) {
    await knex.schema.renameTable(oldName, newName);
  }
}

async function renameColumnIfExists(
  knex: Knex,
  tableName: string,
  oldCol: string,
  newCol: string,
): Promise<void> {
  if (!(await knex.schema.hasTable(tableName))) return;
  if (await knex.schema.hasColumn(tableName, oldCol)) {
    await knex.schema.alterTable(tableName, (t) => t.renameColumn(oldCol, newCol));
  }
}

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    for (const [originalKey, rename] of Object.entries(RENAMES)) {
      if (rename.oldTable && rename.newTable) {
        await renameTableIfExists(trx, rename.oldTable, rename.newTable);
      }
      const finalTable = rename.newTable ?? originalKey;
      for (const [oldCol, newCol] of Object.entries(rename.columns)) {
        await renameColumnIfExists(trx, finalTable, oldCol, newCol);
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const entries = Object.entries(RENAMES).reverse();
    for (const [originalKey, rename] of entries) {
      const currentTable = rename.newTable ?? originalKey;
      for (const [oldCol, newCol] of Object.entries(rename.columns)) {
        await renameColumnIfExists(trx, currentTable, newCol, oldCol);
      }
      if (rename.oldTable && rename.newTable) {
        await renameTableIfExists(trx, rename.newTable, rename.oldTable);
      }
    }
  });
}
