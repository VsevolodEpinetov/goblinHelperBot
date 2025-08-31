const { Composer, Markup } = require('telegraf');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('showRules', async (ctx) => {
	console.log('rules')
	try { await ctx.answerCbQuery(); } catch {}
	const text = t('rules.full') || t('rules.text');
	if (ctx.callbackQuery && ctx.callbackQuery.message) {
		await ctx.editMessageText(text, {
			parse_mode: 'HTML',
			...Markup.inlineKeyboard([
				[Markup.button.callback(t('start.buttons.back'), 'guestStart')]
			])
		});
		return;
	}
	await ctx.replyWithHTML(text);
});


