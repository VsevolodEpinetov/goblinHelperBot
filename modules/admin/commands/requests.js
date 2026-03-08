const { Composer } = require("telegraf");
const { ensureRoles } = require('../../rbac');

const REQUESTS_ROLES = ['protector', 'admin', 'adminPlus', 'super'];

module.exports = Composer.command('requests', async (ctx) => {
  if (ctx.chat.id.toString() !== process.env.REQUESTS_GROUP_ID) {
    return;
  }

  const check = await ensureRoles(ctx, REQUESTS_ROLES, { errorMessage: '❌ У вас нет прав для работы с заявками' });
  if (!check.allowed) return;

  await ctx.scene.enter('REQUESTS_SCENE');
});
