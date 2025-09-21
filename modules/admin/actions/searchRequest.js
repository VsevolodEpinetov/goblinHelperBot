const { Composer } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { hasPermission } = require('../../rbac');

module.exports = Composer.action('searchRequest', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  // Check permissions
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:requests:view')) {
    await ctx.reply('❌ У вас нет прав для поиска заявок');
    return;
  }

  // Check if user is in REQUESTS_GROUP_ID
  if (ctx.chat.id.toString() !== process.env.REQUESTS_GROUP_ID) {
    await ctx.reply('❌ Поиск заявок доступен только в группе заявок');
    return;
  }

  // Enter the requests scene
  await ctx.scene.enter('REQUESTS_SCENE');
});
