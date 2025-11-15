const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_PICTURES'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_FILES'

const adminAddKickstarterPhotos = new Scenes.BaseScene(currentStageName);

adminAddKickstarterPhotos.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  if (!ctx.session.kickstarter.photos) {
    ctx.session.kickstarter.photos = [];
  }

  await ctx.telegram.editMessageText(
    ctx.session.chatID,
    ctx.session.toEdit,
    undefined,
    `Пришли <b>картинки</b> проекта\n\nЗагружено картинок: ${ctx.session.kickstarter.photos.length}`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Готово', 'finishedPhotos')],
        [Markup.button.callback('❌ Отмена', 'cancelKickstarterAdd')]
      ])
    }
  );
});

adminAddKickstarterPhotos.action('cancelKickstarterAdd', async (ctx) => {
  ctx.session.kickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Добавление кикстартера отменено');
});

adminAddKickstarterPhotos.on('photo', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  ctx.session.kickstarter.photos.push(ctx.message.photo[ctx.message.photo.length - 1].file_id);
  await ctx.deleteMessage(ctx.message.message_id);

  await ctx.telegram.editMessageText(
    ctx.session.chatID,
    ctx.session.toEdit,
    undefined,
    `Пришли <b>картинки</b> проекта\n\nЗагружено картинок: ${ctx.session.kickstarter.photos.length}`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Готово', 'finishedPhotos')],
        [Markup.button.callback('❌ Отмена', 'cancelKickstarterAdd')]
      ])
    }
  );
});

adminAddKickstarterPhotos.action('finishedPhotos', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter(nextStageName);
});

module.exports = adminAddKickstarterPhotos;