const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('showRules', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  // Step 3: Rules explanation
  const rulesMessage = t('messages.rules');

  await ctx.editMessageText(rulesMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(t('messages.ready'), 'readyToParticipate')]
    ])
  });
});


