const { Composer, Markup } = require("telegraf");
const knex = require('../../../../modules/db/knex');
const { getUser } = require('../../../db/helpers');
const { getUserScrolls, giveScroll } = require('../../../util/scrolls');
const scrollsConfig = require('../../../../configs/scrolls');

// Handler for admin_user_scrolls_* - shows available and spent scrolls
const adminUserScrolls = Composer.action(/^admin_user_scrolls_\d+$/g, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.callbackQuery.data.split('_').pop();
  
  try {
    // Get user data
    const userData = await getUser(Number(userId));
    if (!userData) {
      await ctx.editMessageText(
        '❌ <b>Пользователь не найден</b>',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', `admin_manage_user_${userId}`)]
          ])
        }
      );
      return;
    }

    // Get available scrolls
    const availableScrolls = await getUserScrolls(Number(userId));
    
    // Get spent scrolls from logs
    const spentScrollsLogs = await knex('scrollLogs')
      .where({ userId: Number(userId), action: 'remove' })
      .select('scrollId', 'amount');
    
    // Sum up spent scrolls by type
    const spentScrolls = {};
    spentScrollsLogs.forEach(log => {
      if (!spentScrolls[log.scrollId]) {
        spentScrolls[log.scrollId] = 0;
      }
      spentScrolls[log.scrollId] += log.amount;
    });

    // Build message
    const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;
    let message = `📜 <b>Управление свитками</b>\n\n`;
    message += `👤 <b>Пользователь:</b> ${username}\n`;
    message += `🆔 <b>ID:</b> ${userId}\n\n`;

    // Available scrolls section
    message += `📊 <b>Доступные свитки:</b>\n`;
    if (availableScrolls.length === 0) {
      message += `Нет доступных свитков\n\n`;
    } else {
      availableScrolls.forEach(scroll => {
        const scrollDef = scroll.scrollDef;
        if (scrollDef) {
          message += `• <b>${scrollDef.name}</b>: ${scroll.amount} шт.\n`;
        }
      });
      message += `\n`;
    }

    // Spent scrolls section
    message += `💸 <b>Потраченные свитки:</b>\n`;
    const spentScrollIds = Object.keys(spentScrolls);
    if (spentScrollIds.length === 0) {
      message += `Нет потраченных свитков\n`;
    } else {
      spentScrollIds.forEach(scrollId => {
        const scrollDef = scrollsConfig.scrolls.find(s => s.id === scrollId);
        const scrollName = scrollDef ? scrollDef.name : scrollId;
        message += `• <b>${scrollName}</b>: ${spentScrolls[scrollId]} шт.\n`;
      });
    }

    // Build keyboard
    const keyboard = [];
    keyboard.push([
      Markup.button.callback('➕ Добавить свитки', `admin_user_add_scrolls_${userId}`)
    ]);
    keyboard.push([
      Markup.button.callback('🔙 Назад к управлению', `admin_manage_user_${userId}`)
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error in adminUserScrolls:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка при загрузке свитков</b>\n\n' +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', `admin_manage_user_${userId}`)]
        ])
      }
    );
  }
});

// Handler for admin_user_add_scrolls_* - shows menu to select scroll type to add
const adminUserAddScrolls = Composer.action(/^admin_user_add_scrolls_\d+$/g, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.callbackQuery.data.split('_').pop();
  
  try {
    // Get user data
    const userData = await getUser(Number(userId));
    if (!userData) {
      await ctx.editMessageText(
        '❌ <b>Пользователь не найден</b>',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', `admin_user_scrolls_${userId}`)]
          ])
        }
      );
      return;
    }

    // Build message
    const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;
    let message = `➕ <b>Добавить свитки</b>\n\n`;
    message += `👤 <b>Пользователь:</b> ${username}\n`;
    message += `🆔 <b>ID:</b> ${userId}\n\n`;
    message += `Выберите тип свитка для добавления:\n`;

    // Build keyboard with scroll buttons
    const keyboard = [];
    scrollsConfig.scrolls.forEach(scroll => {
      keyboard.push([
        Markup.button.callback(scroll.name, `admin_user_add_scroll_${userId}_${scroll.id}`)
      ]);
    });
    
    keyboard.push([
      Markup.button.callback('🔙 Назад к свиткам', `admin_user_scrolls_${userId}`)
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error in adminUserAddScrolls:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка</b>\n\n' +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', `admin_user_scrolls_${userId}`)]
        ])
      }
    );
  }
});

// Handler for admin_user_add_scroll_*_* - adds one scroll and shows success
const adminUserAddScroll = Composer.action(/^admin_user_add_scroll_\d+_\w+$/g, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const parts = ctx.callbackQuery.data.split('_');
  const userId = parts[4]; // admin_user_add_scroll_${userId}_${scrollId}
  const scrollId = parts[5]; // scrollId is the 6th part (index 5)
  
  try {
    // Validate scroll ID
    const scrollDef = scrollsConfig.scrolls.find(s => s.id === scrollId);
    if (!scrollDef) {
      await ctx.answerCbQuery('❌ Неверный тип свитка');
      return;
    }

    // Get user data
    const userData = await getUser(Number(userId));
    if (!userData) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    // Add scroll
    const success = await giveScroll(
      Number(userId),
      scrollId,
      'Выдано администратором'
    );

    if (!success) {
      await ctx.answerCbQuery('❌ Ошибка при добавлении свитка');
      return;
    }

    // Get updated scroll amount
    const userScrolls = await getUserScrolls(Number(userId));
    const addedScroll = userScrolls.find(s => s.scrollId === scrollId);
    const newAmount = addedScroll ? addedScroll.amount : 0;

    // Build success message
    const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;
    let message = `✅ <b>Свиток успешно добавлен!</b>\n\n`;
    message += `👤 <b>Пользователь:</b> ${username}\n`;
    message += `🆔 <b>ID:</b> ${userId}\n\n`;
    message += `📜 <b>${scrollDef.name}</b>\n`;
    message += `📊 <b>Новое количество:</b> ${newAmount} шт.\n\n`;
    message += `Выберите тип свитка для добавления:\n`;

    // Build keyboard with scroll buttons (same as add scrolls menu)
    const keyboard = [];
    scrollsConfig.scrolls.forEach(scroll => {
      keyboard.push([
        Markup.button.callback(scroll.name, `admin_user_add_scroll_${userId}_${scroll.id}`)
      ]);
    });
    
    keyboard.push([
      Markup.button.callback('🔙 Назад к свиткам', `admin_user_scrolls_${userId}`)
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error in adminUserAddScroll:', error);
    await ctx.answerCbQuery('❌ Ошибка при добавлении свитка');
  }
});

module.exports = Composer.compose([
  adminUserScrolls,
  adminUserAddScrolls,
  adminUserAddScroll
]);

