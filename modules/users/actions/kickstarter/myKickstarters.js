const { Composer, Markup } = require("telegraf");
const { getKickstarters, getUser } = require('../../../db/helpers');

const ITEMS_PER_PAGE = 5; // Safe limit for Telegram's 4096 character limit

async function handleMyKickstarters(ctx, page = 1) {
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

    if (purchasedKickstarters.length === 0) {
      await ctx.editMessageText(
        '📚 <b>Твои сделки</b>\n\n' +
        'В твоём гримуаре пока нет заключённых сделок.\n' +
        'Чернокнижник ждёт, когда ты выберешь свою первую.\n\n' +
        'Используй кнопку «🔍 Найти новые», чтобы увидеть доступные ритуалы.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔍 Найти новые', 'browseKickstarters')],
            [Markup.button.callback('🔙 Назад', 'userKickstarters')]
          ])
        }
      );
      return;
    }

    // Pagination calculations
    const totalPages = Math.ceil(purchasedKickstarters.length / ITEMS_PER_PAGE);
    const currentPage = Math.max(1, Math.min(page, totalPages)); // Clamp page between 1 and totalPages
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageKickstarters = purchasedKickstarters.slice(startIndex, endIndex);

    // Build message
    let message = `📚 <b>Мои сделки</b>\n\n`;
    message += `Всего проведено ритуалов: <b>${purchasedKickstarters.length}</b>\n`;
    message += `Страница <b>${currentPage}</b> из <b>${totalPages}</b>\n\n`;

    const buttons = [];

    pageKickstarters.forEach((ksId, index) => {
      const globalIndex = startIndex + index;
      const ks = kickstartersData.list[ksId];
      if (ks) {
        message += `${globalIndex + 1}. <b>${ks.name}</b>\n   Автор: ${ks.creator}\n\n`;
        buttons.push([
          Markup.button.callback(
            `${globalIndex + 1}. ${ks.name}`,
            `showKickstarterFromGoblin_${ksId}`
          )
        ]);
      }
    });

    message += `\n<i>Выбери сделку для получения файлов:</i>`;

    // Add pagination buttons (always show both)
    const paginationButtons = [];
    const prevPage = currentPage > 1 ? currentPage - 1 : currentPage;
    const nextPage = currentPage < totalPages ? currentPage + 1 : currentPage;

    paginationButtons.push(
      Markup.button.callback('◀️ Предыдущая', `myKickstarters_page_${prevPage}`),
      Markup.button.callback(`Страница ${currentPage}`, `myKickstarters_page_${currentPage}_noop`),
      Markup.button.callback('Следующая ▶️', `myKickstarters_page_${nextPage}`)
    );
    buttons.push(paginationButtons);

    // Add navigation buttons
    buttons.push([
      Markup.button.callback('🔍 Найти новые', 'browseKickstarters'),
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
    console.error('Error in myKickstarters:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'userKickstarters')]
      ])
    });
  }
}

// Handle initial action (page 1)
const myKickstartersHandler = Composer.action('myKickstarters', async (ctx) => {
  await handleMyKickstarters(ctx, 1);
});

// Handle no-op action for current page button (does nothing) - must be before page handler
const myKickstartersNoopHandler = Composer.action(/^myKickstarters_page_\d+_noop$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  // Do nothing - just answer the callback query
});

// Handle pagination actions (myKickstarters_page_X)
const myKickstartersPageHandler = Composer.action(/^myKickstarters_page_(\d+)$/, async (ctx) => {
  const page = parseInt(ctx.match[1], 10);
  await handleMyKickstarters(ctx, page);
});

module.exports = Composer.compose([
  myKickstartersHandler,
  myKickstartersNoopHandler,
  myKickstartersPageHandler
]);
