const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const STUDIOS = require('../studios.json');
const util = require('../../util.js')

const emporiumStudioNameStage = new Scenes.BaseScene('EMPORIUM_STUDIO_NAME_STAGE');

function createStringWithKeys(json) {
  let keysString = "";

  for (let key in json) {
    keysString += `<code>${key}</code>\n`;
  }

  return keysString;
}

function generateRandomString(json) {
  let randomString;

  do {
    randomString = String(Math.floor(100 + Math.random() * 900)); // Generate a random 3-digit string
  } while (Object.values(json).some(item => item.code === randomString)); // Check if the string already exists in the JSON object

  return randomString;
}

emporiumStudioNameStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.reply('Вышел')
  ctx.scene.leave();
})

emporiumStudioNameStage.enter((ctx) => {
  let json = ctx.globalSession.emporium.studios ? ctx.globalSession.emporium.studios : STUDIOS;
  const studios = createStringWithKeys(json);
  ctx.replyWithHTML(`Напиши название студии. \n\nОчень важно писать названия в едином стиле, так как на основании этого выдаётся артикул. Если нужной студии нет, то напиши её название, ей выдастся новый номер. Если она уже есть в списке, то просто скопируй название. \n\nДоступные студии:\n${studios}`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumStudioNameStage.on('message', (ctx) => {
  ctx.session.emporium.creatureData.studioName = ctx.message.text;
  if (ctx.globalSession.emporium.studios[ctx.message.text]) {
    ctx.session.emporium.creatureData.code = ctx.globalSession.emporium.studios[ctx.message.text].code;
  } else {
    const newCode = generateRandomString(ctx.globalSession.emporium.studios);
    ctx.session.emporium.creatureData.code = newCode;
    ctx.globalSession.emporium.studios[ctx.message.text] = {
      code: newCode,
      releases: {}
    };
  }
  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }
  ctx.scene.enter('EMPORIUM_RELEASE_NAME_STAGE')
})


emporiumStudioNameStage.leave(async (ctx) => {
});

module.exports = emporiumStudioNameStage;