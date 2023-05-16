//#region imports
const { Telegraf, Markup, Telegram, Scenes, session } = require('telegraf');
require('dotenv').config();
const bot = new Telegraf(process.env.TOKEN)
const telegram = new Telegram(process.env.TOKEN)
const SETTINGS = require('./settings.json')
const STUDIOS = require('./studios.json')

const util = require('./modules/util.js');
//#endregion

//#region Redis
// --------------------------------------------------------------------------
// 1. Redis, sessions
// --------------------------------------------------------------------------
const RedisSession = require('telegraf-session-redis-upd')
const sessionInstance = new RedisSession();
const SESSIONS = require('./modules/sessions.js');
bot.use(
  SESSIONS.GLOBAL_SESSION,
  SESSIONS.USER_SESSION,
  SESSIONS.CHAT_SESSION
)
//#endregion

//#region additional functions
const deleteTheMessage = (ctx, messageId) => {
  ctx.deleteMessage(messageId).catch((error) => {
    console.log("Error! Couldn't delete a message. Reason:")
    console.log(error)
    telegram.sendMessage(SETTINGS.CHATS.TEST, `Met an error: ${error.toString()}`)
  })
}

const replyToTheMessage = (ctx, message, replyToID) => {
  ctx.replyWithHTML(message, {
    reply_to_message_id: replyToID
  }).catch((error) => {
    console.log("Error! Couldn't reply to a message, just sending a message. Reason:")
    console.log(error)
    ctx.replyWithHTML(message)
  })
}

const getPriceInUSD = (price) => {
  return Math.ceil(price * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE);
}

function getLotMessage({ author = 'Автор не указан', name = 'Безымянный набор', link = "", price, organizator = 'Организатора нет', status = false, participants = [] }) {

  let participantsText = participants.length > 0 ? '' : '1.';
  participants.forEach((part, id) => {
    let participantFullName = part?.first_name + ' ' + part?.last_name;
    if (part.username) participantFullName += ` (@${part.username})`
    participantsText += `${id + 1}. ${participantFullName}\n`
  })

  let newCostPerPerson = participants.length > 0 ? price / participants.length : price;
  newCostPerPerson = +newCostPerPerson.toFixed(2);
  let costPerPersonFuture = participants.length > 0 ? price / (participants.length + 1) : price;
  costPerPersonFuture = +costPerPersonFuture.toFixed(2);

  return `<b>${author}</b>
<i>${name}</i>

🔗 <b>Ссылка:</b> <a href='${link}'>тык</a>
💰 <b>Цена:</b> $${price} (${getPriceInUSD(price)}₽)

<b>Организатор:</b> ${organizator}
<b>Статус:</b> ${status ? '✅ ОТКРЫТ НАБОР' : '❌ СБОР ЗАВЕРШЁН'}

<b>Участники:</b>
${participantsText}${participants.length > 0 ? `
💶 <b>Каждый платит по:</b> $${newCostPerPerson} (${Math.ceil(newCostPerPerson * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE)}₽)` : ''}${status ? `

Если ты присоединишься, то цена участия будет $${costPerPersonFuture} (${getPriceInUSD(costPerPersonFuture)}₽)` : ''}

${status ? '#opened_lot' : '#closed_lot'}`
}

