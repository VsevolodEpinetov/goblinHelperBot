const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const db = require('../../../modules/db/pg');
const knex = require('../../../modules/db/knex');
const { safeCreatePage } = require('../../../modules/integrations/notion');
const SETTINGS = require('../../../settings.json');
const { updateUser } = require('../../db/helpers');

module.exports = Composer.action('applyYes', async (ctx) => {
  const userId = ctx.callbackQuery.from.id;
  const toRemove = ctx.callbackQuery.message.message_id;

  const userData = {
    id: userId,
    username: ctx.callbackQuery.from.username || 'not_set',
    first_name: ctx.callbackQuery.from.first_name,
    last_name: ctx.callbackQuery.from.last_name || '',
    dateAdded: new Date().toISOString(),
    roles: [],
    purchases: {
      kickstarters: [],
      groups: {
        regular: [],
        plus: [],
        special: []
      },
      collections: [],
      balance: 0,
      releases: {},
      scrollsSpent: 0
    }
  };

  // Save user to database
  await updateUser(userId, userData);

  try {
    // Explicit upserts via Knex
    const baseUser = {
      id: Number(userId),
      username: ctx.callbackQuery.from.username || null,
      firstName: ctx.callbackQuery.from.first_name || null,
      lastName: ctx.callbackQuery.from.last_name || null
    };
    await knex('users').insert(baseUser)
      .onConflict('id').merge(baseUser);

    await knex('userPurchases').insert({ userId: Number(userId), balance: 0, scrollsSpent: 0 })
      .onConflict('userId').merge();

    await knex('applications').insert({
      userId: Number(userId),
      username: ctx.callbackQuery.from.username || null,
      firstName: ctx.callbackQuery.from.first_name || null,
      lastName: ctx.callbackQuery.from.last_name || null,
      status: 'pending'
    });
  } catch (e) {
    console.log('Failed to upsert user/application via Knex', e);
  }

  try {
    await safeCreatePage({
      username: { title: [{ text: { content: ctx.callbackQuery.from.username || 'no-username' } }] },
      userId: { number: Number(userId) },
      firstName: { rich_text: [{ text: { content: ctx.callbackQuery.from.first_name || '' } }] },
      lastName: { rich_text: [{ text: { content: ctx.callbackQuery.from.last_name || '' } }] },
      status: { select: { name: 'pending' } },
      createdAt: { date: { start: new Date().toISOString() } },
      updatedAt: { date: { start: new Date().toISOString() } },
      notes: { rich_text: [{ text: { content: '' } }] },
    });
  } catch (e) {
    console.log('Notion create failed (skipped if not configured)', e.message || e);
  }

  const adminMessage = `<b>Новый запрос на добавление:</b>\n` +
    `<b>ID:</b> ${userId}\n` +
    `<b>Имя:</b> ${ctx.callbackQuery.from.first_name}\n` +
    `<b>Фамилия:</b> ${ctx.callbackQuery.from.last_name || 'нет'}\n` +
    `<b>Username:</b> ${ctx.callbackQuery.from.username || 'нет'}\n` +
    `<b>Дата:</b> ${new Date().toLocaleString()}`;

  const adminKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Approve → Interview', `apply_admin_firstapprove_${userId}`), Markup.button.callback('❌ Deny', `apply_admin_firstdeny_${userId}`)],
    [Markup.button.callback('Закончить', `deleteThisMessage`)]
  ]);

  // Send to EPINETOV
  await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, adminMessage, {
    parse_mode: 'HTML',
    ...adminKeyboard
  });

  // Send to GLAVGOBLIN
  await ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, adminMessage, {
    parse_mode: 'HTML',
    ...adminKeyboard
  });

  try {
    await ctx.editMessageText('⏳ Жди. Старейшины взвешивают твоё имя на весах. Вердикт будет вынесен.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'guestStart')]
      ])
    });
  } catch {
    await ctx.deleteMessage(toRemove);
    await ctx.replyWithHTML('✅ <b>Запрос отправлен!</b>\n\nВаша заявка успешно создана и отправлена администрации на рассмотрение. Мы уведомим вас о решении.');
  }
});