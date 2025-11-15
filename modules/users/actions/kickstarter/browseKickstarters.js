const { Composer, Markup } = require("telegraf");
const { getKickstarters, getUser } = require('../../../db/helpers');

module.exports = Composer.action('browseKickstarters', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    const userData = await getUser(userId);
    
    if (!userData) {
      await ctx.editMessageText('❌ <b>Пользователь не найден</b>', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'userKickstarters')]
        ])
      });
      return;
    }

    const kickstartersData = await getKickstarters();
    const purchasedKickstarters = userData.purchases.kickstarters || [];
    
    // Get all kickstarters that user doesn't have
    const availableKickstarters = Object.keys(kickstartersData.list)
      .filter(ksId => !purchasedKickstarters.includes(ksId))
      .map(ksId => ({
        id: ksId,
        ...kickstartersData.list[ksId]
      }))
      .sort((a, b) => b.id - a.id); // Sort by ID descending (newest first)

    if (availableKickstarters.length === 0) {
      await ctx.editMessageText(
        '🔍 <b>Доступные кикстартеры</b>\n\n' +
        'Нет доступных кикстартеров для покупки.\n\n' +
        'Все проекты уже в твоей коллекции!',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📚 Мои кикстартеры', 'myKickstarters')],
            [Markup.button.callback('🔙 Назад', 'userKickstarters')]
          ])
        }
      );
      return;
    }

    let message = `🔍 <b>Доступные кикстартеры</b>\n\n`;
    message += `Найдено проектов: <b>${availableKickstarters.length}</b>\n\n`;
    
    const buttons = [];
    const maxDisplay = 10; // Limit to prevent message overflow
    
    availableKickstarters.slice(0, maxDisplay).forEach((ks, index) => {
      message += `${index + 1}. <b>${ks.name}</b>\n   Автор: ${ks.creator}\n   Цена: ${ks.cost}⭐\n\n`;
      buttons.push([
        Markup.button.callback(
          `${index + 1}. ${ks.name} - ${ks.cost}⭐`,
          `purchaseKickstarter_${ks.id}`
        )
      ]);
    });

    if (availableKickstarters.length > maxDisplay) {
      message += `\n<i>Показано ${maxDisplay} из ${availableKickstarters.length}. Выбери проект для покупки:</i>`;
    } else {
      message += `\n<i>Выбери проект для покупки:</i>`;
    }

    buttons.push([
      Markup.button.callback('📚 Мои кикстартеры', 'myKickstarters'),
      Markup.button.callback('🔙 Назад', 'userKickstarters')
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Error in browseKickstarters:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'userKickstarters')]
      ])
    });
  }
});

