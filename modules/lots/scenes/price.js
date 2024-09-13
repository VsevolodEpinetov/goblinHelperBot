const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')
const lotsUtils = require('../utils.js')

const lotScenePriceStage = new Scenes.BaseScene('LOT_SCENE_PRICE_STAGE');

const currencyButtons = [
  Markup.button.callback('$ ✅', 'setCurrency-USD'),
  Markup.button.callback('€', 'setCurrency-EUR'),
  Markup.button.callback('₽', 'setCurrency-RUB'),
];

lotScenePriceStage.enter(async (ctx) => {
  ctx.session.lot.currency = 'USD'
  await lotsUtils.updateLotCreationMessage(ctx,
    `Картинки запомнил! Теперь мне нужна стоимость лота. Можешь выбрать любую валюту 😌\n\n<b>Этап:</b> 💰 стоимость\n<b>Валюта:</b> USD\n\nℹ️ <i><b>Для информации:</b> вообще взорваться всё от долевых значений (через точку) не должно, но на всякий случай лучше использовать целые числа</i>`,
    [
      currencyButtons,
      [
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ]
    ]
  )
});

lotScenePriceStage.on('text', async (ctx) => {
  try {
    const price = parseFloat(ctx.message.text);
    await ctx.deleteMessage(ctx.message.message_id);
    if (isNaN(price) || price <= 0) {
      return await lotsUtils.updateLotCreationMessage (ctx, 
        `⚠️ <b>Ожидаю от тебя число! Не могу распознать, что ты прислал</b> ⚠️\n\n<blockquote>Можешь прислать как целое число, например - 12, так и дробное, например, 12.5</blockquote>\n\n<b>Этап:</b> 💰 стоимость\n<b>Валюта:</b> USD\n\nℹ️ <i><b>Для информации:</b> вообще взорваться всё от долевых значений (через точку) не должно, но на всякий случай лучше использовать целые числа</i>`,
        [
          currencyButtons,
          [
            Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
          ]
        ]
      );
    }

    ctx.session.lot.price = price.toFixed(2); // Store as a number with 2 decimal points
    ctx.scene.enter('LOT_SCENE_LINK_STAGE');
  } catch (e) {
    console.error('Failed to handle text message:', e);
  }
});

lotScenePriceStage.action(/^setCurrency-(USD|EUR|RUB)/g, async ctx => {
  util.log(ctx)
  const currency = ctx.callbackQuery.data.split('setCurrency-')[1];
  ctx.session.lot.currency = currency;

  let menu = [];
  for (const [key, value] of Object.entries(SETTINGS.CURRENCIES)) {
    if (key == currency) {
      menu.push(Markup.button.callback(`${SETTINGS.CURRENCIES[key].SYMBOL} ✅`, `setCurrency-${key}`))
    } else {
      menu.push(Markup.button.callback(`${SETTINGS.CURRENCIES[key].SYMBOL}`, `setCurrency-${key}`))
    }
  }

  try {
    await lotsUtils.updateLotCreationMessage(ctx,
      `Сменил валюту на ${SETTINGS.CURRENCIES[currency].NAME}! Ожидаю стоимость лота...\n\n<b>Этап:</b> 💰 стоимость\n<b>Валюта:</b> ${currency}\n\nℹ️ <i><b>Для информации:</b> вообще взорваться всё от долевых значений (через точку) не должно, но на всякий случай лучше использовать целые числа</i>`,
      [
        menu,
        [
          Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
        ]
      ]
    )
  }
  catch (e) {
    console.error('Failed to change currency:', e);
  }
})

lotScenePriceStage.action('actionStopLot', async (ctx) => {
  try {
    util.log(ctx)
    if (ctx.session.lot) {
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