function getLotMessageShort({ author = 'Автор не указан', name = 'Безымянный набор', link = "", price, organizator = 'Организатора нет', status = false, participants = [] }) {

  let participantsText = '';
  participants.forEach((part, id) => {
    let participantFullName = ``;
    if (part.username) {
      participantFullName += `@${part.username}`
    } else {
      participantFullName += part?.first_name
    }
    participantsText += `${participantFullName}; `
  })

  let newCostPerPerson = participants.length > 0 ? price / participants.length : price;
  newCostPerPerson = +newCostPerPerson.toFixed(2);
  let costPerPersonFuture = participants.length > 0 ? price / (participants.length + 1) : price;
  costPerPersonFuture = +costPerPersonFuture.toFixed(2);

  return `<b>${author}</b>
<i>${name}</i>

🔗 <b>Ссылка:</b> <a href='${link}'>тык</a>
💰 <b>Цена:</b> $${price} (${getPriceInUSD(price)}₽)

<b>Организатор:</b> ${organizator}
<b>Статус:</b> ${status ? '✅ ОТКРЫТ НАБОР' : '❌ СБОР ЗАВЕРШЁН'}

<b>Участники:</b>
${participantsText}${participants.length > 0 ? `
💶 <b>Каждый платит по:</b> $${newCostPerPerson} (${Math.ceil(newCostPerPerson * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE)}₽)` : ''}${status ? `

Если ты присоединишься, то цена участия будет $${costPerPersonFuture} (${getPriceInUSD(costPerPersonFuture)}₽)` : ''}

${status ? '#opened_lot' : '#closed_lot'}`
}
//#endregion

//#region Lots scenes: photo

/**************************************
 * 
 * LOTS SCENES:
 * 1. PHOTO
 * 
 * ***********************************/

const lotScenePhotoStage = new Scenes.BaseScene('LOT_SCENE_PHOTO_STAGE');

lotScenePhotoStage.enter((ctx) => {
  if (!ctx.globalSession.lots) ctx.globalSession.lots = [];
  ctx.session.lot = SETTINGS.EMPTY_LOT;
  ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.GREETING, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
    ])
  }).then(nctx => {
    ctx.session.lot.lastMessage.bot = nctx.message_id;
  })
});

lotScenePhotoStage.on('photo', (ctx) => {
  ctx.session.lot = {
    ...ctx.session.lot,
    photo: ctx.message.photo[0].file_id,
    user: ctx.message.message_id,
    whoCreated: ctx.message.from
  }
  try {
    if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }
  return ctx.scene.enter('LOT_SCENE_PRICE_STAGE');
})

lotScenePhotoStage.on('document', (ctx) => {
  ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_A_PHOTO, {
    reply_to_message_id: ctx.message.message_id
  }).catch((error) => {
    console.log("Error! Couldn't reply to a message, just sending a message")
    ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_A_PHOTO)
  })
})

lotScenePhotoStage.on('message', (ctx) => {
  ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.WAITING_FOR_A_PHOTO, {
    parse_mode: 'HTML',
    reply_to_message_id: ctx.message.message_id,
    ...Markup.inlineKeyboard([
      Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
    ])
  })
})

lotScenePhotoStage.action('actionStopLot', (ctx) => {
  util.log(ctx)
  if (ctx.session.lot) {
    ctx.replyWithHTML(`👌`);
    try {
      if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
    }
    catch (e) {
      console.log(e)
    }
    ctx.session.lot = null;
    return ctx.scene.leave();
  } else {
    ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_CREATING_A_LOT)
  }
})

lotScenePhotoStage.leave(async (ctx) => {
});

//#endregion

//#region Lots scenes: Price

/**************************************
 * 
 * LOTS SCENES:
 * 2. PRICE
 * 
 * ***********************************/

const lotScenePriceStage = new Scenes.BaseScene('LOT_SCENE_PRICE_STAGE');

