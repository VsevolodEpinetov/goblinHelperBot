const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const STUDIOS = require('../studios.json')
const util = require('../../util');
const { default: axios } = require("axios");

module.exports = Composer.command('test', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.from.id != SETTINGS.CHATS.EPINETOV
  ) { return; }

  try {
    const classes = ['wizard']
    const races = ['wolfkin']
    const result = await axios.get('https://cloud-api.yandex.net/v1/disk/resources?path=/backgrounds&limit=1000', {
      headers: { "Authorization": `OAuth y0_AgAAAAAAzokZAADLWwAAAADoXb4N626pO17-T8WqpFQc-mebsClaygg` }
    });

    const files = result.data['_embedded'].items.map(img => {
      return {
        name: img.name,
        link: img.file
      }
    })

    console.log(files)

    let filteredFiles = files.filter((file) => {
      const classMatches = classes.some((className) => {
        console.log(file.name + ' and ' + className + '?' + file.name.includes(className))
        return file.name.includes(className);
      });
      const raceMatches = races.some((raceName) => file.name.includes(raceName));
      return classMatches || raceMatches;
    });

    if (filteredFiles.length === 0) {
      console.log('no matching bg found')
      filteredFiles = files
    }

    const randomIndex = Math.floor(Math.random() * filteredFiles.length);
    const randomFile = filteredFiles[randomIndex];
    //const imagePath = path.join(folderPath, randomFile);

    console.log(randomFile.link)
  } catch (err) {
    console.log(err)
    ctx.reply('error')
  }
})