const { Composer } = require('telegraf');
const db = require('../../../../modules/db/pg');
const util = require('../../../util');

module.exports = Composer.action(/^resendInvite_\d+$/g, async (ctx) => {
	await ctx.answerCbQuery().catch(() => {});
	const userId = ctx.callbackQuery.data.split('_')[1];
	const currentPeriodInfo = util.getCurrentPeriod(ctx);
	const period = currentPeriodInfo.period;
	const type = 'regular';
	try {
		const r = await db.query('SELECT period, type, "chatId" FROM "months" WHERE period=$1 AND type IN (\'regular\',\'plus\')', [period]);
		if (!r.rows.length) return ctx.reply('Чат для текущего периода не настроен');
		for (const row of r.rows) {
			const chatId = row.chatId;
			if (!chatId) continue;
			const invite = await ctx.createChatInviteLink({ chat_id: chatId, name: `Resend single-use ${userId}`, creates_join_request: true, member_limit: 1 });
			await db.query('INSERT INTO "invitationLinks" ("userId", "groupPeriod", "groupType", "createdAt") VALUES ($1,$2,$3, now())', [userId, period, row.type]);
			await ctx.telegram.sendMessage(userId, `Твоя ссылка для вступления (${row.type}): ${invite.invite_link}`);
		}
		await ctx.reply('Ссылка(и) отправлена пользователю');
	} catch (e) {
		console.log('Failed to resend invite', e);
		await ctx.reply('Не удалось отправить ссылку');
	}
});


