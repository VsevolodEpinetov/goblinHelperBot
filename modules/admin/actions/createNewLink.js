const { Composer, Markup } = require("telegraf");
const { getOrCreateGroupInvitationLink, notifyUsersOfNewLink } = require('../../archive/archiveService');
const { ensureRoles } = require('../../rbac');

const SUPER_ROLES = ['super'];

module.exports = Composer.action(/^createNewLink_(.+)_(.+)$/, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const match = ctx.match;
    const groupPeriod = match[1];
    const groupType = match[2];
    
    console.log(`🔗 Creating new link for ${groupPeriod}_${groupType}`);
    
    // Create new invitation link
    const linkResult = await getOrCreateGroupInvitationLink(groupPeriod, groupType);
    
    if (!linkResult.success) {
      await ctx.editMessageText(
        '❌ <b>Ошибка создания ссылки</b>\n\n' +
        `Не удалось создать ссылку для ${groupPeriod}_${groupType}:\n` +
        `${linkResult.error}`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', 'userMenu')]
          ])
        }
      );
      return;
    }

    // Notify all users who requested notification
    await notifyUsersOfNewLink(ctx.telegram, groupPeriod, groupType, linkResult.link);

    // Show success message to admin
    const successMessage = `✅ <b>Новая ссылка создана!</b>\n\n` +
      `📅 <b>Группа:</b> ${groupPeriod}\n` +
      `🔹 <b>Тип:</b> ${groupType === 'plus' ? '➕ Расширенная' : 'Обычная'}\n\n` +
      `🔗 <b>Новая ссылка:</b>\n` +
      `${linkResult.link}\n\n` +
      `📧 <b>Уведомления:</b>\n` +
      `• Все пользователи, которые ждали обновления ссылки, получили уведомления\n` +
      `• Ссылка готова к использованию\n\n` +
      `💡 <b>Совет:</b> Пользователи могут теперь использовать новую ссылку`;

    await ctx.editMessageText(successMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'userMenu')]
      ])
    });
    
  } catch (error) {
    console.error('Error in createNewLink:', error);
    await ctx.editMessageText(
      '❌ <b>Произошла ошибка</b>\n\n' +
      'Попробуй еще раз позже.',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'userMenu')]
        ])
      }
    );
  }
});