lotScenePriceStage.enter((ctx) => {
  try {
    ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ASK_PRICE, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
  catch (e) {
    console.log('Failed to reply to the message from the user')
    ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ASK_PRICE, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
});

lotScenePriceStage.on('text', (ctx) => {
  ctx.session.lot.price = parseFloat(ctx.message.text);
  ctx.session.lot.lastMessage.user = ctx.message.message_id;
  try {
    if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }
  return ctx.scene.enter('LOT_SCENE_LINK_STAGE');
});

lotScenePhotoStage.action('actionStopLot', (ctx) => {
  util.log(ctx)
  if (ctx.session.lot) {
    ctx.replyWithHTML(`👌`);
    try {
      if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
    }
    catch (e) {
      console.log(e)
    }
    ctx.session.lot = null;
    return ctx.scene.leave();
  } else {
    ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_CREATING_A_LOT)
  }
})

lotScenePriceStage.leave(async (ctx) => { });
//#endregion

//#region Lots scenes: Link
/**************************************
 * 
 * LOTS SCENES:
 * 3. LINK
 * 
 * ***********************************/

const lotSceneLinkStage = new Scenes.BaseScene('LOT_SCENE_LINK_STAGE');

lotSceneLinkStage.enter((ctx) => {
  try {
    ctx.replyWithHTML(`Ого, целых $${ctx.session.lot.price}! А отправьте мне ссылку на эти модельки. Может, кто-то ещё захочет посмотреть на весь набор`, {
      reply_to_message_id: ctx.session.lot.lastMessage.user,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
  catch (e) {
    console.log('Failed to reply to the message')
    console.log(e)
    ctx.replyWithHTML(`Ого, целых $${ctx.session.lot.price}! А отправьте мне ссылку на эти модельки. Может, кто-то ещё захочет посмотреть на весь набор`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
});

lotSceneLinkStage.on('text', (ctx) => {
  ctx.session.lot.link = ctx.message.text;
  ctx.session.lot.lastMessage.user = ctx.message.message_id;
  try {
    if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }
  return ctx.scene.enter('LOT_SCENE_AUTHOR_STAGE');
});

lotScenePhotoStage.action('actionStopLot', (ctx) => {
  util.log(ctx)
  if (ctx.session.lot) {
    ctx.replyWithHTML(`👌`);
    try {
      if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
    }
    catch (e) {
      console.log(e)
    }
    ctx.session.lot = null;
    return ctx.scene.leave();
  } else {
    ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_CREATING_A_LOT)
  }
})

lotSceneLinkStage.leave(async (ctx) => { });
//#endregion

//#region Lots scenes: Author

/**************************************
 * 
 * LOTS SCENES:
 * 4. AUTHOR
 * 
 * ***********************************/

const lotSceneAuthorStage = new Scenes.BaseScene('LOT_SCENE_AUTHOR_STAGE');

lotSceneAuthorStage.enter((ctx) => {
  try {
    ctx.replyWithHTML(`Понял, всех буду отправлять <a href='${ctx.session.lot.link}'>сюда</a>. А если вкратце - кто автор моделек?`, {
      reply_to_message_id: ctx.session.lot.lastMessage.user,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  } catch (e) {
    console.log('Failed to reply to the message')
    console.log(e)
    ctx.replyWithHTML(`Понял, всех буду отправлять <a href='${ctx.session.lot.link}'>сюда</a>. А если вкратце - кто автор моделек?`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
});

lotSceneAuthorStage.on('text', (ctx) => {
  ctx.session.lot.author = ctx.message.text;
  ctx.session.lot.lastMessage.user = ctx.message.message_id;
  try {
    if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }
  return ctx.scene.enter('LOT_SCENE_NAME_STAGE');
});

lotScenePhotoStage.action('actionStopLot', (ctx) => {
  util.log(ctx)
  if (ctx.session.lot) {
    ctx.replyWithHTML(`👌`);
    try {
      if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
    }
    catch (e) {
      console.log(e)
    }
    ctx.session.lot = null;
    return ctx.scene.leave();
  } else {
    ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_CREATING_A_LOT)
  }
})

lotSceneAuthorStage.leave(async (ctx) => { });

//#endregion

//#region Lots scenes: Name

/**************************************
 * 
 * LOTS SCENES:
 * 5. NAME
 * 
 * ***********************************/

const lotSceneNameStage = new Scenes.BaseScene('LOT_SCENE_NAME_STAGE');

lotSceneNameStage.enter((ctx) => {
  try {
    ctx.replyWithHTML(`<b>${ctx.session.lot.author}</b>... Кажется, я это раньше где-то слышал 🤔 А набор как называется?`, {
      reply_to_message_id: ctx.session.lot.lastMessage.user,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  } catch (e) {
    console.log('Failed to reply to the message')
    console.log(e)
    ctx.replyWithHTML(`<b>${ctx.session.lot.author}</b>... Кажется, я это раньше где-то слышал 🤔 А набор как называется?`, {
      reply_to_message_id: ctx.session.lot.lastMessage.user,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
});

lotSceneNameStage.on('text', (ctx) => {
  ctx.session.lot.name = ctx.message.text;
  try {
    if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }

  let organizator = ctx.session.lot.whoCreated?.first_name + ' ' + ctx.session.lot.whoCreated?.last_name;
  if (ctx.session.lot.whoCreated.username) organizator += ` (@${ctx.session.lot.whoCreated.username})`

  let lotInfo = ctx.session.lot;

  ctx.replyWithPhoto(ctx.session.lot.photo, {
    caption: getLotMessage(
      {
        author: lotInfo.author,
        name: lotInfo.name,
        link: lotInfo.link,
        price: lotInfo.price,
        organizator: organizator,
        status: true
      }
    ),
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${ctx.globalSession.lots.length}`),
      Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${ctx.globalSession.lots.length}`),
    ])
  })

  return ctx.scene.leave();
});

lotScenePhotoStage.action('actionStopLot', (ctx) => {
  util.log(ctx)
  if (ctx.session.lot) {
    ctx.replyWithHTML(`👌`);
    try {
      if (ctx.session.lot.lastMessage.bot) deleteTheMessage(ctx, ctx.session.lot.lastMessage.bot);
    }
    catch (e) {
      console.log(e)
    }
    ctx.session.lot = null;
    return ctx.scene.leave();
  } else {
    ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_CREATING_A_LOT)
  }
})

lotSceneNameStage.leave(async (ctx) => {
  if (!ctx.globalSession.lots) ctx.globalSession.lots = [];
  ctx.globalSession.lots.push(ctx.session.lot);
  ctx.session.lot = null;
});

//#endregion

//#region Register Scenes, Init Stage
const stage = new Scenes.Stage([lotScenePhotoStage, lotScenePriceStage, lotSceneLinkStage, lotSceneAuthorStage, lotSceneNameStage]);
bot.use(session());
bot.use(stage.middleware());
//#endregion

//#region Lot actions
bot.action(/^action-join-lot-[0-9]+$/g, ctx => {
  util.log(ctx)
  const lotID = ctx.callbackQuery.data.split('action-join-lot-')[1];

  if (ctx.globalSession.lots[lotID].opened) {
    const userID = ctx.callbackQuery.from.id;

    let participants = ctx.globalSession.lots[lotID].participants;
    let alreadyParticipate = false;
    participants.forEach(p => {
      if (userID == p.id) alreadyParticipate = true;
    });

    if (!alreadyParticipate) {
      ctx.globalSession.lots[lotID].participants.push(ctx.callbackQuery.from);
      const lotData = ctx.globalSession.lots[lotID];

      let organizator = lotData.whoCreated?.first_name + ' ' + lotData.whoCreated?.last_name;
      if (lotData.whoCreated.username) organizator += ` (@${lotData.whoCreated.username})`

      let caption = getLotMessage({
        author: lotData.author,
        name: lotData.name,
        link: lotData.link,
        price: lotData.price,
        organizator: organizator,
        status: true,
        participants: lotData.participants
      })

      if (caption.length > 1023) {
        caption = getLotMessageShort({
          author: lotData.author,
          name: lotData.name,
          link: lotData.link,
          price: lotData.price,
          organizator: organizator,
          status: true,
          participants: lotData.participants
        })
      }

      ctx.replyWithPhoto(lotData.photo, {
        caption: caption,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${lotID}`),
          Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${lotID}`),
        ]),
        message_thread_id: ctx.callbackQuery.message.message_thread_id ? ctx.callbackQuery.message.message_thread_id : null,
        //message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS,
        disable_notification: true
      })

      deleteTheMessage(ctx, ctx.callbackQuery.message.message_id);
    } else {
      ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.ALREADY_IN)
    }
  } else {
    ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.ALREADY_CLOSED)
  }
})

bot.action(/^action-close-lot-[0-9]+$/g, ctx => {
  util.log(ctx)
  const lotID = ctx.callbackQuery.data.split('action-close-lot-')[1];

  if (/*ctx.globalSession.lots[lotID].opened*/true) {
    const userID = ctx.callbackQuery.from.id;
    const lotData = ctx.globalSession.lots[lotID];

    if (userID == lotData.whoCreated.id || userID == SETTINGS.CHATS.EPINETOV) {
      /*let organizator = lotData.whoCreated?.first_name + ' ' + lotData.whoCreated?.last_name;
      if (lotData.whoCreated.username) organizator += ` (@${lotData.whoCreated.username})`

      ctx.replyWithPhoto(lotData.photo, {
        caption: getLotMessage(
          {
            author: lotData.author,
            name: lotData.name,
            link: lotData.link,
            price: lotData.price,
            organizator: organizator,
            status: false,
            participants: lotData.participants
          }
        ),
        parse_mode: 'HTML',
        message_thread_id: ctx.callbackQuery.message.message_thread_id ? ctx.callbackQuery.message.message_thread_id : null
      })*/

      //ctx.globalSession.lots[lotID].opened = false;
      //deleteTheMessage(ctx, ctx.callbackQuery.message.message_id);
      //ctx.deleteMessage(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id)
      //ctx.deleteMessage()
      telegram.deleteMessage(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id).catch((error) => {
        telegram.editMessageCaption(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id, undefined, 'удалено', {
          parse_mode: 'HTML'
        })
        console.log(error)
      });
      //console.log(ctx.callbackQuery.message)
    } else {
      ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_A_CREATOR)
    }
  } else {
    ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.ALREADY_CLOSED)
  }
})
//#endregion

bot.command('revive', (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }

  const lotID = parseInt(ctx.message.text.split('/revive ')[1]);
  const lotData = ctx.globalSession.lots[lotID];

  console.log(lotID);
  console.log(lotData);

  let organizator = lotData.whoCreated?.first_name + ' ' + lotData.whoCreated?.last_name;
  if (lotData.whoCreated.username) organizator += ` (@${lotData.whoCreated.username})`

  let caption = getLotMessage({
    author: lotData.author,
    name: lotData.name,
    link: lotData.link,
    price: lotData.price,
    organizator: organizator,
    status: true,
    participants: lotData.participants
  })

  if (caption.length > 1023) {
    caption = getLotMessageShort({
      author: lotData.author,
      name: lotData.name,
      link: lotData.link,
      price: lotData.price,
      organizator: organizator,
      status: true,
      participants: lotData.participants
    })
  }

  ctx.replyWithPhoto(lotData.photo, {
    caption: caption,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${lotID}`),
      Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${lotID}`),
    ]),
    message_thread_id: ctx.message.message_thread_id ? ctx.message.message_thread_id : null,
    disable_notification: true
  }).catch((error) => {
    console.log(error)
  })

})


