const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js');
const { default: axios } = require("axios");

const emporiumClassesStage = new Scenes.BaseScene('EMPORIUM_CLASSES_STAGE');

emporiumClassesStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumClassesStage.enter(async (ctx) => {
  const api = axios.create({
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TOKEN_GET_FILTERS}`
    },
  });
  const data = await api.get('https://api.stl-emporium.ru/api/classes?fields[0]=value&fields[1]=label&pagination[pageSize]=100');
  let classesHeroes = data.data.data.map(r => r.attributes.value).sort();
  ctx.session.classesHeroes = classesHeroes;
  const dataMonster = await api.get('https://api.stl-emporium.ru/api/monster-types?fields[0]=value&fields[1]=label&pagination[pageSize]=100');
  const classesMonsters = dataMonster.data.data.map(r => r.attributes.value).sort();
  ctx.session.classesMonsters = classesMonsters;
  const creatureData = ctx.session.emporium.creatureData;
  ctx.replyWithHTML(`Записал указанные тобой расы:${creatureData.races.map(r => `${r} `).join(' ')}\nНапиши классы существа.\n\nДоступные для твоего типа (${creatureData.isHero ? 'Герой ' : ''}${creatureData.isMonster ? 'Монстр' : ''}):${creatureData.isHero ? classesHeroes.map(cl => `\n<code>${cl},</code>`).join('') + `${creatureData.isMonster ? '\n\n' : ''}` : ''}${creatureData.isMonster ? classesMonsters.map(cl => `\n<code>${cl},</code>`).join('') : ''}`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumClassesStage.on('message', (ctx) => {
  const data = ctx.message.text.replace(/\s/g, '');
  const classesArray = data.split(',').filter((item) => item !== ''); // Remove empty parts
  const validClasses = [];

  if (ctx.session.emporium.creatureData.isHero) {
    classesArray.forEach((classItem) => {
      if (ctx.session.classesHeroes.includes(classItem)) {
        validClasses.push(classItem);
      }
    });
  } 
  if (ctx.session.emporium.creatureData.isMonster) {
    classesArray.forEach((classItem) => {
      if (ctx.session.classesMonsters.includes(classItem)) {
        validClasses.push(classItem);
      }
    });
  }

  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }

  if (validClasses.length === 0) {
    ctx.reply('Указанные тобой классы не существуют на сайте.');
    ctx.scene.enter('EMPORIUM_CLASSES_STAGE');
  } else {
    ctx.session.emporium.creatureData.classes = validClasses;
    ctx.scene.enter('EMPORIUM_CLASSES_WEAPONS');
  }
});


emporiumClassesStage.leave(async (ctx) => {
});

module.exports = emporiumClassesStage;