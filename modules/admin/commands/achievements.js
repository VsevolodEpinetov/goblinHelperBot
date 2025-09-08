const { Composer } = require('telegraf');
const { getUser } = require('../../db/helpers');
const { grantAchievement, revokeAchievement, YEARS_OF_SERVICE } = require('../../loyalty/achievementsService');

const cmd = new Composer();

cmd.command('grant_years', async (ctx) => {
  const admin = await getUser(ctx.message.from.id);
  if (!admin || !admin.roles || !admin.roles.includes('admin')) return;

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 1) {
    await ctx.replyWithHTML('Использование: <code>/grant_years &lt;user_id&gt;</code>');
    return;
  }
  const targetId = Number(args[0]);
  if (!targetId) {
    await ctx.reply('Некорректный user_id');
    return;
  }
  await grantAchievement(ctx.from.id, targetId, YEARS_OF_SERVICE, { reason: 'Manual grant' });
  await ctx.reply(`✅ Выдана ачивка За выслугу лет пользователю ${targetId}`);
});

cmd.command('revoke_years', async (ctx) => {
  const admin = await getUser(ctx.message.from.id);
  if (!admin || !admin.roles || !admin.roles.includes('admin')) return;

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 1) {
    await ctx.replyWithHTML('Использование: <code>/revoke_years &lt;user_id&gt;</code>');
    return;
  }
  const targetId = Number(args[0]);
  if (!targetId) {
    await ctx.reply('Некорректный user_id');
    return;
  }
  await revokeAchievement(ctx.from.id, targetId, YEARS_OF_SERVICE);
  await ctx.reply(`✅ Отозвана ачивка За выслугу лет у пользователя ${targetId}`);
});

module.exports = cmd;


