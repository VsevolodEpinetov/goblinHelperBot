const notifications = require('../../configs/notifications');
const { getUser } = require('../db/helpers');

/**
 * Send XP gain notification to main group RPG topic
 * @param {number} userId - User ID who gained XP
 * @param {number} xpGained - Amount of XP gained
 * @param {string} source - Source of XP (e.g., 'spending_payment', 'raid_complete')
 * @param {Object} metadata - Additional metadata about the XP gain
 */
async function sendXpGainNotification(userId, xpGained, source, metadata = {}) {
  try {
    // Check if notifications are configured
    if (!notifications.rpgTopicId || !notifications.mainGroupId) {
      console.log('⚠️ XP notification skipped - RPG topic or main group not configured');
      return;
    }

    // Get user data for notification
    const userData = await getUser(Number(userId));
    if (!userData) {
      console.log('⚠️ XP notification skipped - user not found:', userId);
      return;
    }

    // Format username
    const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;

    // Create source-specific messages
    let sourceMessage = '';
    let emoji = '⭐';
    
    switch (source) {
      case 'spending_payment':
        if (metadata.subscriptionType === 'plus') {
          sourceMessage = '💎 Плюс подписка';
          emoji = '💎';
        } else if (metadata.subscriptionType === 'regular') {
          sourceMessage = '📦 Обычная подписка';
          emoji = '📦';
        } else if (metadata.old_month) {
          sourceMessage = '📜 Доступ к старому месяцу';
          emoji = '📜';
        } else {
          sourceMessage = '💰 Платеж';
          emoji = '💰';
        }
        break;
      case 'raid_create':
        sourceMessage = '⚔️ Создание рейда';
        emoji = '⚔️';
        break;
      case 'raid_complete':
        sourceMessage = '🏆 Участие в рейде';
        emoji = '🏆';
        break;
      case 'admin_grant':
        sourceMessage = '🎁 Админ награда';
        emoji = '🎁';
        break;
      case 'admin_payment_confirm':
        if (metadata.subscriptionType === 'plus') {
          sourceMessage = '💎 Подтверждение плюс подписки (админ)';
          emoji = '💎';
        } else if (metadata.subscriptionType === 'regular') {
          sourceMessage = '📦 Подтверждение обычной подписки (админ)';
          emoji = '📦';
        } else {
          sourceMessage = '✅ Подтверждение платежа (админ)';
          emoji = '✅';
        }
        break;
      case 'admin_kickstarter_confirm':
        sourceMessage = '🚀 Подтверждение кикстартера (админ)';
        emoji = '🚀';
        break;
      default:
        sourceMessage = '⭐ Получение опыта';
        emoji = '⭐';
    }

    // Add period info if available
    if (metadata.period) {
      sourceMessage += ` (${metadata.period})`;
    }

    // Add discount info if available
    if (metadata.discountApplied) {
      sourceMessage += ' 🏆';
    }

    // Create notification message
    const notificationMessage = 
      `${emoji} <b>Получен опыт!</b>\n\n` +
      `👤 <b>Пользователь:</b> ${username}\n` +
      `📈 <b>Источник:</b> ${sourceMessage}\n` +
      `⭐ <b>Опыт:</b> +${xpGained} XP\n\n` +
      `🕯 Главгоблин отмечает твою активность!`;

    // Send notification to main group RPG topic
    await globalThis.__bot?.telegram.sendMessage(
      notifications.mainGroupId,
      notificationMessage,
      { 
        parse_mode: 'HTML',
        message_thread_id: notifications.rpgTopicId
      }
    );

    console.log(`📢 XP notification sent: ${username} gained ${xpGained} XP from ${source}`);

  } catch (error) {
    console.error('❌ Failed to send XP gain notification:', error);
  }
}

/**
 * Send XP gain notification for level up (separate from regular XP notifications)
 * This is already implemented in xpService.js, but we can use this for consistency
 */
async function sendLevelUpNotification(userId, tier, level, tierInfo) {
  try {
    if (!notifications.rpgTopicId || !notifications.mainGroupId) {
      return;
    }

    const userData = await getUser(Number(userId));
    if (!userData) return;

    const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;
    
    const levelUpMessage = 
      `⬆️ <b>Новый уровень!</b>\n\n` +
      `${username} достиг нового уровня:\n\n` +
      `🎖️ <b>${tierInfo.name} ${level}</b>\n` +
      `${tierInfo.description}\n\n` +
      `🕯 Главгоблин гордится твоими успехами!`;

    await globalThis.__bot?.telegram.sendMessage(
      notifications.mainGroupId,
      levelUpMessage, 
      { 
        parse_mode: 'HTML',
        message_thread_id: notifications.rpgTopicId
      }
    );

    console.log(`🎉 Level up notification sent: ${username} reached ${tierInfo.name} ${level}`);

  } catch (error) {
    console.error('❌ Failed to send level up notification:', error);
  }
}

module.exports = {
  sendXpGainNotification,
  sendLevelUpNotification
};
