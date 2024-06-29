const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const paymentSceneProofStage = new Scenes.BaseScene('PAYMENT_SCENE_PROOF_STAGE');

paymentSceneProofStage.enter(async (ctx) => {
});

paymentSceneProofStage.on('photo', async (ctx) => {
  try {
    await ctx.reply('Ага, получил от тебя изображение. Все данные отправил, ожидай аппрува :)');
    await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, '-----------');
    await ctx.telegram.forwardMessage(SETTINGS.CHATS.EPINETOV, ctx.message.from.id, ctx.message.message_id);
    await  ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Уведомление об оплате\n\n<b>Имя:</b> ${ctx.message.from.first_name} ${ctx.message.from.last_name || ""}\n<b>Telegram Username</b>: ${ctx.message.from.username ? `@${ctx.message.from.username}` : "not_set"}\n<b>Telegram ID</b>: ${ctx.message.from.id}\n`, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        Markup.button.callback("Базовая", 'actionBaseGroup'),
        Markup.button.callback("С БГ+", 'actionAdditional')
      ]),
    })
    await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, '-----------');
  } catch (e) {
    console.error('Failed to handle photo message:', e);
  }
})

paymentSceneProofStage.on('document', async (ctx) => {
  try {
    ctx.reply('Ага, получил от тебя документ. Все данные отправил, ожидай аппрува :)')
    await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, '-----------');
    await ctx.telegram.forwardMessage(SETTINGS.CHATS.EPINETOV, ctx.message.from.id, ctx.message.message_id);
    await  ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Уведомление об оплате\n\n<b>Имя:</b> ${ctx.message.from.first_name} ${ctx.message.from.last_name || ""}\n<b>Telegram Username</b>: ${ctx.message.from.username ? `@${ctx.message.from.username}` : "not_set"}\n<b>Telegram ID</b>: ${ctx.message.from.id}\n`, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        Markup.button.callback("Базовая", 'actionBaseGroup'),
        Markup.button.callback("С БГ+", 'actionAdditional')
      ]),
    })
    await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, '-----------');
  } catch (e) {
    console.error('Failed to handle document message:', e);
  }
})

paymentSceneProofStage.action('finishPhotoUpload', async (ctx) => {
  try {
    ctx.session.lot = {
      ...ctx.session.lot,
      whoCreated: ctx.callbackQuery.from
    }
    if (ctx.session.lot.photos.length > 0) {
      try {
        if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
      } catch (e) {
        console.error('Failed to delete message:', e);
      }
      await ctx.scene.enter('LOT_SCENE_PRICE_STAGE');
    } else {
      await ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NO_PHOTOS_UPLOADED);
    }
  } catch (e) {
    console.error('Failed to finish photo upload:', e);
  }
});

paymentSceneProofStage.command('exit', (ctx) => {
  ctx.scene.leave();
})

paymentSceneProofStage.leave(async (ctx) => { });

module.exports = paymentSceneProofStage;
