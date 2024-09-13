const { Composer, Markup } = require('telegraf');
const lotsUtils = require('../utils')
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('upd', (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }

  //new l 123 m 13212 a 132 c 321
  const lotID = parseInt(ctx.message.text.split(' ')[2]);
  const messageID = parseInt(ctx.message.text.split(' ')[4]);
  console.log(lotID);
  console.log(messageID);
  let additionalMessageID;
  let chatID;
  
  if (ctx.message.text.indexOf('a') > 0) {
    additionalMessageID = parseInt(ctx.message.text.split(' ')[6]);
    chatID = parseInt(ctx.message.text.split(' ')[8]);
    console.log(additionalMessageID)
    console.log(chatID)
    ctx.globalSession.lots[lotID].messageID = messageID;
    ctx.globalSession.lots[lotID].additionalMessageID = additionalMessageID;
    ctx.globalSession.lots[lotID].chatID = chatID;
  } else {
    chatID = parseInt(ctx.message.text.split(' ')[6]);
    console.log(chatID)
    ctx.globalSession.lots[lotID].messageID = messageID;
    ctx.globalSession.lots[lotID].chatID = chatID;
  }

  console.log(`Update lot #${lotID}`);
})