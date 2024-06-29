const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const monthInvitationStage = new Scenes.BaseScene('PAYMENT_SCENE_ADD_MONTH_INVITATION_STAGE');

monthInvitationStage.enter(async (ctx) => {
});

monthInvitationStage.on('text', async (ctx) => {
  try {
    console.log(ctx.session.monthName);
    ctx.globalSession.months[ctx.session.monthName].mainInvitationLink = ctx.message.text;
    await ctx.reply(`Записал приглашение в основной канал - ${ctx.message.text}. Жду от тебя ссылку-приглашение на ПЛЮСОВОЙ архив`)

    await ctx.scene.enter('PAYMENT_SCENE_ADD_MONTH_PLUS_INVITATION_STAGE');
  } catch (e) {
    console.error('Failed to handle photo message:', e);
  }
})

monthInvitationStage.command('exit', (ctx) => {
  ctx.scene.leave();
})

monthInvitationStage.leave(async (ctx) => { });

module.exports = monthInvitationStage;