function randomIntFromInterval(min, max) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min)
}

bot.hears(/(^[гГ]облин[!.]?$)/g, (ctx) => {
  replyToTheMessage(ctx, `Слушаю, господин${ctx.message.from.first_name && ' ' + ctx.message.from.first_name}! Если Вы забыли, что я умею - напиши "Гоблин, что ты умеешь?"`, ctx.message.message_id)
})

bot.hears(/(^[гГ]облин[,]? как тебя зовут?\??$)/g, (ctx) => {
  replyToTheMessage(ctx, `Если вам очень интересно - посмотрите в моём профиле :)`, ctx.message.message_id)
})

bot.hears(/(^[гГ]облин[,]? что ты умеешь?\??$)/g, (ctx) => {
  replyToTheMessage(ctx, `Сейчас я умею подсказывать, сколько долларов в разных валютах! Например, спросите меня "Гоблин, сколько 5 долларов в рублях?"`, ctx.message.message_id)
})

bot.hears(/^[гГ]облин[,]? сколько \$?([0-9]*[.])?[0-9]+ (доллар(ов|а) |бакс(ов|а) | )?в [а-яА-Я]+\??$/g, (ctx) => {
  let amount = ctx.message.text.split('сколько ')[1].split(' ')[0];
  if (amount.indexOf('$') > -1) amount = amount.split('$')[1];
  amount = parseFloat(amount);

  let newCurrency = ctx.message.text.split(' в ')[1];
  if (newCurrency.indexOf('?') > -1) newCurrency = newCurrency.split('?')[0];

  if (newCurrency == 'рублях' || newCurrency == 'копейках' || newCurrency == 'деревянных' || newCurrency == 'деревяных') {
    let newValue = Math.ceil(amount * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE);
    let word = 'руб.'
    if (newCurrency == 'копейках') {
      newValue = Math.ceil(amount * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE * 100);
      word = 'коп.'
    }

    replyToTheMessage(ctx, `Тэкс, ну, получается, $${amount} это ${newValue} ${word}!`, ctx.message.message_id)
  } else {
    replyToTheMessage(ctx, `Чего? Какие ${newCurrency}? Яж необразованный, я не знаю такой валюты!`, ctx.message.message_id)
  }
})

