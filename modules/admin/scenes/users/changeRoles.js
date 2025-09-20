const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json');
const { getUserMenu, getUserDescription } = require("../../../util");
const { getUser, updateUser } = require('../../../db/helpers');

const changeRoles = new Scenes.BaseScene('ADMIN_SCENE_CHANGE_USER_ROLES');

changeRoles.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>название роли</b>, которую ты хочешь добавить. Если хочешь удалить роль, то начни название с '-'`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

changeRoles.on('text', async (ctx) => {
  const isRemoving = ctx.message.text.indexOf('-') > -1 ? true : false;
  const userId = ctx.userSession.userId;
  let roleName, message;

  // Get current user data
  const userData = await getUser(userId);
  if (!userData) {
    await ctx.replyWithHTML('Пользователь не найден');
    ctx.scene.leave();
    return;
  }

  if (isRemoving) {
    roleName = ctx.message.text.split('-')[1];
    if (userData.roles.indexOf(roleName) > -1) {
      // Remove role using updateUser (which handles userRoles table)
      userData.roles = userData.roles.filter(role => role !== roleName);
      await updateUser(userId, userData);
      message = `Роль ${roleName} успешно удалена`
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `❌ ${ctx.message.from.id} REMOVED role ${roleName} from ${userId}`)
    } else {
      message = `Роль ${roleName} не найдена`
    }
  } else {
    roleName = ctx.message.text;
    if (userData.roles.indexOf(roleName) < 0) {
      // Add role using updateUser (which handles userRoles table)
      userData.roles.push(roleName);
      await updateUser(userId, userData);
      message = `Роль ${roleName} успешно добавлена`
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `✅ ${ctx.message.from.id} ADDED role ${roleName} to ${userId}`)
    } else {
      message = `⚠️ Роль ${roleName} уже есть у этого пользователя`
    }
  }

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);
  
  const userDescription = await getUserDescription(ctx, userId);
  ctx.replyWithHTML(message + ' ' + userDescription, {
    ...Markup.inlineKeyboard(getUserMenu(userId))
  })
  ctx.scene.leave();
});

changeRoles.command('exit', ctx => {
  ctx.scene.leave();
})

module.exports = changeRoles;
