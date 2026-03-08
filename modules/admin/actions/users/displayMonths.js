const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getUser } = require('../../../db/helpers');
const { ensureRoles } = require('../../../rbac');

const SUPER_ROLES = ['super'];

module.exports = Composer.action(/^showUserMonths_/g, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;

  const userId = ctx.callbackQuery.data.split('_')[1];
  const userData = await getUser(userId);
  
  if (!userData) {
    await ctx.editMessageText('Пользователь не найден');
    return;
  }

  ctx.editMessageText(`Информация о месяцах ${userData.username != 'not_set' ? `@${userData.username}` : userData.first_name}\n\n<b>Обычные:</b> ${userData.purchases.groups.regular.join(', ')}\nПлюсовые: ${userData.purchases.groups.plus.join(', ')}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(`Добавить`, `addUserMonth_${userId}`),
        Markup.button.callback(`Убрать`, `removeUserMonth_${userId}`),
      ],
      [
        Markup.button.callback('←', `showUser_${userId}`),
        Markup.button.callback('В начало', `userMenu`)
      ]
    ])
  })
});