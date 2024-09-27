const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const monthNameStage = new Scenes.BaseScene('PAYMENT_SCENE_ADD_MONTH_NAME_STAGE');

monthNameStage.enter(async (ctx) => {
});

monthNameStage.on('text', async (ctx) => {
  try {
    ctx.months.list[ctx.message.text] = {
      members: {},
      mainInvitationLink: '',
      plusInvitationLink: ''
    }
    ctx.globalSession.currentMonth = ctx.message.text;
    ctx.session.monthName = ctx.message.text;
    await ctx.reply(`Записал месяц ${ctx.message.text} и сразу выбрал его активным. Жду от тебя ссылку-приглашение на основной архив`)

    await ctx.scene.enter('PAYMENT_SCENE_ADD_MONTH_INVITATION_STAGE');
  } catch (e) {
    console.error('Failed to handle photo message:', e);
  }
})

monthNameStage.command('exit', (ctx) => {
  ctx.scene.leave();
})

monthNameStage.leave(async (ctx) => { });

module.exports = monthNameStage;
