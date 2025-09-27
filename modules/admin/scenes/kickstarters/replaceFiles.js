const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_REPLACE_KICKSTARTER_FILES'

const adminReplaceKickstarterFiles = new Scenes.BaseScene(currentStageName);

adminReplaceKickstarterFiles.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>файлы</b> проекта`, {
    parse_mode: "HTML"
  }).then(nctx => {
    ctx.session.toEdit = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

adminReplaceKickstarterFiles.on('document', async (ctx) => {
  ctx.session.editingKickstarter.files.push(ctx.message.document.file_id);

  await ctx.deleteMessage(ctx.message.message_id);

  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>файлы</b> проекта\nКоличество файлов: ${ctx.session.editingKickstarter.files.length}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      Markup.button.callback('Готово', 'finished')
    ])
  });
});

adminReplaceKickstarterFiles.action('finished', async (ctx) => {
  ctx.scene.leave();
});

adminReplaceKickstarterFiles.leave(async (ctx) => {
  if (!ctx.kickstarters.list) ctx.kickstarters.list = [];
  const kstID = ctx.session.editingKickstarter.id;
  ctx.kickstarters.list[kstID].files = ctx.session.editingKickstarter.files;

  ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `♻️ Кикстартер успешно отредактрован с ID ${kstID}.\nКоличество файлов: ${ctx.kickstarters.list[kstID].files.length}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('+', 'adminAddKickstarter'),
        Markup.button.callback('🔍', 'searchKickstarter'),
        Markup.button.callback('✏️', 'adminEditKickstarter')
      ],
      [
        Markup.button.callback('←', 'userMenu')
      ]
    ])
  })

  ctx.session.editingKickstarter = null;
});

module.exports = adminReplaceKickstarterFiles;