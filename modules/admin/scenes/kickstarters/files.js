const { Scenes, Markup } = require("telegraf");

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_FILES'

const adminAddKickstarterFiles = new Scenes.BaseScene(currentStageName);

adminAddKickstarterFiles.enter(async (ctx) => {
  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>файлы</b> проекта`, {
    parse_mode: "HTML"
  });
});

adminAddKickstarterFiles.on('document', async (ctx) => {
  ctx.session.kickstarter.files.push(ctx.message.document.file_id);

  await ctx.deleteMessage(ctx.message.message_id);

  await ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `Пришли <b>файлы</b> проекта\nКоличество файлов: ${ctx.session.kickstarter.files.length}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      Markup.button.callback('Готово', 'finished')
    ])
  });
});

adminAddKickstarterFiles.action('finished', async (ctx) => {
  ctx.scene.leave();
});

adminAddKickstarterFiles.leave(async (ctx) => {
  if (!ctx.kickstarters.list) ctx.kickstarters.list = [];
  const kstID = ctx.kickstarters.list.length
  ctx.kickstarters.list.push(ctx.session.kickstarter);
  if (ctx.settings.chats.ks) {
    const projectData = ctx.session.kickstarter;
    await ctx.telegram.sendPhoto(ctx.settings.chats.ks.id, projectData.photos[0], {
      caption: `${projectData.link}\n\n<b>Название:</b> ${projectData.name}\n<b>Автор:</b> ${projectData.creator}\n<b>Пледж:</b> ${projectData.pledgeName}\n<b>Оригинальная стоимость:</b> $${projectData.pledgeCost}\n\n<b>Количество файлов:</b> ${projectData.files.length}\n\n<b>Стоимость:</b> ${projectData.cost}₽`,
      message_thread_id: ctx.settings.chats.ks.thread_id,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback('Купить', `showKickstarterFromGoblin_${kstID}`),
      ])
    });
  } else {
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `🆘 Chat 'ks' is not defined, you should fix it before adding any more projects!!! @send_dog_pics @WarmDuck`)
  }

  ctx.telegram.editMessageText(ctx.session.chatID, ctx.session.toEdit, undefined, `✅ Кикстартер успешно добавлен с ID ${kstID}.\nВсего проектов внесено: ${ctx.kickstarters.list.length}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('+', 'adminAddKickstarter'),
        Markup.button.callback('🔍', 'searchKickstarter'),
        Markup.button.callback('✏️', 'adminEditKickstarter')
      ],
      [
        Markup.button.callback('←', 'adminMenu')
      ]
    ])
  })

  ctx.session.kickstarter = null;
});

module.exports = adminAddKickstarterFiles;