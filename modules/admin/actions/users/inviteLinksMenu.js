const { Composer, Markup } = require('telegraf');
const knex = require('../../../../modules/db/knex');
const { ensureRoles } = require('../../../rbac');

const SUPER_ROLES = ['super'];

module.exports = Composer.action('adminInviteLinksMenu', async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;

	await ctx.answerCbQuery().catch(() => {});
	const rows = await knex('invitationLinks')
		.select('id', 'userId', 'groupPeriod', 'groupType', 'createdAt', 'usedAt')
		.orderBy('id', 'desc')
		.limit(10);
	let text = 'Последние 10 ссылок:\n\n';
	for (const r of rows) {
		text += `#${r.id} uid=${r.userId} ${r.groupPeriod} ${r.groupType} ${r.usedAt ? 'USED' : 'ACTIVE'}\n`;
	}
	await ctx.editMessageText(text, {
		parse_mode: 'HTML',
		...Markup.inlineKeyboard([
			[ Markup.button.callback('← Назад', 'adminParticipants') ]
		])
	});
});
