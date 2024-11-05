const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('adminRemind', async (ctx) => {
  const currentYear = ctx.globalSession.current.year, currentMonth = ctx.globalSession.current.month;
  const current = `${currentYear}_${currentMonth}`
  let counter = 0, failed = 0;
  let usernames = [], failedUsernames = [];

  for (const userId in ctx.users.list) {
    //ctx.users.list[userId].purchases.groups[type].push(`${year}_${month}`);
    const userData = ctx.users.list[userId];
    const isPurchased = userData.purchases.groups.regular.includes(current) || userData.roles.includes('admin') || userData.roles.includes('adminPlus');
    if (!isPurchased) {
      if (userData.roles.includes('goblin') && !userData.roles.includes('rejected')) {
        try {
          await ctx.telegram.sendMessage(userData.id, `Пришла пора платить за ${currentYear}-${currentMonth}!`, {
            ...Markup.inlineKeyboard([
              Markup.button.callback('Действительно 💁‍♂️', `sendPayment_currentMonth`)
            ])
          })
          usernames.push(userData.username !== 'not_set' ? userData.username : `${userData.first_name} ${userData.last_name}`)
          counter++;
        } catch (e) {
          failedUsernames.push(userData.username !== 'not_set' ? userData.username : `${userData.first_name} ${userData.last_name}`)
          failed++;
        }
      }
    }
  }

  await ctx.editMessageText(`🔔 <b>Напоминалки</b>\n\nОтправлены: ${counter}\nС ошибкой:${failed}\n\n<u>Напомнил:</u>\n${usernames.join('\n')}\n\n<u>Хотел, но не смог:</u>\n${failedUsernames.join('\n')}`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('Месяцы', 'adminMonths'),
        Markup.button.callback('🔔 Напомнить', 'adminRemind')
      ],
      [
        Markup.button.callback('Кикстартеры', 'adminKickstarters'),
        Markup.button.callback('Релизы', 'adminReleases')
      ],
      [
        Markup.button.callback('Люди', 'adminParticipants'),
        Markup.button.callback('Голосования', 'adminPolls'),
      ]
    ])
  })
});