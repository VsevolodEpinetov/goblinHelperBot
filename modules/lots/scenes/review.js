const { Scenes, Markup } = require("telegraf");
const lotsUtils = require('../utils');
const lotsService = require('../db/lotsService');
const SETTINGS = require('../../../settings.json')

const lotSceneReviewStage = new Scenes.BaseScene('LOT_SCENE_REVIEW_STAGE');

lotSceneReviewStage.enter(async (ctx) => {
  ctx.session.lot.currentStep = 4;
  
  // Validate lot data before showing preview
  const validation = lotsUtils.validateLotData(ctx.session.lot);
  
  if (!validation.isValid) {
    const errorMessage = validation.errors.map(e => `• ${e.message}`).join('\n');
    await lotsUtils.updateLotCreationMessage(ctx,
      `❌ <b>Ошибки в данных лота:</b>\n\n${errorMessage}\n\n` +
      `Пожалуйста, исправьте ошибки и попробуйте снова.`,
      [
        Markup.button.callback('🔙 Назад к редактированию', 'goBackToEdit'),
        Markup.button.callback('❌ Отмена', 'actionStopLot')
      ],
      4
    );
    return;
  }

  const preview = lotsUtils.generateLotPreview(ctx.session.lot);
  
  await lotsUtils.updateLotCreationMessage(ctx,
    preview,
    [
      [
        Markup.button.callback('✍️ Изменить название', 'editName'),
        Markup.button.callback('✍️ Изменить описание', 'editDescription')
      ],
      [
        Markup.button.callback('✍️ Изменить автора', 'editAuthor'),
        Markup.button.callback('💰 Изменить цену', 'editPrice')
      ],
      [
        Markup.button.callback('🏷️ Изменить теги', 'editTags'),
        Markup.button.callback('🖼 Изменить фото', 'editPhotos')
      ],
      [
        Markup.button.callback('✅ Опубликовать лот', 'publishLot'),
        Markup.button.callback('❌ Отмена', 'actionStopLot')
      ]
    ],
    4
  );
});

// Edit handlers
lotSceneReviewStage.action('editName', async (ctx) => {
  ctx.session.lot.editingField = 'name';
  await lotsUtils.updateLotCreationMessage(ctx,
    `✍️ <b>Редактирование названия</b>\n\n` +
    `Текущее название: <b>${ctx.session.lot.name}</b>\n\n` +
    `Отправьте новое название лота:`,
    [
      Markup.button.callback('🔙 Назад к просмотру', 'backToReview'),
      Markup.button.callback('❌ Отмена', 'actionStopLot')
    ],
    4
  );
});

lotSceneReviewStage.action('editDescription', async (ctx) => {
  ctx.session.lot.editingField = 'link';
  await lotsUtils.updateLotCreationMessage(ctx,
    `✍️ <b>Редактирование описания</b>\n\n` +
    `Текущее описание: <b>${ctx.session.lot.link}</b>\n\n` +
    `Отправьте новое описание лота:`,
    [
      Markup.button.callback('🔙 Назад к просмотру', 'backToReview'),
      Markup.button.callback('❌ Отмена', 'actionStopLot')
    ],
    4
  );
});

lotSceneReviewStage.action('editAuthor', async (ctx) => {
  ctx.session.lot.editingField = 'author';
  await lotsUtils.updateLotCreationMessage(ctx,
    `✍️ <b>Редактирование автора</b>\n\n` +
    `Текущий автор: <b>${ctx.session.lot.author}</b>\n\n` +
    `Отправьте нового автора лота:`,
    [
      Markup.button.callback('🔙 Назад к просмотру', 'backToReview'),
      Markup.button.callback('❌ Отмена', 'actionStopLot')
    ],
    4
  );
});

lotSceneReviewStage.action('editPrice', async (ctx) => {
  ctx.session.lot.editingField = 'price';
  await lotsUtils.updateLotCreationMessage(ctx,
    `💰 <b>Редактирование цены</b>\n\n` +
    `Текущая цена: <b>${SETTINGS.CURRENCIES[ctx.session.lot.currency]?.SYMBOL || '$'}${ctx.session.lot.price}</b>\n\n` +
    `Отправьте новую цену лота (число):`,
    [
      Markup.button.callback('🔙 Назад к просмотру', 'backToReview'),
      Markup.button.callback('❌ Отмена', 'actionStopLot')
    ],
    4
  );
});

lotSceneReviewStage.action('editTags', async (ctx) => {
  // Go back to price and tags stage for tag editing
  ctx.scene.enter('LOT_SCENE_PRICE_AND_TAGS_STAGE');
});

lotSceneReviewStage.action('editPhotos', async (ctx) => {
  // Go back to photo stage for photo editing
  ctx.scene.enter('LOT_SCENE_PHOTO_STAGE');
});

lotSceneReviewStage.action('backToReview', async (ctx) => {
  // Remove editing field and return to review
  delete ctx.session.lot.editingField;
  ctx.scene.reenter();
});

// Handle text input for editing
lotSceneReviewStage.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  await ctx.deleteMessage(ctx.message.message_id);

  if (!ctx.session.lot.editingField) {
    return;
  }

  // Update the field
  ctx.session.lot[ctx.session.lot.editingField] = text;
  delete ctx.session.lot.editingField;

  // Show confirmation and return to review
  await lotsUtils.updateLotCreationMessage(ctx,
    `✅ Поле обновлено!\n\n` +
    `Переходим обратно к просмотру...`,
    [
      Markup.button.callback('🔙 Назад к просмотру', 'backToReview')
    ],
    4
  );

  // Wait a moment then return to review
  setTimeout(() => {
    ctx.scene.reenter();
  }, 2000);
});

