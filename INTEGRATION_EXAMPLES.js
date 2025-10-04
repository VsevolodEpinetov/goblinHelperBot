/**
 * INTEGRATION EXAMPLES - RPG System
 * 
 * This file contains practical examples of how to integrate the new RPG system
 * into your existing bot code. Copy/paste these examples into your actual files.
 */

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Payment Service Integration
// ═══════════════════════════════════════════════════════════════════════════

// File: modules/payments/subscriptionPaymentService.js

const { grantXpFromSubscription } = require('../loyalty/rpgUtils');

async function processSubscriptionPayment(ctx, paymentData) {
  const payload = JSON.parse(paymentData.invoice_payload);
  const { st: subscriptionType, u: userId, p: period } = payload;

  // ... existing payment processing logic ...

  // OLD WAY (remove this):
  // const { getSubscriptionBaseUnits, applyXpGain } = require('../loyalty/xpService');
  // const baseUnits = getSubscriptionBaseUnits(subscriptionType);
  // await applyXpGain(userId, baseUnits, 'spending_payment', { ... });

  // NEW WAY:
  try {
    const xpResult = await grantXpFromSubscription(userId, subscriptionType, {
      period,
      starsSpent: paymentData.total_amount,
      description: `${subscriptionType === 'plus' ? 'Плюс' : 'Обычная'} подписка`
    });

    if (xpResult.success && xpResult.leveledUp) {
      console.log(`🎉 User ${userId} leveled up to ${xpResult.newRank.emoji} ${xpResult.newRank.tierName} ${xpResult.newRank.level}!`);
    }
  } catch (xpErr) {
    console.error('⚠️ Failed to grant subscription XP (non-fatal):', xpErr);
  }

  // ... rest of your payment logic ...
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Admin Command - Grant XP
// ═══════════════════════════════════════════════════════════════════════════

// File: modules/admin/commands/grantXp.js

const { Composer } = require('telegraf');
const { grantXp } = require('../../loyalty/rpgUtils');

const composer = new Composer();

composer.command('grantxp', async (ctx) => {
  // Parse command: /grantxp @username 500 "Помощь с тестированием"
  const args = ctx.message.text.split(' ');
  
  if (args.length < 3) {
    await ctx.reply('Usage: /grantxp @username <amount> [reason]');
    return;
  }

  const targetUsername = args[1].replace('@', '');
  const amount = parseInt(args[2]);
  const reason = args.slice(3).join(' ') || 'Админ награда';

  // Get user ID from username
  const knex = require('../../db/knex');
  const targetUser = await knex('users').where('username', targetUsername).first();
  
  if (!targetUser) {
    await ctx.reply('❌ Пользователь не найден');
    return;
  }

  // Grant XP
  const result = await grantXp(targetUser.id, amount, 'admin_grant', {
    reason,
    grantedBy: ctx.from.id,
    grantedByUsername: ctx.from.username
  });

  if (result.success) {
    let message = `✅ Выдано ${amount} XP пользователю @${targetUsername}\n\n`;
    message += `Текущий уровень: ${result.newRank.emoji} ${result.newRank.tierName} ${result.newRank.level}\n`;
    message += `Всего XP: ${result.newTotalXp}`;
    
    if (result.leveledUp) {
      message += `\n\n🎉 Повышение уровня! ${result.oldRank.emoji} → ${result.newRank.emoji}`;
    }
    
    await ctx.reply(message);
  } else {
    await ctx.reply(`❌ Ошибка: ${result.error}`);
  }
});

module.exports = composer;

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: Raid System Integration
// ═══════════════════════════════════════════════════════════════════════════

// File: modules/raids/actions/handlers.js

const { grantXp } = require('../../loyalty/rpgUtils');
const rpgConfig = require('../../../configs/rpg');

async function handleRaidComplete(ctx, raidId) {
  // ... existing raid completion logic ...

  // Grant XP to all participants
  const participants = await getRaidParticipants(raidId);
  
  for (const participant of participants) {
    // Different XP for creator vs joiners
    const isCreator = participant.user_id === raid.created_by;
    const xpAmount = isCreator ? 
      rpgConfig.xpSources.raids.createRaid : 
      rpgConfig.xpSources.raids.joinRaid;

    await grantXp(participant.user_id, xpAmount, isCreator ? 'raid_create' : 'raid_join', {
      raidId,
      raidTitle: raid.title,
      description: `Рейд: ${raid.title}`
    });
  }

  // ... rest of completion logic ...
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Feature Gating by Rank
// ═══════════════════════════════════════════════════════════════════════════

// File: modules/polls/commands/create.js

const { hasRank } = require('../../loyalty/rpgUtils');

composer.command('createpoll', async (ctx) => {
  // Only Silver tier and above can create polls
  const canCreatePoll = await hasRank(ctx.from.id, 'silver');

  if (!canCreatePoll) {
    await ctx.reply(
      '❌ Создание опросов доступно с уровня 🥈 Серебряный.\n\n' +
      'Используйте /profile чтобы увидеть свой текущий уровень.'
    );
    return;
  }

  // ... continue with poll creation ...
});

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: Profile Command Update
// ═══════════════════════════════════════════════════════════════════════════

// File: modules/loyalty/commands/profile.js

const { getUserXpStats, getUserLeaderboardPosition } = require('../rpgUtils');

composer.command('profile', async (ctx) => {
  const userId = ctx.from.id;

  // Get full stats
  const stats = await getUserXpStats(userId);
  if (!stats) {
    await ctx.reply('❌ Профиль не найден');
    return;
  }

  // Get leaderboard position
  const position = await getUserLeaderboardPosition(userId);

  // Build message
  let message = `👤 <b>RPG Профиль</b>\n\n`;
  message += `🆔 ${ctx.from.first_name} ${ctx.from.last_name || ''}\n`;
  message += `🎖️ <b>Уровень:</b> ${stats.emoji} ${stats.tierName} ${stats.level}\n`;
  message += `⭐ <b>Опыт:</b> ${stats.totalXp.toLocaleString()} XP\n`;
  
  if (stats.xpToNextLevel) {
    message += `📈 <b>До след. уровня:</b> ${stats.xpToNextLevel} XP\n`;
  }
  
  if (position) {
    message += `🏆 <b>Позиция:</b> #${position} в рейтинге\n`;
  }
  
  message += `📊 <b>За неделю:</b> +${stats.weeklyXp} XP\n\n`;

  // Show benefits
  const tier = stats.tierData;
  if (tier.benefits && tier.benefits.length > 0) {
    message += `🎁 <b>Ваши преимущества:</b>\n`;
    tier.benefits.slice(0, 3).forEach(benefit => {
      message += `  • ${benefit}\n`;
    });
  }

  await ctx.replyWithHTML(message);
});

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Leaderboard Command
// ═══════════════════════════════════════════════════════════════════════════

// File: modules/loyalty/commands/leaderboard.js

const { getLeaderboard } = require('../rpgUtils');

composer.command('leaderboard', async (ctx) => {
  const topUsers = await getLeaderboard(10);

  if (topUsers.length === 0) {
    await ctx.reply('Рейтинг пуст');
    return;
  }

  let message = `🏆 <b>Топ-10 RPG рейтинга</b>\n\n`;

  topUsers.forEach((user, index) => {
    const position = index + 1;
    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
    const username = user.username ? `@${user.username}` : user.firstName;
    
    message += `${medal} ${user.emoji} <b>${username}</b>\n`;
    message += `   ${user.tierName} ${user.level} • ${user.totalXp.toLocaleString()} XP\n\n`;
  });

  await ctx.replyWithHTML(message);
});

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 7: Message Activity XP (Future Implementation)
// ═══════════════════════════════════════════════════════════════════════════

// File: modules/middleware/messageXp.js

const { grantXpFromMessage } = require('../loyalty/rpgUtils');
const rpgConfig = require('../../configs/rpg');

async function messageXpMiddleware(ctx, next) {
  // Only process text messages in groups
  if (!ctx.message?.text || ctx.chat.type === 'private') {
    return next();
  }

  // Check if message XP is enabled
  if (!rpgConfig.xpSources.messages.enabled) {
    return next();
  }

  // Grant XP (function handles cooldowns and limits internally)
  try {
    await grantXpFromMessage(ctx.from.id, ctx.chat.id, {
      messageText: ctx.message.text.substring(0, 100), // Store truncated for logging
      chatTitle: ctx.chat.title
    });
  } catch (error) {
    // Don't block message processing if XP grant fails
    console.error('[RPG] Message XP error:', error);
  }

  return next();
}

module.exports = messageXpMiddleware;

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 8: Admin Notification to RPG Topic
// ═══════════════════════════════════════════════════════════════════════════

// File: modules/admin/commands/announceEvent.js

const { sendRpgNotification } = require('../../loyalty/rpgUtils');

composer.command('rpgevent', async (ctx) => {
  // Only admins can send events
  const isAdmin = await checkAdmin(ctx.from.id);
  if (!isAdmin) return;

  const eventText = ctx.message.text.replace('/rpgevent', '').trim();
  
  if (!eventText) {
    await ctx.reply('Usage: /rpgevent <message>');
    return;
  }

  // Send to RPG topic
  const sent = await sendRpgNotification(
    `🎉 <b>Событие RPG!</b>\n\n${eventText}`,
    { disable_notification: false }
  );

  if (sent) {
    await ctx.reply('✅ Сообщение отправлено в RPG топик');
  } else {
    await ctx.reply('❌ Не удалось отправить (RPG топик не настроен)');
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 9: Testing/Validation Script
// ═══════════════════════════════════════════════════════════════════════════

// File: scripts/validate_rpg_system.js

const knex = require('../modules/db/knex');
const rpgConfig = require('../configs/rpg');
const { getUserRank } = require('../modules/loyalty/rpgUtils');

async function validateRpgSystem() {
  console.log('🔍 Validating RPG system...\n');

  // Get all users
  const users = await knex('user_levels').select('*');
  console.log(`Found ${users.length} users with XP data\n`);

  let driftCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      // Calculate what rank SHOULD be
      const calculated = rpgConfig.calculateRankFromXp(user.total_xp);

      // Check for drift
      if (calculated.tier !== user.current_tier || calculated.level !== user.current_level) {
        console.log(`❌ Drift detected: User ${user.user_id}`);
        console.log(`   Stored: ${user.current_tier} ${user.current_level}`);
        console.log(`   Calculated: ${calculated.tier} ${calculated.level}`);
        console.log(`   XP: ${user.total_xp}\n`);
        driftCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing user ${user.user_id}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total users: ${users.length}`);
  console.log(`Drift detected: ${driftCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Status: ${driftCount === 0 && errorCount === 0 ? '✅ PASS' : '⚠️ ISSUES FOUND'}`);
  
  if (driftCount > 0) {
    console.log('\n💡 Tip: Run getUserRank() for these users to auto-fix drift');
  }

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  validateRpgSystem().catch(console.error);
}

module.exports = { validateRpgSystem };

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 10: Migration Helper - Update Single User
// ═══════════════════════════════════════════════════════════════════════════

// File: scripts/fix_user_rank.js

const knex = require('../modules/db/knex');
const { getUserRank } = require('../modules/loyalty/rpgUtils');

async function fixUserRank(userId) {
  console.log(`🔧 Fixing rank for user ${userId}...`);

  const oldData = await knex('user_levels').where('user_id', userId).first();
  
  if (!oldData) {
    console.log('❌ User not found in user_levels table');
    return;
  }

  console.log(`Old: ${oldData.current_tier} ${oldData.current_level} (${oldData.total_xp} XP)`);

  // getUserRank will validate and auto-fix if needed
  const newRank = await getUserRank(userId);

  console.log(`New: ${newRank.tier} ${newRank.level} (${newRank.totalXp} XP)`);
  console.log('✅ Rank updated successfully');
}

// Usage: node scripts/fix_user_rank.js 123456
if (require.main === module) {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: node scripts/fix_user_rank.js <user_id>');
    process.exit(1);
  }
  fixUserRank(userId).then(() => process.exit(0)).catch(console.error);
}

module.exports = { fixUserRank };

