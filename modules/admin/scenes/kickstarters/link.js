const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');
const { getKickstarters } = require('../../../db/helpers');

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_LINK'
const nextStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_NAME'

const adminAddKickstarterLink = new Scenes.BaseScene(currentStageName);

adminAddKickstarterLink.enter(async (ctx) => {
  // Check for super user and DM
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const message = await ctx.replyWithHTML(
    `Пришли <b>ссылку</b> на проект`,
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'cancelKickstarterAdd')]
    ])
  );
  ctx.session.toEdit = message.message_id;
  ctx.session.chatID = message.chat.id;
});

adminAddKickstarterLink.action('cancelKickstarterAdd', async (ctx) => {
  ctx.session.kickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Добавление кикстартера отменено');
});

adminAddKickstarterLink.on('text', async (ctx) => {
  // Check for super user and DM
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const link = ctx.message.text;
  await ctx.deleteMessage(ctx.message.message_id);

  // Check if kickstarter already exists in PostgreSQL
  const kickstartersData = await getKickstarters();
  for (let id = 0; id < kickstartersData.list.length; id++) {
    const ks = kickstartersData.list[id];
    if (ks.link == link) {
      await ctx.replyWithHTML(
        `Этот кикстартер уже есть в списке. ID: ${id}\n\n${ks.creator}\n${ks.name}\n${ks.link}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'adminKickstarters')]
        ])
      );
      return ctx.scene.leave();
    }
  }

  ctx.session.kickstarter.link = link;
  ctx.scene.enter(nextStageName);
});

module.exports = adminAddKickstarterLink;
 