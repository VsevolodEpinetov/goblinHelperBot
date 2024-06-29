const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const monthInvitationPlusStage = new Scenes.BaseScene('PAYMENT_SCENE_ADD_MONTH_PLUS_INVITATION_STAGE');

monthInvitationPlusStage.enter(async (ctx) => {
});

monthInvitationPlusStage.on('text', async (ctx) => {
  try {
    ctx.globalSession.months[ctx.session.monthName].plusInvitationLink = ctx.message.text;
    await ctx.reply(`Записал приглашение в плюсовой канал - ${ctx.message.text}.`)
    await ctx.scene.enter('PAYMENT_SCENE_ADD_MONTH_PLUS_INVITATION_STAGE');
    ctx.scene.leave();
  } catch (e) {
    console.error('Failed to handle photo message:', e);
  }
})

monthInvitationPlusStage.command('exit', (ctx) => {
  ctx.scene.leave();
})

monthInvitationPlusStage.leave(async (ctx) => { });

module.exports = monthInvitationPlusStage;
