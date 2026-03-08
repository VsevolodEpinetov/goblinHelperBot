const { Composer } = require("telegraf");
const { ensureRoles } = require('../../rbac');

const REQUESTS_ROLES = ['protector', 'admin', 'adminPlus', 'super'];

module.exports = Composer.action('searchRequest', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}

  const check = await ensureRoles(ctx, REQUESTS_ROLES, { errorMessage: '❌ У вас нет прав для поиска заявок' });
  if (!check.allowed) return;

  // Check if user is in REQUESTS_GROUP_ID
  if (ctx.chat.id.toString() !== process.env.REQUESTS_GROUP_ID) {
    await ctx.reply('❌ Поиск заявок доступен только в группе заявок');
    return;
  }

  // Enter the requests scene
  await ctx.scene.enter('REQUESTS_SCENE');
});
