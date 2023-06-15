const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const emporiumSexStage = new Scenes.BaseScene('EMPORIUM_SEX_STAGE');

emporiumSexStage.enter((ctx) => {
  ctx.replyWithHTML(`Ага, название релиза -  "${ctx.session.emporium.creatureData.releaseName}". Укажи предполагаемый пол существа`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback('👨‍🦱 Муж.', 'actionEmporiumMale'),
      Markup.button.callback('👩 Жен.', 'actionEmporiumFemale'),
      Markup.button.callback('👽 хз', 'actionEmporiumAlien')
    ])
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumSexStage.on('message', (ctx) => {
  ctx.reply('Выбери вариант из сообщения выше')
})

emporiumSexStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumSexStage.action('actionEmporiumMale', ctx => {
  ctx.session.emporium.creatureData.sex = 'm';
  ctx.scene.enter('EMPORIUM_RACES_STAGE')
})

emporiumSexStage.action('actionEmporiumFemale', ctx => {
  ctx.session.emporium.creatureData.sex = 'f';
  ctx.scene.enter('EMPORIUM_RACES_STAGE')
})

emporiumSexStage.action('actionEmporiumAlien', ctx => {
  ctx.session.emporium.creatureData.sex = 'x';
  ctx.scene.enter('EMPORIUM_RACES_STAGE')
})


emporiumSexStage.leave(async (ctx) => {
});

module.exports = emporiumSexStage;