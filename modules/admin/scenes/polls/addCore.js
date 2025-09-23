const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json');
const { getUserDescription } = require("../../../util");

const addCore = new Scenes.BaseScene('ADMIN_SCENE_ADD_POLLS_CORE');

addCore.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>название студии</b>, которую ты хочешь добавить. Если хочешь удалить студию, то начни название с '-'`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

addCore.on('text', async (ctx) => {
  const isRemoving = ctx.message.text.indexOf('-') > -1 ? true : false;
  let studioName, message;

  if (isRemoving) {
    studioName = ctx.message.text.split('-')[1];
    if (ctx.polls.core.indexOf(studioName) > -1) {
      ctx.polls.core = ctx.polls.core.filter(st => st !== studioName);
      message = `✅ <i>Студия <b>${studioName}</b> успешно удалена из ядра</i>`
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `❌ ${ctx.message.from.id} REMOVED studio ${studioName} from core`)
    } else {
      message = `⚠️ <i>Студия <b>${studioName}</b> не найдена в ядре</i>`
    }
  } else {
    studioName = ctx.message.text;
    if (ctx.polls.core.indexOf(studioName) < 0) {
      ctx.polls.core.push(studioName);
      message = `✅ <i>Студия <b>${studioName}</b> успешно добавлена в ядро</i>`
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, ` ${ctx.message.from.id} ADDED studio ${studioName} to core`)
    } else {
      message = `⚠️ <i>Студия <b>${studioName}</b> уже есть в ядре</i>`
    }
  }

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);
  ctx.replyWithHTML(message + ' ' + `\n\n<u>Студии ядра:</u>\n${ctx.polls.core.join('\n')}`, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('+/-', 'adminPollsCoreAdd'),
        Markup.button.callback('Сбросить', 'adminPollsCoreReset'),
      ],
      [
        Markup.button.callback('←', 'adminPolls')
      ]
    ])
  })
  ctx.scene.leave();
});

addCore.command('exit', ctx => {
  ctx.scene.leave();
})

module.exports = addCore;