bot.hears(/^[гГ]облин[,]? хочу создать лот[.!]?$/g, (ctx) => {
  if (
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN &&
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV &&
    ctx.message.chat.id != SETTINGS.CHATS.TEST
  ) { return; }
  //ctx.scene.enter('LOT_SCENE_PHOTO_STAGE');
  if (ctx.message.message_thread_id != SETTINGS.TOPICS.GOBLIN.LOTS) {
    ctx.reply('Милорд, сожалею, но мне было указано создавать лоты только в специальном канале! Попробуйте там')
  } else {
    ctx.scene.enter('LOT_SCENE_PHOTO_STAGE');
  }
})

bot.command('studios', (ctx) => {
  util.log(ctx)
  if (
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV && 
    ctx.message.chat.id != SETTINGS.CHATS.TEST &&
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN
  ) { return; }

  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV && ctx.message.from.id != SETTINGS.CHATS.ALEKS) { return; }
  let message = `Список студий, которые будут участвовать в голосовании:`
  let messageBoughtPart = `А эти студии у нас уже есть, поэтому их не выкупаем:`
  let counterMain = 1;
  let counterBought = 1;

  for (let i = 0; i < STUDIOS.length; i++) {
    if (!STUDIOS[i].bought) {
      message += `\n${counterMain}. <a href="${STUDIOS[i].mainLink}">${STUDIOS[i].name}</a> - $${STUDIOS[i].price}`;
      counterMain++;
    } else {
      messageBoughtPart += `\n${counterBought}. <a href="${STUDIOS[i].mainLink}">${STUDIOS[i].name}</a> - $${STUDIOS[i].price}`
      counterBought++;
    }

  }
  message += `\n\n${messageBoughtPart}`;

  try {
    ctx.reply(message, {
      reply_to_message_id: ctx.message.message_id,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  }
  catch (e) {
    console.log('Failed to reply')
    console.log(e)
    ctx.reply(message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  }
})

bot.command('id', (ctx) => {
  util.log(ctx);
  if (ctx.message.chat.from < 0) return;
  else {
    ctx.reply(`Твой telegramID: ${ctx.message.from.id}`);
  }
})

bot.command('poll', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV && 
    ctx.message.chat.id != SETTINGS.CHATS.TEST &&
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN
  ) { return; }

  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV && ctx.message.from.id != SETTINGS.CHATS.ALEKS) { return; }

  let options = [];
  let currentPollNumber = 0;

  for (let i = 0; i < STUDIOS.length; i++) {
    if (!STUDIOS[i].bought) {
      if (!options[currentPollNumber]) options[currentPollNumber] = [];
      options[currentPollNumber].push(`${STUDIOS[i].name} - $${STUDIOS[i].price}`);

      if (options[currentPollNumber].length == SETTINGS.AMOUNT_OF_ALLOWED_ANSWERS_IN_A_POLL) {
        options[currentPollNumber].push('Пустой вариант')
        currentPollNumber++;
      }
    }
  }

  if (options[options.length - 1][options[options.length - 1].length - 1] !== 'Пустой вариант') options[options.length - 1].push('Пустой вариант')

  for (let i = 0; i < options.length; i++) {
    ctx.replyWithPoll(`Май. Часть ${i + 1}`, options[i], {
      is_anonymous: false,
      allows_multiple_answers: true
    });
    await util.sleep(250)
  }
})

