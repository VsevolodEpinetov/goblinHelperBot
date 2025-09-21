const { Composer } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { hasPermission } = require('../../rbac');

module.exports = Composer.command('requests', async (ctx) => {
  // Check if command is executed in REQUESTS_GROUP_ID
  if (ctx.chat.id.toString() !== process.env.REQUESTS_GROUP_ID) {
    return; // Silently ignore if not in the requests group
  }

  // Check permissions
  const userData = await getUser(ctx.message.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:requests:view')) {
    await ctx.reply('❌ У вас нет прав для работы с заявками');
    return;
  }

  // Enter the requests scene
  await ctx.scene.enter('REQUESTS_SCENE');
});
