const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json');
const { getUserDescription } = require("../../../util");
const { getDynamicStudios, addStudio, removeStudio } = require("../../../db/polls");

const addStudios = new Scenes.BaseScene('ADMIN_SCENE_ADD_POLLS_STUDIOS');

addStudios.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>название студии</b>, которую ты хочешь добавить. Если хочешь удалить студию, то начни название с '-'`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

addStudios.on('text', async (ctx) => {
  const isRemoving = ctx.message.text.indexOf('-') > -1 ? true : false;
  let studioName, message;

  if (isRemoving) {
    studioName = ctx.message.text.split('-')[1];
    const success = await removeStudio(studioName);
    if (success) {
      message = `✅ <i>Студия <b>${studioName}</b> успешно удалена из добавленных</i>`
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `❌ ${ctx.message.from.id} REMOVED studio ${studioName} from added`)
    } else {
      message = `⚠️ <i>Студия <b>${studioName}</b> не найдена в добавленных</i>`
    }
  } else {
    studioName = ctx.message.text;
    const success = await addStudio(studioName);
    if (success) {
      message = `✅ <i>Студия <b>${studioName}</b> успешно добавлена в добавленные</i>`
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, ` ${ctx.message.from.id} ADDED studio ${studioName} to added`)
    } else {
      message = `⚠️ <i>Студия <b>${studioName}</b> уже есть в добавленных</i>`
    }
  }

  // Get updated dynamic studios from database
  const dynamicStudios = await getDynamicStudios();
  const dynamicStudioNames = dynamicStudios.map(s => s.name);

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);
  ctx.replyWithHTML(message + ' ' + `\n\nДобавленные студии:\n${dynamicStudioNames.join('\n')}`, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('+/-', 'adminPollsStudiosAdd'),
        Markup.button.callback('Сбросить', 'adminPollsStudiosReset'),
      ],
      [
        Markup.button.callback('←', 'adminPolls')
      ]
    ])
  })
  ctx.scene.leave();
});

addStudios.command('exit', ctx => {
  ctx.scene.leave();
})

module.exports = addStudios;
