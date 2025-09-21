const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const knex = require('../../../../modules/db/knex');
const { getUser, updateUser } = require('../../../db/helpers');
const { hasPermission } = require('../../../rbac');
const SETTINGS = require('../../../../settings.json');

// Handle Accept application (first step - interview approval)
module.exports = Composer.action(/^apply_admin_accept_\d+$/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  
  // Check permissions
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:applications:approve')) {
    await ctx.reply('❌ У вас нет прав для одобрения заявок');
    return;
  }
  
  try {
    // Update application status to interview
    await knex('applications')
      .where({ userId: Number(userId) })
      .update({ status: 'interview', updatedAt: knex.fn.now() });

    // Send message to user about interview
    await ctx.telegram.sendMessage(Number(userId), 
      '⚖️ <b>Старейшины кивнули!</b>\n\n' +
      'Ты допущен к собеседованию.\n\n' +
      'Напиши сюда 👉 @lalaal (человек из совета),\n' +
      'и обговори все условия.', 
      { parse_mode: 'HTML' }
    );

    // Update admin message to show interview approved
    try {
      await ctx.editMessageReplyMarkup({ 
        inline_keyboard: [[{ text: '✅ Interview Approved', callback_data: 'deleteThisMessage' }]] 
      });
    } catch {}

    // Log the interview approval
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, 
      `⚖️ Interview approved for user ${userId}`, 
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    console.error('Error in interview approval:', error);
    await ctx.replyWithHTML('❌ Error approving interview');
  }
});

// Handle Deny application
module.exports = Composer.action(/^apply_admin_deny_\d+$/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  
  // Check permissions
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:applications:deny')) {
    await ctx.reply('❌ У вас нет прав для отклонения заявок');
    return;
  }
  
  try {
    // Update application status
    await knex('applications')
      .where({ userId: Number(userId) })
      .update({ status: 'rejected', updatedAt: knex.fn.now() });

    // Add rejected role to user
    await knex('userRoles').insert({ userId: Number(userId), role: 'rejected' })
      .onConflict(['userId','role']).ignore();

    // Update user data
    const userData = await getUser(userId);
    if (userData) {
      if (userData.roles.indexOf('rejected') < 0) {
        userData.roles.push('rejected');
        await updateUser(userId, userData);
      }
    }

    // Send message to user
    await ctx.telegram.sendMessage(Number(userId), 
'❌ <b>Заявка отклонена</b>\n\n' +
'Совет посмотрел на тебя и расхохотался. Нет тебе дороги в логово.\n\n' +
'Иди к эльфам — там тебя, может, и приголубят.',
      { parse_mode: 'HTML' }
    );

    // Update admin message to show denied
    try {
      await ctx.editMessageReplyMarkup({ 
        inline_keyboard: [[{ text: '❌ Denied', callback_data: 'deleteThisMessage' }]] 
      });
    } catch {}

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
module.exports = Composer.action(/^admin_final_approve_\d+$/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  
  // Check permissions
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:applications:approve')) {
    await ctx.reply('❌ У вас нет прав для финального одобрения заявок');
    return;
  }
  
  try {
    // Update application status to approved
    await knex('applications')
      .where({ userId: Number(userId) })
      .update({ status: 'approved', updatedAt: knex.fn.now() });

    // Add goblin role to user
    await knex('userRoles').insert({ userId: Number(userId), role: 'goblin' })
      .onConflict(['userId','role']).ignore();

    // Update user data
    const userData = await getUser(userId);
    if (userData) {
      if (userData.roles.indexOf('goblin') < 0) {
        userData.roles.push('goblin');
        await updateUser(userId, userData);
      }
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
        inline_keyboard: [[{ text: '✅ Final Approved', callback_data: 'deleteThisMessage' }]] 
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
module.exports = Composer.action(/^admin_final_deny_\d+$/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  
  // Check permissions
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:applications:deny')) {
    await ctx.reply('❌ У вас нет прав для финального отклонения заявок');
    return;
  }
  
  try {
    // Update application status to rejected
    await knex('applications')
      .where({ userId: Number(userId) })
      .update({ status: 'rejected', updatedAt: knex.fn.now() });

    // Add banned role to user
    await knex('userRoles').insert({ userId: Number(userId), role: 'banned' })
      .onConflict(['userId','role']).ignore();

    // Update user data
    const userData = await getUser(userId);
    if (userData) {
      if (userData.roles.indexOf('banned') < 0) {
        userData.roles.push('banned');
        await updateUser(userId, userData);
      }
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
