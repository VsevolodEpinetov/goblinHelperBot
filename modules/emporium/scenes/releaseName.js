const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const emporiumReleaseNameStage = new Scenes.BaseScene('EMPORIUM_RELEASE_NAME_STAGE');

function createStringWithKeys(json) {
  let keysString = "";

  for (let key in json) {
    keysString += `<code>${key}</code>\n`;
  }

  return keysString.length > 0 ? keysString : '<i>У этой студии ещё нет релизов</i>';
}

function generateReleaseCode(json) {
  const keys = Object.keys(json);
  
  const newString = formatIntegerToThreeDigits(keys.length + 1);
  return newString;
}

function formatIntegerToThreeDigits(number) {
  // Convert the number to a string
  const numberString = number.toString();

  // Check if the number has fewer than 3 digits
  if (numberString.length < 3) {
    // Pad the number with leading zeros until it has 3 digits
    const paddedNumberString = numberString.padStart(3, '0');
    return paddedNumberString;
  }

  // If the number already has 3 digits, return it as is
  return numberString;
}

function findMinimalAvailableCode(arrayOfCodes) {
  const existingCodes = new Set(arrayOfCodes);

  // Iterate from 1 to 999 and find the smallest available code
  for (let i = 1; i <= 999; i++) {
    const code = i.toString().padStart(3, '0');
    if (!existingCodes.has(code)) {
      return code;
    }
  }

  // If no available code is found, return null or throw an error
  return null;
}

emporiumReleaseNameStage.enter((ctx) => {
  const releases = createStringWithKeys(ctx.globalSession.emporium.studios[ctx.session.emporium.creatureData.studioName].releases);
  ctx.replyWithHTML(`Записал, что это релиз студии "${ctx.session.emporium.creatureData.studioName}" с кодом ${ctx.session.emporium.creatureData.code}. \n\nПо тому же принципу теперь нужно написать название релиза.\n\nУже имеющиеся в базе релизы:\n${releases}`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumReleaseNameStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumReleaseNameStage.on('message', (ctx) => {
  const studioName = ctx.session.emporium.creatureData.studioName;
  const releaseName = ctx.message.text;
  const studioCode = ctx.session.emporium.creatureData.code; // because it already was previously assigned
  ctx.session.emporium.creatureData.releaseName = releaseName;
  if (ctx.globalSession.emporium.studios[studioName].releases[releaseName]) {
    const releaseCode = ctx.globalSession.emporium.studios[studioName].releases[releaseName].code;
    const stlCode = findMinimalAvailableCode(ctx.globalSession.emporium.studios[studioName].releases[releaseName].stls)
    ctx.globalSession.emporium.studios[studioName].releases[releaseName].stls.push(stlCode);
    ctx.session.emporium.creatureData.code = `${studioCode}${releaseCode}${stlCode}`;
  } else {
    const newCode = generateReleaseCode(ctx.globalSession.emporium.studios[studioName].releases);
    ctx.session.emporium.creatureData.code = `${studioCode}${newCode}001`;
    ctx.globalSession.emporium.studios[studioName].releases[releaseName] = {
      code: newCode,
      stls: [ "001" ]
    };
  }
  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }
  ctx.scene.enter('EMPORIUM_SEX_STAGE')
})

emporiumReleaseNameStage.leave(async (ctx) => {
});

module.exports = emporiumReleaseNameStage;