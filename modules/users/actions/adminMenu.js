const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('adminMenu', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    await ctx.editMessageText(t('start.menuSelect'), {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('Месяцы', 'adminMonths'),
          Markup.button.callback('Месяцы Плюс', 'adminMonthsPlus')
        ],
        [
          Markup.button.callback('Кикстартеры', 'adminKickstarters'),
          Markup.button.callback('Релизы', 'adminReleases')
        ],
        [
          Markup.button.callback('Люди', 'adminParticipants'),
          Markup.button.callback('Голосования', 'adminPolls'),
        ],
        [
          Markup.button.callback('📋 Управление заявками', 'adminAllApplications'),
          Markup.button.callback('🔍 Поиск пользователя', 'admin_search_user')
        ],
        [
          Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'refreshUserStatus')
        ]
      ])
    });
    
  } catch (error) {
    console.error('Error in adminMenu:', error);
    await ctx.editMessageText(
      require('../../../modules/i18n').t('messages.try_again_later'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'refreshUserStatus')]
        ])
      }
    );
  }
});
