const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const emporiumTypeStage = new Scenes.BaseScene('EMPORIUM_TYPE_STAGE');

emporiumTypeStage.enter((ctx) => {
  ctx.session.emporium = {
    creatureData: {
      isHero: true,
      isMonster: false
    },
    botData: {
      lastMessage: {
        bot: '-1',
        user: '-1'
      }
    }
  };
  ctx.replyWithHTML('Начнём с базовой информации. Герой, монстр или и то, и другое?', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback('✅ Герой', 'actionEmporiumHero'),
      Markup.button.callback('❌ Монстр', 'actionEmporiumMonster'),
      Markup.button.callback('💀 WH', 'actionEmporiumWH'),
      Markup.button.callback('Готово', 'actionEmporiumDone')
    ])
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumTypeStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.reply('Вышел')
  ctx.scene.leave();
})

emporiumTypeStage.action('actionEmporiumHero', (ctx) => {
  let oldValue = ctx.session.emporium.creatureData.isHero;
  ctx.session.emporium.creatureData.isHero = !oldValue;
  ctx.replyWithHTML('Начнём с базовой информации. Герой, монстр или и то, и другое?', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback(`${!oldValue ? '✅' : '❌'} Герой`, 'actionEmporiumHero'),
      Markup.button.callback(`${ctx.session.emporium.creatureData.isMonster ? '✅' : '❌'} Монстр`, 'actionEmporiumMonster'),
      Markup.button.callback('💀 WH', 'actionEmporiumWH'),
      Markup.button.callback('Готово', 'actionEmporiumDone')
    ])
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
  ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
})

emporiumTypeStage.action('actionEmporiumMonster', (ctx) => {
  let oldValue = ctx.session.emporium.creatureData.isMonster;
  ctx.session.emporium.creatureData.isMonster = !oldValue;
  ctx.replyWithHTML('Начнём с базовой информации. Герой, монстр или и то, и другое?', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback(`${ctx.session.emporium.creatureData.isHero ? '✅' : '❌'} Герой`, 'actionEmporiumHero'),
      Markup.button.callback(`${!oldValue ? '✅' : '❌'} Монстр`, 'actionEmporiumMonster'),
      Markup.button.callback('💀 WH', 'actionEmporiumWH'),
      Markup.button.callback('Готово', 'actionEmporiumDone')
    ])
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
  ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
})

emporiumTypeStage.on('message', (ctx) => {
  ctx.replyWithHTML('Отметь нужные пункты в сообщении выше')
})

emporiumTypeStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumTypeStage.action('actionEmporiumDone', (ctx) => {
  util.log(ctx);
  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }
  return ctx.scene.enter('EMPORIUM_STUDIO_NAME_STAGE');
})

emporiumTypeStage.action('actionEmporiumWH', (ctx) => {
  util.log(ctx);
  
  if (ctx.callbackQuery.from.id != SETTINGS.CHATS.EPINETOV && ctx.callbackQuery.from.id != SETTINGS.CHATS.ANN && ctx.callbackQuery.from.id != SETTINGS.CHATS.YURI) {
    return;
  }

  ctx.session.emporium.creatureData.isWH = true;
  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }
  return ctx.scene.enter('EMPORIUM_STUDIO_NAME_STAGE');
})

emporiumTypeStage.leave(async (ctx) => {
});

module.exports = emporiumTypeStage;