bot.command('test', (ctx) => {
  ctx.globalSession.lots[ctx.globalSession.lots.length - 1].name = `500+ миниатюр
- весь каталог автора на MMF
- 5 Кикстартеров
1. <a href='https://www.kickstarter.com/projects/m3dm/dragons-collection-3d-printable-files?ref=created_projects'>Dragons Collection</a>
2. <a href='https://www.kickstarter.com/projects/m3dm/japanese-mythology-3d-printable-files?ref=created_projects'>Japanese Mythology</a>
3. <a href='https://www.kickstarter.com/projects/m3dm/greek-mythology-mia-kay-collection?ref=created_projects'>Greek Mythology</a>
4. <a href='https://www.kickstarter.com/projects/m3dm/cursed-forest-collection?ref=created_projects'>Cursed Forest</a>
5. <a href='https://www.kickstarter.com/projects/m3dm/the-seven-deadly-sins-3d-printable-collection'>The Seven Deadly Sins</a>`
})

bot.command('count', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV &&
    ctx.message.chat.id != SETTINGS.CHATS.TEST &&
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN
  ) { return; }

  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  if (!ctx.message.reply_to_message) {
    ctx.reply('Ты промахнулся')
  } else if (!ctx.message.reply_to_message.poll) {
    ctx.reply('Промах')
  } else {
    const data = ctx.message.reply_to_message.poll;
    let message = `📝 Результаты <b>${data.question}</b>\n\n<i>Всего проголосовало: ${data.total_voter_count}</i>\n`
    let totalCount = 0;
    await ctx.getChatMembersCount().then((count) => {
      totalCount = count - 1;

    }).catch((err) => {
      console.log(err)
      ctx.reply('Не удалось получить количество участников')
    })
    const notVoted = totalCount - data.total_voter_count;
    if (notVoted > 0) message += `<i>Ждём ещё ${notVoted} участников</i>\n`;

    data.options.forEach(studio => {
      if (studio.text !== 'Пустой вариант') {
        const percent = Math.ceil((studio.voter_count / totalCount) * 100);
        message += `\n`
        message += `${percent > 34 ? '🌟 <b>' : ''}${studio.text.split(' - ')[0]} - ${percent}%${percent > 34 ? '</b>' : ''}`
      }
    })
    ctx.reply(message, {
      parse_mode: "HTML"
    });
  }
})


// TODO: Make one command which parses the value of the dice
bot.hears(/^\/roll\s*[0-9]+$/g, (ctx) => {
  util.log(ctx);
  const number = ctx.message.text.split('/roll')[1];
  replyToTheMessage(ctx, String(randomIntFromInterval(1, number)), ctx.message.message_id)
})

bot.catch((error) => {
  console.log(error);
})

// --------------------------------------------------------------------------
// 4. Service
// --------------------------------------------------------------------------
bot.launch()
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))