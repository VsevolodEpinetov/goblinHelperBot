const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');
const knex = require('../../../db/knex');

const searchKickstarterString = new Scenes.BaseScene('ADMIN_SCENE_SEARCH_KICKSTARTER');

searchKickstarterString.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const message = await ctx.replyWithHTML(
    `Пришли <b>строку</b> для поиска кикстартера.\n\n` +
    `<i>Поиск идёт по полям:\n` +
    `— Название пледжа\n` +
    `— Ссылка на проект\n` +
    `— Автор</i>`,
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'cancelKickstarterSearch')]
    ])
  );
  ctx.session.toRemove = message.message_id;
  ctx.session.chatID = message.chat.id;
});

searchKickstarterString.action('cancelKickstarterSearch', async (ctx) => {
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Поиск отменён');
});

searchKickstarterString.on('text', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const searchString = ctx.message.text.toLowerCase().trim();
  
  if (searchString.length < 2) {
    await ctx.reply('❌ Минимум 2 символа для поиска');
    return;
  }

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);

  try {
    // Search in database: pledgeName, link, creator
    const kickstarters = await knex('kickstarters')
      .select('id', 'name', 'creator', 'pledgeName', 'link')
      .where((builder) => {
        builder
          .whereRaw('LOWER(??) LIKE ?', ['pledgeName', `%${searchString}%`])
          .orWhereRaw('LOWER(??) LIKE ?', ['link', `%${searchString}%`])
          .orWhereRaw('LOWER(??) LIKE ?', ['creator', `%${searchString}%`]);
      })
      .orderBy('id', 'desc');

    if (kickstarters.length === 0) {
      await ctx.replyWithHTML(
        `❌ Не найдено кикстартеров по запросу: <b>${ctx.message.text}</b>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔍 Поиск снова', 'searchKickstarter')],
          [Markup.button.callback('🔙 Назад', 'adminKickstarters')]
        ])
      );
      return ctx.scene.leave();
    }

    // Store results in session
    ctx.session.searchResults = kickstarters.map(ks => ks.id);

    // Build message with results (handle Telegram 4096 char limit)
    let message = `🔍 <b>Найдено кикстартеров:</b> ${kickstarters.length}\n\n`;
    const buttons = [];

    kickstarters.forEach((ks, index) => {
      const line = `${index + 1}. ${ks.name} - ${ks.creator}\n`;
      if (message.length + line.length > 4000) {
        // Split message if too long
        const tempMessage = message;
        message = line;
        // Send previous part
        ctx.replyWithHTML(tempMessage);
      } else {
        message += line;
      }
      buttons.push(Markup.button.callback(String(index + 1), `adminSelectKickstarter_${index}`));
    });

    message += `\nВыбери кикстартер:`;

    // Split buttons into rows of 5
    const buttonRows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      buttonRows.push(buttons.slice(i, i + 5));
    }

    await ctx.replyWithHTML(
      message,
      Markup.inlineKeyboard([
        ...buttonRows,
        [
          Markup.button.callback('🔍 Поиск снова', 'searchKickstarter'),
          Markup.button.callback('🔙 Назад', 'adminKickstarters')
        ]
      ])
    );

    await ctx.scene.leave();
  } catch (error) {
    console.error('Error searching kickstarters:', error);
    await ctx.reply('❌ Ошибка при поиске');
    await ctx.scene.leave();
  }
});

module.exports = searchKickstarterString;