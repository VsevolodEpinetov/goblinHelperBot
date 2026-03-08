const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const knex = require('../../../../modules/db/knex');
const { getUser, updateUser } = require('../../../db/helpers');
const { ensureRoles } = require('../../../rbac');
const SETTINGS = require('../../../../settings.json');

const APPLICATIONS_ROLES = ['protector', 'admin', 'adminPlus', 'super'];

// Create a composer that combines all application approval actions
const applicationApprovalComposer = new Composer();

// Handle Accept application (first step - interview approval)
applicationApprovalComposer.action(/^apply_protector_allow_\d+$/, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  
  const check = await ensureRoles(ctx, APPLICATIONS_ROLES, { errorMessage: '❌ У вас нет прав для одобрения заявок' });
  if (!check.allowed) return;

  try {
    // Update application status to approved
    await knex('applications')
      .where({ userId: Number(userId) })
      .update({ status: 'approved', updatedAt: knex.fn.now() });

    // Replace user roles with goblin role
    const targetUserData = await getUser(userId);
    if (targetUserData) {
      targetUserData.roles = ['goblin']; // Replace all roles with just goblin
      await updateUser(userId, targetUserData);
    }

    // Send message to user about goblin role assignment
    await ctx.telegram.sendMessage(Number(userId), 
      '⚖️ <b>Старейшины кивнули!</b>\n\n' +
      'Ты принят в логово гоблинов!\n\n' +
      'Добро пожаловать, новый гоблин! 🎉', 
      { parse_mode: 'HTML' }
    );

    // Update admin message to show application approved
    try {
      await ctx.editMessageReplyMarkup({ 
        inline_keyboard: [[{ text: '✅ Goblin Approved', callback_data: 'dummy' }]] 
      });
    } catch {}

    // Log the goblin approval
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, 
      `⚖️ Goblin approved for user ${userId}`, 
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    console.error('Error in goblin approval:', error);
    await ctx.replyWithHTML('❌ Error approving goblin');
  }
});

applicationApprovalComposer.action(/^apply_protector_deny_\d+$/, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}

  const check = await ensureRoles(ctx, APPLICATIONS_ROLES, { errorMessage: '❌ У вас нет прав для отклонения заявок' });
  if (!check.allowed) return;

  try {
    // Get application data first
    const application = await knex('applications')
      .where({ userId: Number(userId) })
      .first();

    if (!application) {
      await ctx.reply('❌ Заявка не найдена');
      return;
    }

    // Update application status
    await knex('applications')
      .where({ userId: Number(userId) })
      .update({ status: 'rejected', updatedAt: knex.fn.now() });

    // Replace user roles with rejected role
    const targetUserData = await getUser(userId);
    if (targetUserData) {
      targetUserData.roles = ['rejected']; // Replace all roles with just rejected
      await updateUser(userId, targetUserData);
    }

    // Send message to user
    await ctx.telegram.sendMessage(Number(userId), 
'❌ <b>Заявка отклонена</b>\n\n' +
'Совет посмотрел на тебя и расхохотался. Нет тебе дороги в логово.\n\n' +
'Иди к эльфам — там тебя, может, и приголубят.',
      { parse_mode: 'HTML' }
    );

    // Delete the admin message
    try {
      await ctx.deleteMessage();
    } catch (error) {
      console.log('Failed to delete message:', error);
    }

    // Send notification to requests group
    await ctx.telegram.sendMessage(process.env.REQUESTS_GROUP_ID, 
      `❌ <b>Заявка отклонена</b>\n\n` +
      `👤 Пользователь: ${application.firstName || 'Unknown'} (ID: ${userId})\n` +
      `📅 Время: ${new Date().toLocaleString('ru-RU')}\n` +
      `👨‍💼 Отклонил: @${ctx.callbackQuery.from.username || 'Unknown'}`,
      { parse_mode: 'HTML' }
    );

    // Log the denial
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, 
      `❌ Application denied for user ${userId}`, 
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    console.error('Error in application denial:', error);
    await ctx.replyWithHTML('❌ Error denying application');
  }
});

// Handle final approval after interview
applicationApprovalComposer.action(/^admin_final_approve_\d+$/, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}

  const check = await ensureRoles(ctx, APPLICATIONS_ROLES, { errorMessage: '❌ У вас нет прав для финального одобрения заявок' });
  if (!check.allowed) return;

  try {
    // Update application status to approved
    await knex('applications')
      .where({ userId: Number(userId) })
      .update({ status: 'approved', updatedAt: knex.fn.now() });

    // Replace user roles with goblin role
    const userData = await getUser(userId);
    if (userData) {
      userData.roles = ['goblin']; // Replace all roles with just goblin
      await updateUser(userId, userData);
    }

    // Send payment offer to user
    await ctx.telegram.sendMessage(Number(userId), 
      '🔥 <b>Старейшины кивнули!</b>\n\n' +
      'Главгоблин доволен, и дверь почти открыта.\n\n' +
      'Осталось внести взнос в казну:\n' +
      '🔹 350 ⭐ — обычный сундук месяца\n' +
      '🔸 1000 ⭐ — обычный + расширенный сундук (фэнтези + sci-fi, большие фигурки, редкости)\n\n' +
      'Выбирай путь и подтверждай участие.', 
      { 
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Обычная — 350 ⭐️', 'stars_buy_regular'),
            Markup.button.callback('Плюс — 1000 ⭐️', 'stars_buy_plus')
          ]
        ])
      }
    );

    // Update admin message to show final approved
    try {
      await ctx.editMessageReplyMarkup({ 
        inline_keyboard: [[{ text: '✅ Final Approved', callback_data: 'dummy' }]] 
      });
    } catch {}

    // Log the final approval
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, 
      `🔥 Final approval for user ${userId} - payment offer sent`, 
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    console.error('Error in final approval:', error);
    await ctx.replyWithHTML('❌ Error in final approval');
  }
});

// Handle final denial after interview (ban the user)
applicationApprovalComposer.action(/^admin_final_deny_\d+$/, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}

  const check = await ensureRoles(ctx, APPLICATIONS_ROLES, { errorMessage: '❌ У вас нет прав для финального отклонения заявок' });
  if (!check.allowed) return;

  try {
    // Update application status to rejected
    await knex('applications')
      .where({ userId: Number(userId) })
      .update({ status: 'rejected', updatedAt: knex.fn.now() });

    // Replace user roles with banned role
    const userData = await getUser(userId);
    if (userData) {
      userData.roles = ['banned']; // Replace all roles with just banned
      await updateUser(userId, userData);
    }

    // Send rejection message to user
    await ctx.telegram.sendMessage(Number(userId), 
      '💀 <b>Ты предстал перед советом, но их вердикт суров.</b>\n\n' +
      'Старейшины отвернулись, а дверь захлопнулась.\n\n' +
      'Твоего имени не будет в хрониках гоблинов.\n' +
      'Ступай прочь.', 
      { parse_mode: 'HTML' }
    );

    // Update admin message to show final denied
    try {
      await ctx.editMessageReplyMarkup({ 
        inline_keyboard: [[{ text: '❌ Final Denied (Banned)', callback_data: 'deleteThisMessage' }]] 
      });
    } catch {}

    // Log the final denial
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, 
      `💀 Final denial for user ${userId} - user banned`, 
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    console.error('Error in final denial:', error);
    await ctx.replyWithHTML('❌ Error in final denial');
  }
});

// Catch-all action removed - it was intercepting specific action handlers

// Export the combined composer
module.exports = applicationApprovalComposer;
