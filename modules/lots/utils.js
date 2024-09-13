const { Markup } = require("telegraf");
const SETTINGS = require('../../settings.json');

// Generates the caption for the lot, depending on its status and participants
function getLotCaption({ author, name, link, price, currency, organizator, status, participants }) {
  const statusLabel = status ? '✅ ОТКРЫТ НАБОР' : '❌ ЛОТ ЗАКРЫТ';
  const participantsList = participants.map((p, index) => `${index + 1}. @${p.username || p.first_name}`).join('\n') || 'Нет участников';

  let message = `<b>${author || 'без автора'}</b>\n` +
    `<i>${name || 'без названия'}</i>\n\n` +
    `✍️ <b>Описание:</b> ${link || 'без названия'}\n` +
    `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES[currency].SYMBOL}${price}${(currency && currency !== 'RUB') ? ` (${Math.ceil(price * SETTINGS.CURRENCIES[currency].EXCHANGE_RATE)}₽)` : ''}\n\n` +
    `<b>Организатор:</b> ${organizator}\n` +
    `<b>Статус:</b> ${statusLabel}\n\n` +
    `<b>Участники:</b>\n${participantsList}\n\n` +
    `${participants.length > 0 ? `💶 <b>Каждый платит по:</b> ${formatCurrency(currency, price, participants.length)}\n\n` : ''}` +
    (status ? `<i>Если ты присоединишься, то цена участия будет ${formatCurrency(currency, price, participants.length + 1)}</i>\n\n#opened_lot` : '#closed_lot');

  if (message.length > 1023) {
    const shortParticipantsList = participants.map((p, index) => `@${p.username || p.first_name}`).join(' ') || 'Нет участников';
    message += `<b>${author || 'без автора'}</b>\n` +
    `<i>${name || 'без названия'}</i>\n\n` +
    `💰 <b>Цена:</b> ${SETTINGS.CURRENCIES[currency].SYMBOL}${price}${(currency && currency !== 'RUB') ? ` (${Math.ceil(price * SETTINGS.CURRENCIES[currency].EXCHANGE_RATE)}₽)` : ''}\n\n` +
    `<b>Организатор:</b> ${organizator}\n` +
    `<b>Участники:</b>\n${shortParticipantsList}\n\n` +
    `${participants.length > 0 ? `💶 <b>Каждый платит по:</b> ${formatCurrency(currency, price, participants.length)}\n\n` : ''}` +
    (status ? `<i>Если ты присоединишься, то цена участия будет ${formatCurrency(currency, price, participants.length + 1)}</i>\n\n#opened_lot` : '#closed_lot');
  }
}

function formatCurrency(currency, totalPrice, amountOfParticipants) {
  const pricePerMember = totalPrice / amountOfParticipants;
  return `${SETTINGS.CURRENCIES[currency].SYMBOL}${currency == 'RUB' ? parseInt(pricePerMember) : parseFloat(pricePerMember).toFixed(2)}${(currency && currency != "RUB") ? ` (${Math.ceil(pricePerMember * SETTINGS.CURRENCIES[currency].EXCHANGE_RATE)}₽)` : ''}`
}

// Updates the message caption
async function updateLotMessageCaption(ctx, lotID, lotData, isClosed = false) {
  const organizator = `${lotData.whoCreated.first_name} ${lotData.whoCreated.last_name}${lotData.whoCreated.username ? ` (@${lotData.whoCreated.username})` : ''}`;

  const updatedCaption = getLotCaption({
    author: lotData.author,
    name: lotData.name,
    link: lotData.link,
    price: lotData.price,
    currency: lotData.currency,
    organizator,
    status: !isClosed,
    participants: lotData.participants,
  });

  const buttons = isClosed
    ? []
    : [
      [
        Markup.button.callback('✅ Присоединиться', `action-join-lot-${lotID}`),
        Markup.button.callback('🏃 Выйти', `action-leave-lot-${lotID}`)
      ],
      [
        Markup.button.callback('❌ Закрыть', `action-close-lot-${lotID}`),
        Markup.button.callback('🗑 Удалить', `action-close-lot-${lotID}`),
        //Markup.button.callback('✍️ Редактировать', `action-close-lot-${lotID}`)
      ]
    ];

  // Edit the message with the new caption and buttons
  await ctx.telegram.editMessageCaption(
    lotData.chatID,
    lotData.messageID,
    null,
    updatedCaption,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons),
    }
  );
}

// Checks if a user is the creator or an admin
function isUserAuthorizedToClose(ctx, lotData) {
  const userID = ctx.callbackQuery.from.id;
  return userID === lotData.whoCreated.id || userID === SETTINGS.CHATS.EPINETOV;  // Admin ID check
}

async function updateLotCreationMessage(ctx, message, buttons = [Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')]) {
  await ctx.telegram.editMessageText(
    ctx.session.lot.chatID,
    ctx.session.lot.messageID,
    null,
    message,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons)
    }
  );
}

function initializeLotSession(ctx) {
  if (!ctx.session.lot) {
    ctx.session.lot = {
      photos: [],
      whoCreated: ctx.from,
      participants: [],
      opened: true,
    };
  }
}

module.exports = {
  getLotCaption,
  updateLotMessageCaption,
  isUserAuthorizedToClose,
  updateLotCreationMessage,
  initializeLotSession
};
