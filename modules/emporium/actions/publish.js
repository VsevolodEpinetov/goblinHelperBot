const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const emporiumUtils = require('../util.js')

module.exports = Composer.action(/^action-emporium-publish-[0-9]+$/g, async ctx => {
  util.log(ctx)

  if (ctx.callbackQuery.from.id != SETTINGS.CHATS.EPINETOV && ctx.callbackQuery.from.id != SETTINGS.CHATS.ANN && ctx.callbackQuery.from.id != SETTINGS.CHATS.YURI) {
    return;
  }

  const crID = ctx.callbackQuery.data.split('action-emporium-publish-')[1];

  if (ctx.globalSession.emporium.queue[crID]) {
    const userID = ctx.callbackQuery.from.id;
    const queueData = ctx.globalSession.emporium.queue[crID];
    const creatureData = queueData.data;
    const isWaiting = queueData.status === 'waiting';

    if (isWaiting) {
      const fileName = `${creatureData.code}.png`;
      const imageID = await emporiumUtils.uploadImage(ctx, creatureData.preview.buffer, fileName);
      const crData = {
        data: {
          sex: creatureData.sex,
          classes: creatureData.classes,
          races: creatureData.races,
          mainPicture: imageID,
          priceSTL: 106,
          pricePhysical: 318,
          priceCyprus: 4,
          studioName: creatureData.studioName,
          releaseName: creatureData.releaseName,
          code: creatureData.code,
          //name: 'hi, I am a test!',
          onlyPhysical: false,
          isMonster: creatureData.isMonster,
          isHero: creatureData.isHero,
          weapons: creatureData.weapons
        }
      };
      try {
        const result = await emporiumUtils.createACreature(crData);
        ctx.globalSession.emporium.queue[crID].data.preview = undefined;
        ctx.reply('Минька успешно загружена')
      } catch (error) {
        console.log('Error!');
      }
      ctx.deleteMessage(queueData.lastBotMessageId);
    } else {
      ctx.answerCbQuery('Уже опубликовано')
    }
  } else {
    ctx.answerCbQuery('Нет такого в бд')
  }
})