const { Composer, Markup } = require("telegraf");
const { getKickstarters, getUser } = require('../../../db/helpers');
const util = require('../../../util');

module.exports = Composer.action('myKickstarters', async (ctx) => {
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

    if (purchasedKickstarters.length === 0) {
      await ctx.editMessageText(
        '📚 <b>Мои кикстартеры</b>\n\n' +
        'У тебя пока нет купленных кикстартеров.\n\n' +
        'Используй кнопку "🔍 Найти новые" чтобы найти доступные проекты.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔍 Найти новые', 'browseKickstarters')],
            [Markup.button.callback('🔙 Назад', 'userKickstarters')]
          ])
        }
      );
      return;
    }

    let message = `📚 <b>Мои кикстартеры</b>\n\n`;
    message += `Всего куплено: <b>${purchasedKickstarters.length}</b>\n\n`;
    
    const buttons = [];
    const maxButtons = 10; // Limit to prevent message overflow
    
    purchasedKickstarters.slice(0, maxButtons).forEach((ksId, index) => {
      const ks = kickstartersData.list[ksId];
      if (ks) {
        message += `${index + 1}. <b>${ks.name}</b>\n   Автор: ${ks.creator}\n\n`;
        buttons.push([
          Markup.button.callback(
            `${index + 1}. ${ks.name}`,
            `showKickstarterFromGoblin_${ksId}`
          )
        ]);
      }
    });

    if (purchasedKickstarters.length > maxButtons) {
      message += `\n<i>Показано ${maxButtons} из ${purchasedKickstarters.length}. Выбери кикстартер для получения файлов:</i>`;
    } else {
      message += `\n<i>Выбери кикстартер для получения файлов:</i>`;
    }

    buttons.push([
      Markup.button.callback('🔍 Найти новые', 'browseKickstarters'),
      Markup.button.callback('🔙 Назад', 'userKickstarters')
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('Error in myKickstarters:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'userKickstarters')]
      ])
    });
  }
});

