const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json');
const { getUserDescription } = require("../../../util");
const { getUser, updateUser } = require('../../../db/helpers');
const { getRoleHierarchy } = require('../../../rbac');

// Get list of valid roles
function getValidRoles() {
  const hierarchy = getRoleHierarchy();
  const rolesFromHierarchy = Object.keys(hierarchy);
  // Also include roles that are used but not in hierarchy
  const additionalRoles = ['rejected', 'banned'];
  return [...rolesFromHierarchy, ...additionalRoles].sort();
}

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

  // Extract role name
  if (isRemoving) {
    roleName = ctx.message.text.split('-')[1]?.trim();
  } else {
    roleName = ctx.message.text.trim();
  }

  // Validate role name
  const validRoles = getValidRoles();
  if (!roleName || !validRoles.includes(roleName)) {
    const rolesList = validRoles.map(r => `• <code>${r}</code>`).join('\n');
    try { await ctx.deleteMessage(ctx.message.message_id); } catch {}
    try { await ctx.deleteMessage(ctx.session.toRemove); } catch {}
    
    await ctx.replyWithHTML(
      `❌ <b>Неверная роль:</b> <code>${roleName || ctx.message.text}</code>\n\n` +
      `<b>Доступные роли:</b>\n${rolesList}\n\n` +
      `Для удаления роли начни с '-' (например, -goblin)`,
      {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад к управлению', `admin_manage_user_${userId}`)]
        ])
      }
    );
    ctx.scene.leave();
    return;
  }

  try {
    if (isRemoving) {
      if (userData.roles.indexOf(roleName) > -1) {
        // Remove role using updateUser (which handles userRoles table)
        userData.roles = userData.roles.filter(role => role !== roleName);
        await updateUser(userId, userData);
        message = `Роль <code>${roleName}</code> успешно удалена`;
        await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `❌ ${ctx.message.from.id} REMOVED role ${roleName} from ${userId}`);
      } else {
        message = `Роль <code>${roleName}</code> не найдена у этого пользователя`;
      }
    } else {
      if (userData.roles.indexOf(roleName) < 0) {
        // Add role using updateUser (which handles userRoles table)
        userData.roles.push(roleName);
        await updateUser(userId, userData);
        message = `Роль <code>${roleName}</code> успешно добавлена`;
        await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `✅ ${ctx.message.from.id} ADDED role ${roleName} to ${userId}`);
      } else {
        message = `⚠️ Роль <code>${roleName}</code> уже есть у этого пользователя`;
      }
    }
  } catch (error) {
    // Handle database errors gracefully
    const validRoles = getValidRoles();
    const rolesList = validRoles.map(r => `• <code>${r}</code>`).join('\n');
    
    try { await ctx.deleteMessage(ctx.message.message_id); } catch {}
    try { await ctx.deleteMessage(ctx.session.toRemove); } catch {}
    
    // Check if it's an enum error
    if (error.code === '22P02' || error.message?.includes('invalid input value for enum')) {
      await ctx.replyWithHTML(
        `❌ <b>Ошибка:</b> Роль <code>${roleName}</code> не является допустимым значением.\n\n` +
        `<b>Доступные роли:</b>\n${rolesList}\n\n` +
        `Для удаления роли начни с '-' (например, -goblin)`,
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад к управлению', `admin_manage_user_${userId}`)]
          ])
        }
      );
    } else {
      // Other database errors
      console.error('Error updating user roles:', error);
      await ctx.replyWithHTML(
        `❌ <b>Ошибка при обновлении ролей:</b>\n<code>${error.message}</code>\n\n` +
        `<b>Доступные роли:</b>\n${rolesList}`,
        {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад к управлению', `admin_manage_user_${userId}`)]
          ])
        }
      );
    }
    ctx.scene.leave();
    return;
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
