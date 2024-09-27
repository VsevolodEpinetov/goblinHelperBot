const { Composer } = require("telegraf");
const util = require('../../util')

function randomIntFromInterval(min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min)
}

module.exports = Composer.hears(/^\/roll\s*[0-9]+$/g, (ctx) => {
  util.log(ctx);
  const number = ctx.message.text.split('/roll')[1];
  ctx.reply(String(randomIntFromInterval(1, number)), {
    reply_to_message_id: ctx.message.message_id
  })
})