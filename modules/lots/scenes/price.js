const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const lotScenePriceStage = new Scenes.BaseScene('LOT_SCENE_PRICE_STAGE');

lotScenePriceStage.enter(async (ctx) => {
  try {
    await ctx.replyWithHTML(`Картинки запомнил! Теперь мне нужна стоимость лота. Можешь выбрать любую валюту 😌\n\n<b>Этап:</b> 💰 стоимость\n<b>Валюта:</b> USD\n\nℹ️ <i><b>Для информации:</b> вообще взорваться всё от долевых значений (через точку) не должно, но на всякий случай лучше использовать целые числа</i>`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('$ ✅', 'actionChangeCurrency-USD'),
          Markup.button.callback('€', 'actionChangeCurrency-EUR'),
          Markup.button.callback('₽', 'actionChangeCurrency-RUB')
        ],
        [
          Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
        ]
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
  catch (e) {
    console.error('Failed to reply to the message from the user:', e);
  }
});

lotScenePriceStage.on('text', async (ctx) => {
  try {
    ctx.session.lot.price = parseFloat(ctx.message.text);
    ctx.session.lot.lastMessage.user = ctx.message.message_id;
    if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
    ctx.scene.enter('LOT_SCENE_LINK_STAGE');
  } catch (e) {
    console.error('Failed to handle text message:', e);
  }
});

lotScenePriceStage.action(/^actionChangeCurrency-(USD|EUR|RUB)/g, async ctx => {
  util.log(ctx)
  const currency = ctx.callbackQuery.data.split('actionChangeCurrency-')[1];
  ctx.session.lot.currency = currency;

  let menu = [];
  for (const [key, value] of Object.entries(SETTINGS.CURRENCIES)) {
    if (key == currency) {
      menu.push(Markup.button.callback(`${SETTINGS.CURRENCIES[key].SYMBOL} ✅`, `actionChangeCurrency-${key}`))
    } else {
      menu.push(Markup.button.callback(`${SETTINGS.CURRENCIES[key].SYMBOL}`, `actionChangeCurrency-${key}`))
    }
  }

  try {
    if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }

  try {
    await ctx.replyWithHTML(`Сменил валюту на ${SETTINGS.CURRENCIES[currency].NAME}! Ожидаю стоимость лота...\n\n<b>Этап:</b> 💰 стоимость\n<b>Валюта:</b> ${currency}\n\n<b>Картинок:</b> ${ctx.session.lot.photos.length}/10`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
        ]
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
  catch (e) {
    console.error('Failed to change currency:', e);
  }
})

lotScenePriceStage.action('actionStopLot', async (ctx) => {
  try {
    util.log(ctx)
    if (ctx.session.lot) {
      ctx.replyWithHTML(`👌`);
      try {
        if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
      } catch (e) {
        console.error('Failed to delete message:', e);
      }
      ctx.session.lot = null;
      ctx.scene.leave();
    } else {
      await ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_CREATING_A_LOT)
    }
  } catch (e) {
    console.error('Failed to handle stop lot action:', e);
  }
})

lotScenePriceStage.leave(async (ctx) => { });

module.exports = lotScenePriceStage;
