const SETTINGS = require('../../settings.json')

const getPriceInUSD = (price) => {
  return Math.ceil(price * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE);
}

const captionIsTooLong = (caption) => {
  if (caption.length > 1023) return true;
  else return false;
}


module.exports = {
  getLotMessage: function ({ author = 'Автор не указан', name = 'Безымянный набор', link = "", price, organizator = 'Организатора нет', status = false, participants = [] }) {

    let participantsText = participants.length > 0 ? '' : '1.';
    participants.forEach((part, id) => {
      let participantFullName = part?.first_name + ' ' + part?.last_name;
      if (part.username) participantFullName += ` (@${part.username})`
      participantsText += `${id + 1}. ${participantFullName}\n`
    })

    let newCostPerPerson = participants.length > 0 ? price / participants.length : price;
    newCostPerPerson = +newCostPerPerson.toFixed(2);
    let costPerPersonFuture = participants.length > 0 ? price / (participants.length + 1) : price;
    costPerPersonFuture = +costPerPersonFuture.toFixed(2);

    return `<b>${author}</b>
  <i>${name}</i>
  
  🔗 <b>Ссылка:</b> <a href='${link}'>тык</a>
  💰 <b>Цена:</b> $${price} (${getPriceInUSD(price)}₽)
  
  <b>Организатор:</b> ${organizator}
  <b>Статус:</b> ${status ? '✅ ОТКРЫТ НАБОР' : '❌ СБОР ЗАВЕРШЁН'}
  
  <b>Участники:</b>
  ${participantsText}${participants.length > 0 ? `
  💶 <b>Каждый платит по:</b> $${newCostPerPerson} (${Math.ceil(newCostPerPerson * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE)}₽)` : ''}${status ? `
  
  Если ты присоединишься, то цена участия будет $${costPerPersonFuture} (${getPriceInUSD(costPerPersonFuture)}₽)` : ''}
  
  ${status ? '#opened_lot' : '#closed_lot'}`
  },

  getLotMessageShort: function ({ author = 'Автор не указан', name = 'Безымянный набор', link = "", price, organizator = 'Организатора нет', status = false, participants = [] }) {

    let participantsText = '';
    participants.forEach((part, id) => {
      let participantFullName = ``;
      if (part.username) {
        participantFullName += `@${part.username}`
      } else {
        participantFullName += part?.first_name
      }
      participantsText += `${participantFullName}; `
    })

    let newCostPerPerson = participants.length > 0 ? price / participants.length : price;
    newCostPerPerson = +newCostPerPerson.toFixed(2);
    let costPerPersonFuture = participants.length > 0 ? price / (participants.length + 1) : price;
    costPerPersonFuture = +costPerPersonFuture.toFixed(2);

    return `<b>${author}</b>
  <i>${name}</i>
  
  🔗 <b>Ссылка:</b> <a href='${link}'>тык</a>
  💰 <b>Цена:</b> $${price} (${getPriceInUSD(price)}₽)
  
  <b>Организатор:</b> ${organizator}
  <b>Статус:</b> ${status ? '✅ ОТКРЫТ НАБОР' : '❌ СБОР ЗАВЕРШЁН'}
  
  <b>Участники:</b>
  ${participantsText}${participants.length > 0 ? `
  💶 <b>Каждый платит по:</b> $${newCostPerPerson} (${Math.ceil(newCostPerPerson * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE)}₽)` : ''}${status ? `
  
  Если ты присоединишься, то цена участия будет $${costPerPersonFuture} (${getPriceInUSD(costPerPersonFuture)}₽)` : ''}
  
  ${status ? '#opened_lot' : '#closed_lot'}`
  },

  getLotMessageEvenShorter: function ({ author = 'Автор не указан', name = 'Безымянный набор', link = "", price, organizator = 'Организатора нет', status = false, participants = [] }) {

    let participantsText = '';
    participants.forEach((part, id) => {
      let participantFullName = ``;
      if (part.username) {
        participantFullName += `@${part.username}`
      } else {
        participantFullName += part?.first_name
      }
      participantsText += `${participantFullName}; `
    })

    let newCostPerPerson = participants.length > 0 ? price / participants.length : price;
    newCostPerPerson = +newCostPerPerson.toFixed(2);
    let costPerPersonFuture = participants.length > 0 ? price / (participants.length + 1) : price;
    costPerPersonFuture = +costPerPersonFuture.toFixed(2);

    return `<b>${author.slice(0, 20)}...</b>
  <i>${name.slice(0, 20)}...</i>
  
  <b>Организатор:</b> ${organizator}
  
  <b>Участники:</b>
  ${participantsText}${participants.length > 0 ? `
  💶 <b>Каждый платит по:</b> $${newCostPerPerson} (${Math.ceil(newCostPerPerson * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE)}₽)` : ''}`
  },

  getLotMessageLastResort: function ({ author = 'Автор не указан', name = 'Безымянный набор', link = "", price, organizator = 'Организатора нет', status = false, participants = [] }) {

    let participantsText = '';
    participants.forEach((part, id) => {
      let participantFullName = ``;
      if (part.username) {
        participantFullName += `@${part.username}`
      } else {
        participantFullName += part?.first_name
      }
      participantsText += `${participantFullName}; `
    })

    let newCostPerPerson = participants.length > 0 ? price / participants.length : price;
    newCostPerPerson = +newCostPerPerson.toFixed(2);
    let costPerPersonFuture = participants.length > 0 ? price / (participants.length + 1) : price;
    costPerPersonFuture = +costPerPersonFuture.toFixed(2);

    return `${organizator}
  
  ${participantsText}${participants.length > 0 ? `
  <b>Стоимость:</b> $${newCostPerPerson} (${Math.ceil(newCostPerPerson * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE)}₽)` : ''}`
  },

  getLotCaption: function ({ author = 'Автор не указан', name = 'Безымянный набор', link = "", price, organizator = 'Организатора нет', status = false, participants = [] }) {
    let participantsText = participants.length > 0 ? '' : '1.';
    participants.forEach((part, id) => {
      let participantFullName = part?.first_name + ' ' + part?.last_name;
      if (part.username) participantFullName += ` (@${part.username})`
      participantsText += `${id + 1}. ${participantFullName}\n`
    })

    let newCostPerPerson = participants.length > 0 ? price / participants.length : price;
    newCostPerPerson = +newCostPerPerson.toFixed(2);
    let costPerPersonFuture = participants.length > 0 ? price / (participants.length + 1) : price;
    costPerPersonFuture = +costPerPersonFuture.toFixed(2);

    let header = `<b>${author}</b>\n<i>${name}</i>`
    let additionalInfoPart = `🔗 <b>Ссылка:</b> <a href='${link}'>тык</a>\n💰 <b>Цена:</b> $${price} (${getPriceInUSD(price)}₽)`
    let statusPart = `<b>Организатор:</b> ${organizator}\n<b>Статус:</b> ${status ? '✅ ОТКРЫТ НАБОР' : '❌ СБОР ЗАВЕРШЁН'}`
    let participantsPart = `<b>Участники:</b>\n${participantsText}`
    let costPart = `${participants.length > 0 ? `💶 <b>Каждый платит по:</b> $${newCostPerPerson} (${Math.ceil(newCostPerPerson * SETTINGS.EXCHANGE_RATE * SETTINGS.SPECIAL_RATE)}₽)` : ''}`
    let newCostPart = `${status ? `\n\nЕсли ты присоединишься, то цена участия будет $${costPerPersonFuture} (${getPriceInUSD(costPerPersonFuture)}₽)` : ''}`
    let lotTagPart = `${status ? '#opened_lot' : '#closed_lot'}`

    let caption = `${header}\n\n${additionalInfoPart}\n\n${statusPart}\n\n${participantsPart}${costPart}${newCostPart}\n\n${lotTagPart}`

    if (captionIsTooLong(caption)) {
      participantsText = '';
      participants.forEach((part, id) => {
        let participantFullName = ``;
        if (part.username) {
          participantFullName += `@${part.username}`
        } else {
          participantFullName += part?.first_name
        }
        participantsText += `${participantFullName}; `
      })
      participantsPart = `<b>Участники:</b>\n${participantsText}`
      caption = `${header}\n\n${additionalInfoPart}\n\n${statusPart}\n\n${participantsPart}${costPart}${newCostPart}\n\n${lotTagPart}`

      if (captionIsTooLong(caption)) {
        header = `<b>${author.slice(0, 20)}...</b>\n<i>${name.slice(0, 20)}...</i>`
        statusPart = `<b>Организатор:</b> ${organizator}`
        caption = `${header}\n\n${statusPart}\n\n${participantsPart}${costPart}`

        if (captionIsTooLong(caption)) {
          statusPart = organizator;
          participantsPart = participantsText;
          caption = `${statusPart}\n\n${participantsPart}${costPart}`
        }
      }
    }

    return caption;
  }
}