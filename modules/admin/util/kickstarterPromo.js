const { Markup } = require('telegraf');
const { saveKickstarterPromoMessage } = require('../../../db/helpers');

/**
 * Send kickstarter promo message to main group topic
 * @param {Object} ctx - Telegraf context
 * @param {Object} kickstarterData - Kickstarter data
 * @param {number} kickstarterId - Kickstarter ID
 * @returns {Promise<Object>} - { success: boolean, messageId?: number, error?: string }
 */
async function sendKickstarterPromo(ctx, kickstarterData, kickstarterId) {
  try {
    const mainGroupId = process.env.MAIN_GROUP_ID;
    const kickstartersTopicId = process.env.KICKSTARTERS_TOPIC_ID;

    if (!mainGroupId) {
      return { success: false, error: 'MAIN_GROUP_ID not configured' };
    }

    // Build message
    let message = `<b>🚀 Новый кикстартер!</b>\n\n`;
    message += `<b>Название:</b> ${kickstarterData.name}\n`;
    message += `<b>Автор:</b> ${kickstarterData.creator}\n`;
    if (kickstarterData.pledgeName) {
      message += `<b>Пледж:</b> ${kickstarterData.pledgeName}\n`;
    }
    if (kickstarterData.pledgeCost) {
      message += `<b>Оригинальная стоимость:</b> $${kickstarterData.pledgeCost}\n`;
    }
    message += `\n<b>Стоимость:</b> ${kickstarterData.cost} ⭐\n`;
    if (kickstarterData.link) {
      message += `\n${kickstarterData.link}`;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Провести ритуал', `purchaseKickstarter_${kickstarterId}`)]
    ]);

    // Send message
    let sentMessage;
    if (kickstarterData.photos && kickstarterData.photos.length > 0) {
      // Send with first photo
      sentMessage = await ctx.telegram.sendPhoto(
        mainGroupId,
        kickstarterData.photos[0],
        {
          caption: message,
          parse_mode: 'HTML',
          message_thread_id: kickstartersTopicId ? parseInt(kickstartersTopicId) : undefined,
          ...keyboard
        }
      );
    } else {
      // Send as text message
      sentMessage = await ctx.telegram.sendMessage(
        mainGroupId,
        message,
        {
          parse_mode: 'HTML',
          message_thread_id: kickstartersTopicId ? parseInt(kickstartersTopicId) : undefined,
          ...keyboard
        }
      );
    }

    // Save message info
    await saveKickstarterPromoMessage(
      kickstarterId,
      sentMessage.message_id,
      mainGroupId,
      kickstartersTopicId ? parseInt(kickstartersTopicId) : null
    );

    return { success: true, messageId: sentMessage.message_id };
  } catch (error) {
    console.error('Error sending kickstarter promo:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendKickstarterPromo
};

