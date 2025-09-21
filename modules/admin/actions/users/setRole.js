const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const { t } = require('../../../../modules/i18n');
const db = require('../../../../modules/db/pg');
const knex = require('../../../../modules/db/knex');
const { notion, databaseId, safeUpdatePage } = require('../../../../modules/integrations/notion');
const SETTINGS = require('../../../../settings.json');
const { getUser, updateUser } = require('../../../db/helpers');

// Create a composer that combines all role actions
const setRoleComposer = new Composer();

// Обработчики ролей
setRoleComposer.action(/^setRole_[a-zA-Z]+_[0-9]+/, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_')[2];
  const roleName = ctx.callbackQuery.data.split('_')[1];

  let roleText = 'no_name';

  switch (roleName) {
    case 'goblin':
      roleText = t('roles.goblin')
      break;
    case 'rejected':
      roleText = t('roles.rejected')
      break;
    case 'admin':
      roleText = t('roles.admin')
      break;
    case 'adminPlus':
      roleText = t('roles.adminPlus')
      break;
    case 'banned':
      roleText = t('roles.banned')
      break;
  }

  // Get current user data
  const userData = await getUser(userId);
  if (!userData) {
    await ctx.replyWithHTML('Пользователь не найден');
    return;
  }

  if (userData.roles.indexOf(roleName) < 0) {
    userData.roles.push(roleName);
    await updateUser(userId, userData);
    await ctx.replyWithHTML(t('notify.roleAssigned', { userId, role: roleText }));
    if (roleName !== 'rejected' && roleName !== 'banned') {
      await ctx.telegram.sendMessage(userId, t('notify.userApproved', { role: roleText }))
    }
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got role ${roleName}`)

    try {
      const status = roleName === 'rejected' ? 'rejected' : roleName === 'banned' ? 'banned' : 'approved';
      await knex('applications')
        .where({ userId: Number(userId) })
        .update({ status, updatedAt: knex.fn.now() });
      // Persist role into userRoles explicitly
      await knex('userRoles').insert({ userId: Number(userId), role: roleName })
        .onConflict(['userId','role']).ignore();
    } catch (e) {
      console.log('Failed to update application/roles via Knex', e);
    }

    // Notion update (best-effort): find latest page by username/userId is non-trivial without a property filter
    // If you add a relation key later, we can store pageId. For now, skip fetching and only log intent.
    try {
      // Placeholder: if in future we store pageId in PG, call safeUpdatePage(pageId, { status: { select: { name: status } }, updatedAt: { date: { start: new Date().toISOString() } } })
    } catch {}
  } else {
    await ctx.replyWithHTML(t('notify.alreadyHasRole', { userId, role: roleText }));
  }
});

// Admin two-step approval flow
setRoleComposer.action(/^apply_admin_firstapprove_\d+$/, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  await ctx.telegram.sendMessage(Number(userId), t('apply.firstApproved', { councilContact: '@username' }));
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [[{ text: '✅ Approve (final)', callback_data: `apply_admin_finalapprove_${userId}` }, { text: '❌ Deny (final)', callback_data: `apply_admin_finaldeny_${userId}` }]] });
  } catch {}
});

setRoleComposer.action(/^apply_admin_firstdeny_\d+$/, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  await ctx.telegram.sendMessage(Number(userId), t('apply.finalDenied'));
  try {
    // Add banned role directly to database
    await knex('userRoles').insert({ userId: Number(userId), role: 'banned' }).onConflict(['userId','role']).ignore();
  } catch {}
});

setRoleComposer.action(/^apply_admin_finalapprove_\d+$/, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  await ctx.telegram.sendMessage(Number(userId), t('apply.finalApproved'), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Обычная — 350 ⭐️', callback_data: 'stars_buy_regular' }],
        [{ text: 'Плюс — 1000 ⭐️', callback_data: 'stars_buy_plus' }]
      ]
    }
  });
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch {}
});

setRoleComposer.action(/^apply_admin_finaldeny_\d+$/, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  await ctx.telegram.sendMessage(Number(userId), t('apply.finalDenied'));
  try {
    // Add banned role directly to database
    await knex('userRoles').insert({ userId: Number(userId), role: 'banned' }).onConflict(['userId','role']).ignore();
  } catch {}
});

// Export the combined composer
module.exports = setRoleComposer;