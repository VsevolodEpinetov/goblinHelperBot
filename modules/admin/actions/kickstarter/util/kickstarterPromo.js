const { Markup } = require('telegraf');
const knex = require('../../../../db/knex');

/**
 * Send kickstarter promo message to main group topic
 * @param {Object} ctx - Telegraf context
 * @param {Object} kickstarterData - Kickstarter data object
 * @param {number} kickstarterId - Kickstarter ID
 * @returns {Promise<Object>} - { success: boolean, error?: string, messageId?: number }
 */
async function sendKickstarterPromo(ctx, kickstarterData, kickstarterId) {
  try {
    const mainGroupId = process.env.MAIN_GROUP_ID;
    const kickstartersTopicId = process.env.KICKSTARTERS_TOPIC_ID;

    if (!mainGroupId || !kickstartersTopicId) {
      return {
        success: false,
        error: 'MAIN_GROUP_ID or KICKSTARTERS_TOPIC_ID not configured'
      };
    }

// Build promo message
let message = `😈 <b>Новая сделка с демоном доступна</b>\n\n`;
message += `<b>${kickstarterData.name}</b>\n`;
message += `Источник силы: <b>${kickstarterData.creator}</b>\n`;

if (kickstarterData.pledgeName) {
  message += `Форма дара: <b>${kickstarterData.pledgeName}</b>\n`;
}

message += `\n💰 Цена сделки: <b>${kickstarterData.cost}⭐</b>\n`;
message += `Для ритуала понадобится свиток подходящего Круга или оплата услуг Чернокнижника.\n`;

if (kickstarterData.link) {
  message += `\n🔗 <a href="${kickstarterData.link}">Посмотреть описание проекта</a>`;
}

message += `\n\nЧернокнижник готов к переговорам. Решайся сам, смертный.`;



    // Create keyboard with purchase button
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🛒 Купить', `purchaseKickstarter_${kickstarterId}`)]
    ]);

    // Send message to topic
    const sentMessage = await ctx.telegram.sendMessage(
      mainGroupId,
      message,
      {
        parse_mode: 'HTML',
        message_thread_id: parseInt(kickstartersTopicId),
        reply_markup: keyboard.reply_markup
      }
    );

    // Store message info in database
    await knex('kickstarterPromoMessages').insert({
      kickstarterId: kickstarterId,
      messageId: sentMessage.message_id,
      chatId: mainGroupId,
      topicId: parseInt(kickstartersTopicId),
      createdAt: knex.fn.now(),
      updatedAt: knex.fn.now()
    });

    return {
      success: true,
      messageId: sentMessage.message_id
    };
  } catch (error) {
    console.error('Error sending kickstarter promo:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendKickstarterPromo
};

