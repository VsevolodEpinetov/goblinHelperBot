const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json');
const { getUserDescription } = require("../../../util");
const { getUser, updateUser } = require('../../../db/helpers');

const changeRoles = new Scenes.BaseScene('ADMIN_SCENE_CHANGE_USER_ROLES');

changeRoles.enter(async (ctx) => {
  const msg = `Пришли <b>название роли</b>, которую ты хочешь добавить.\nЕсли хочешь удалить роль, начни с '-' (например, -goblin).`;
  const nctx = await ctx.replyWithHTML(msg, {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'cancel_change_roles')]
    ])
  });
  ctx.session.toRemove = nctx.message_id;
  ctx.session.chatID = nctx.chat.id;
});

changeRoles.action('cancel_change_roles', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  try { if (ctx.session?.toRemove) await ctx.deleteMessage(ctx.session.toRemove); } catch {}
  await ctx.replyWithHTML('Отменено', {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад к управлению', `admin_manage_user_${ctx.userSession?.userId || ''}`)]
    ])
  });
  return ctx.scene.leave();
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

  try { await ctx.deleteMessage(ctx.message.message_id); } catch {}
  try { await ctx.deleteMessage(ctx.session.toRemove); } catch {}

  await ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Назад к управлению', `admin_manage_user_${userId}`)]
    ])
  });
  ctx.scene.leave();
});

changeRoles.command('exit', ctx => {
  ctx.scene.leave();
})

module.exports = changeRoles;
