// Message XP middleware: grants XP for chat activity with basic cooldown
const { grantXpFromMessage } = require('../loyalty/rpgUtils');
const rpgConfig = require('../../configs/rpg');

// Simple in-memory cooldown map: userId -> timestamp (ms)
const lastXpByUserId = new Map();

module.exports = async function messageXpMiddleware(ctx, next) {
  try {
    const message = ctx.message;
    const chat = ctx.chat;

    // Only process text messages in non-private chats
    if (!message?.text || !chat || chat.type === 'private') {
      return next();
    }

    const config = rpgConfig.xpSources?.messages;
    if (!config || !config.enabled) {
      return next();
    }

    const userId = ctx.from?.id;
    const groupId = chat.id;
    if (!userId) {
      return next();
    }

    // Basic in-memory cooldown safeguard (does not persist across restarts)
    const cooldownMinutes = config.cooldownMinutes || 1;
    const now = Date.now();
    const last = lastXpByUserId.get(userId) || 0;
    const cooldownMs = cooldownMinutes * 60 * 1000;

    if (now - last < cooldownMs) {
      // Within cooldown window: skip XP grant
      return next();
    }

    // Update last grant time
    lastXpByUserId.set(userId, now);

    // Delegate detailed checks (allowedGroupIds, limits in future) to grantXpFromMessage
    await grantXpFromMessage(userId, groupId, {
      messageText: message.text.substring(0, 100),
      chatTitle: chat.title
    }).catch(error => {
      console.error('[RPG] Message XP error:', error);
    });

    return next();
  } catch (error) {
    console.error('[RPG] Message XP middleware error:', error);
    return next();
  }
}


