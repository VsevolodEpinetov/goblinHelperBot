const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const emporiumClassesStage = new Scenes.BaseScene('EMPORIUM_CLASSES_STAGE');

const classesHeroes = [
  'alchemist',
  'bard',
  'barbarian',
  'battle-master-fighter',
  'beast-ranger',
  'blood-hunter',
  'cleric',
  'cleric-death',
  'cleric-life',
  'conjuration-wizard',
  'corsair',
  'druid',
  'drunken-monk',
  'evocation-wizard',
  'fighter',
  'gladiator',
  'gloom-ranger',
  'monk',
  'necromancy-wizard',
  'ninja',
  'oathbreaker-paladin',
  'paladin',
  'rogue',
  'ranger',
  'shaman',
  'smith-artificer',
  'sorcerer',
  'spellsword',
  'storm-sorcery',
  'trickster-rogue',
  'warlock',
  'wild-sorcerer',
  'wizard'
];

const classesMonsters = [
  'aberration',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fae',
  'fiend',
  'humanoid',
  'monster',
  'plant',
  'slime',
  'undead',
  'velican'
];

emporiumClassesStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumClassesStage.enter((ctx) => {
  const creatureData = ctx.session.emporium.creatureData;
  ctx.replyWithHTML(`Записал указанные тобой расы:${creatureData.races.map(r => `${r} `).join('')}\nНапиши классы существа.\n\nДоступные для твоего типа (${creatureData.isHero ? 'Герой ' : ''}${creatureData.isMonster ? 'Монстр' : ''}):${creatureData.isHero ? classesHeroes.map(cl => `\n<code>${cl},</code>`).join('') : ''}${creatureData.isMonster ? classesMonsters.map(cl => `\n<code>${cl},</code>`).join('') : ''}`, {
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
      if (classesHeroes.includes(classItem)) {
        validClasses.push(classItem);
      }
    });
  } else if (ctx.session.emporium.creatureData.isMonster) {
    classesArray.forEach((classItem) => {
      if (classesMonsters.includes(classItem)) {
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
    ctx.scene.enter('EMPORIUM_CLASSES_PHOTO');
  }
});


emporiumClassesStage.leave(async (ctx) => {
});

module.exports = emporiumClassesStage;