// Publish the lot
lotSceneReviewStage.action('publishLot', async (ctx) => {
  try {
    // Final validation
    const validation = lotsUtils.validateLotData(ctx.session.lot);
    if (!validation.isValid) {
      const errorMessage = validation.errors.map(e => `• ${e.message}`).join('\n');
      await ctx.answerCbQuery(`Ошибки в данных: ${errorMessage}`);
      return;
    }

    await lotsUtils.updateLotCreationMessage(ctx,
      `🚀 <b>Публикация лота...</b>\n\n` +
      `Пожалуйста, подождите...`,
      [],
      4
    );

    // Create the lot in database
    const lotData = {
      ...ctx.session.lot,
      chatID: ctx.session.lot.chatID,
      messageID: ctx.session.lot.messageID
    };

    const createdLot = await lotsService.createLot(lotData);
    
    // Update the session with the database ID
    ctx.session.lot.dbId = createdLot.id;

    // Post the lot to the channel
    await postLotToChannel(ctx, ctx.session.lot);

    await lotsUtils.updateLotCreationMessage(ctx,
      `🎉 <b>Лот успешно опубликован!</b>\n\n` +
      `Ваш лот #${createdLot.id} теперь доступен всем участникам.\n\n` +
      `Спасибо за использование системы лотов!`,
      [
        Markup.button.callback('🏠 Главное меню', 'goToMainMenu')
      ],
      4
    );

  } catch (error) {
    console.error('Failed to publish lot:', error);
    await lotsUtils.updateLotCreationMessage(ctx,
      `❌ <b>Ошибка публикации</b>\n\n` +
      `Не удалось опубликовать лот. Попробуйте позже или обратитесь к администратору.`,
      [
        Markup.button.callback('🔄 Попробовать снова', 'publishLot'),
        Markup.button.callback('❌ Отмена', 'actionStopLot')
      ],
      4
    );
  }
});

// Helper function to post lot to channel
async function postLotToChannel(ctx, lotData) {
  try {
    const organizator = `${lotData.whoCreated?.first_name || ''} ${lotData.whoCreated?.last_name || ''}${lotData.whoCreated?.username ? ` (@${lotData.whoCreated.username})` : ''}`.trim();

    const buttons = [
      [
        Markup.button.callback('✅ Присоединиться', `action-join-lot-${lotData.dbId}`),
        Markup.button.callback('🏃 Выйти', `action-leave-lot-${lotData.dbId}`)
      ],
      [
        Markup.button.callback('❌ Закрыть', `action-close-lot-${lotData.dbId}`),
        Markup.button.callback('🗑 Удалить', `action-delete-lot-${lotData.dbId}`),
        Markup.button.callback('✍️ Редактировать', `action-edit-lot-${lotData.dbId}`)
      ],
      [
        Markup.button.callback('⭐ В избранное', `action-favorite-lot-${lotData.dbId}`),
        Markup.button.callback('🔍 Подробнее', `action-details-lot-${lotData.dbId}`)
      ]
    ];

    if (lotData.photos.length < 2) {
      const nctx = await ctx.replyWithPhoto(lotData.photos[0], {
        caption: lotsUtils.getLotCaption(ctx, {
          author: lotData.author,
          name: lotData.name,
          link: lotData.link,
          price: lotData.price,
          currency: lotData.currency,
          organizator,
          status: true,
          participants: lotData.participants || [],
          tags: lotData.tags || [],
          lotId: lotData.dbId
        }),
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      });

      // Update the lot with the new message ID
      await lotsService.updateLotMessageId(lotData.dbId, nctx.message_id, ctx.chat.id);
    } else {
      const nctx = await ctx.replyWithMediaGroup(
        lotData.photos.map((p, id) => {
          return {
            type: 'photo',
            media: p,
            caption: id === 0
              ? lotsUtils.getLotCaption(ctx, {
                  author: lotData.author,
                  name: lotData.name,
                  link: lotData.link,
                  price: lotData.price,
                  currency: lotData.currency,
                  organizator,
                  status: true,
                  participants: lotData.participants || [],
                  tags: lotData.tags || [],
                  lotId: lotData.dbId
                })
              : null,
            parse_mode: 'HTML'
          };
        })
      );

      const newctx = await ctx.reply('Действия к лоту выше 👆', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });

      // Update the lot with the new message IDs
      await lotsService.updateLotMessageId(lotData.dbId, nctx[0].message_id, ctx.chat.id, newctx.message_id);
    }
  } catch (error) {
    console.error('Failed to post lot to channel:', error);
    throw error;
  }
}

lotSceneReviewStage.action('goToMainMenu', async (ctx) => {
  // Clear the lot session and return to main menu
  ctx.session.lot = null;
  ctx.scene.leave();
  // You can add logic here to return to main menu
});

lotSceneReviewStage.action('actionStopLot', async (ctx) => {
  try {
    if (ctx.session.lot) {
      ctx.session.lot = null;
      ctx.scene.leave();
    } else {
      await ctx.answerCbQuery("Похоже, что ты не создаешь лот");
    }
  } catch (e) {
    console.error('Failed to handle stop lot action:', e);
  }
});

module.exports = lotSceneReviewStage;
