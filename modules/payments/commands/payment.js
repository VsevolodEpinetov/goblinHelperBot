const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.hears(/^[яЯ]\s*оплатил(!)*$/g, async (ctx) => {
  ctx.reply(`Хм, допустим, я поверю тебе. Но каковы твои доказательства? Скриншот, документ?`)
  ctx.scene.enter('PAYMENT_SCENE_PROOF_STAGE');
})