const { Composer, Markup } = require("telegraf");
const { getKickstarters, getUser } = require('../../../db/helpers');

const ITEMS_PER_PAGE = 5; // Safe limit for Telegram's 4096 character limit

async function handleBrowseKickstarters(ctx, page = 1) {
  try {
    try { await ctx.answerCbQuery(); } catch {}
    
    const userId = ctx.from.id;
    const userData = await getUser(userId);
    
    if (!userData) {
      await ctx.editMessageText('❌ <b>Пользователь не найден</b>', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'userKickstarters')]
        ])
      });
      return;
    }

    const kickstartersData = await getKickstarters();
    const purchasedKickstarters = userData.purchases.kickstarters || [];
    
    // Get all kickstarters that user doesn't have
    const availableKickstarters = Object.keys(kickstartersData.list)
      .filter(ksId => !purchasedKickstarters.includes(ksId))
      .map(ksId => ({
        id: ksId,
        ...kickstartersData.list[ksId]
      }))
      .sort((a, b) => b.id - a.id); // Sort by ID descending (newest first)

    if (availableKickstarters.length === 0) {
      await ctx.editMessageText(
        '🔍 <b>Сделки с демонами</b>\n\n' +
        'Все доступные сделки уже заключены.\n' +
        'Демоны пока не предлагают ничего нового.\n\n' +
        'Вся добыча уже лежит в твоём гримуаре.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📚 Мои сделки', 'myKickstarters')],
            [Markup.button.callback('🔙 Назад', 'userKickstarters')]
          ])
        }
      );
      return;
    }

    // Pagination calculations
    const totalPages = Math.ceil(availableKickstarters.length / ITEMS_PER_PAGE);
    const currentPage = Math.max(1, Math.min(page, totalPages)); // Clamp page between 1 and totalPages
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageKickstarters = availableKickstarters.slice(startIndex, endIndex);

    // Build message
    let message = `🔍 <b>Доступные сделки</b>\n\n`;
    message += `Найдено сделок: <b>${availableKickstarters.length}</b>\n`;
    message += `Страница <b>${currentPage}</b> из <b>${totalPages}</b>\n\n`;
    
    const buttons = [];
    
    pageKickstarters.forEach((ks, index) => {
      const globalIndex = startIndex + index;
      message += `${globalIndex + 1}. <b>${ks.name}</b>\n   Источник: ${ks.creator}\n   Цена: ${ks.cost}⭐\n`;
      
      // Add link if available
      if (ks.link) {
        message += `   🔗 <a href="${ks.link}">Посмотреть описание проекта</a>\n`;
      }
      
      message += `\n`;
      
      buttons.push([
        Markup.button.callback(
          `${globalIndex + 1}. ${ks.name} - ${ks.cost}⭐`,
          `purchaseKickstarter_${ks.id}`
        )
      ]);
    });

    message += `\n<i>Выбери сделку для покупки:</i>`;

    // Add pagination buttons (always show both)
    const paginationButtons = [];
    const prevPage = currentPage > 1 ? currentPage - 1 : currentPage;
    const nextPage = currentPage < totalPages ? currentPage + 1 : currentPage;
    
    paginationButtons.push(
      Markup.button.callback('◀️ Предыдущая', `browseKickstarters_page_${prevPage}`),
      Markup.button.callback(`Страница ${currentPage}`, `browseKickstarters_page_${currentPage}_noop`),
      Markup.button.callback('Следующая ▶️', `browseKickstarters_page_${nextPage}`)
    );
    buttons.push(paginationButtons);

    // Add navigation buttons
    buttons.push([
      Markup.button.callback('📚 Мои сделки', 'myKickstarters'),
      Markup.button.callback('🔙 Назад', 'userKickstarters')
    ]);

    // Try to edit message, handle "message is not modified" error gracefully
    try {
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (editError) {
      if (editError.message && editError.message.includes('message is not modified')) {
        // Message content is the same (e.g., clicking prev on page 1), just answer the query
        try { await ctx.answerCbQuery(); } catch {}
      } else {
        throw editError;
      }
    }
  } catch (error) {
    console.error('Error in browseKickstarters:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'userKickstarters')]
      ])
    });
  }
}

// Handle initial action (page 1)
const browseKickstartersHandler = Composer.action('browseKickstarters', async (ctx) => {
  await handleBrowseKickstarters(ctx, 1);
});

// Handle no-op action for current page button (does nothing) - must be before page handler
const browseKickstartersNoopHandler = Composer.action(/^browseKickstarters_page_\d+_noop$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  // Do nothing - just answer the callback query
});

// Handle pagination actions (browseKickstarters_page_X)
const browseKickstartersPageHandler = Composer.action(/^browseKickstarters_page_(\d+)$/, async (ctx) => {
  const page = parseInt(ctx.match[1], 10);
  await handleBrowseKickstarters(ctx, page);
});

module.exports = Composer.compose([
  browseKickstartersHandler,
  browseKickstartersNoopHandler,
  browseKickstartersPageHandler
]);

