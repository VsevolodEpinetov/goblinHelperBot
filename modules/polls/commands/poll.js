const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const STUDIOS = require('../../../studios.json')
const util = require('../../util')

module.exports = Composer.command('poll', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV && 
    ctx.message.chat.id != SETTINGS.CHATS.TEST &&
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN
  ) { return; }

  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV && ctx.message.from.id != SETTINGS.CHATS.ALEKS && ctx.message.from.id != SETTINGS.CHATS.ARTYOM) { return; }

  let options = [];
  let currentPollNumber = 0;
  let listOfStudios;
  if (ctx.globalSession.studios) {
    listOfStudios = ctx.globalSession.studios;
  }
  else {
    listOfStudios = STUDIOS;
  }

  for (let i = 0; i < listOfStudios.length; i++) {
    if (!listOfStudios[i].bought) {
      if (!options[currentPollNumber]) options[currentPollNumber] = [];
      options[currentPollNumber].push(`${listOfStudios[i].name} - $${listOfStudios[i].price}`);

      if (options[currentPollNumber].length == SETTINGS.AMOUNT_OF_ALLOWED_ANSWERS_IN_A_POLL) {
        options[currentPollNumber].push('Пустой вариант')
        currentPollNumber++;
      }
    }
  }

  if (options[options.length - 1][options[options.length - 1].length - 1] !== 'Пустой вариант') options[options.length - 1].push('Пустой вариант')

  for (let i = 0; i < options.length; i++) {
    ctx.replyWithPoll(`Голосование. Часть ${i + 1}`, options[i], {
      is_anonymous: false,
      allows_multiple_answers: true
    });
    await util.sleep(250)
  }
})