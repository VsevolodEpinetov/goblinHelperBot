const { Composer, Markup } = require("telegraf");
const { getKickstarter, getUser, hasUserPurchasedKickstarter, addUserKickstarter } = require('../../../db/helpers');
const { removeScrolls } = require('../../../util/scrolls');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^purchaseKickstarterWithScroll_(\d+)_(.+)$/, async (ctx) => {
  try {
    const kickstarterId = parseInt(ctx.match[1]);
    const scrollId = ctx.match[2];
    const userId = ctx.from.id;

    // Get kickstarter data
    const kickstarterData = await getKickstarter(kickstarterId);
    if (!kickstarterData) {
      await ctx.answerCbQuery('❌ Кикстартер не найден');
      return;
    }

    // Check if user already has this kickstarter
    const alreadyHas = await hasUserPurchasedKickstarter(userId, kickstarterId);
    if (alreadyHas) {
      await ctx.answerCbQuery('✅ У тебя уже есть доступ к этому кикстартеру');
      return;
    }

    // Remove scroll
    const scrollRemoved = await removeScrolls(userId, scrollId, 1, `Покупка кикстартера: ${kickstarterData.name}`);
    if (!scrollRemoved) {
      await ctx.answerCbQuery('❌ Не удалось использовать свиток');
      return;
    }

    // Grant kickstarter access
    await addUserKickstarter(userId, kickstarterId);

    // Send files to user
    if (kickstarterData.files && kickstarterData.files.length > 0) {
      await ctx.answerCbQuery('Отправляю файлы...');
      
      for (const fileId of kickstarterData.files) {
        try {
          await ctx.telegram.sendDocument(userId, fileId);
        } catch (error) {
          console.error(`Error sending file ${fileId}:`, error);
        }
      }
    }

    // Send confirmation message
    let message = `✅ <b>Покупка успешна!</b>\n\n`;
    message += `Ты получил доступ к кикстартеру:\n`;
    message += `<b>${kickstarterData.name}</b>\n`;
    message += `Автор: <b>${kickstarterData.creator}</b>\n\n`;
    
    if (kickstarterData.files && kickstarterData.files.length > 0) {
      message += `📁 Файлы отправлены выше`;
    } else {
      message += `📁 Файлы отсутствуют`;
    }

    await ctx.replyWithHTML(message, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📚 Мои кикстартеры', 'userKickstarters')],
        [Markup.button.callback('🏠 В начало', 'userMenu')]
      ])
    });

    // Log to admin
    await ctx.telegram.sendMessage(
      SETTINGS.CHATS.LOGS,
      `📜 Пользователь ${userId} купил кикстартер ${kickstarterId} (${kickstarterData.name}) используя свиток ${scrollId}`
    );
  } catch (error) {
    console.error('Error purchasing kickstarter with scroll:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});
