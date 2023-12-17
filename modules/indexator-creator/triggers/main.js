
const { Composer } = require("telegraf");
const RedisSession = require('telegraf-session-redis-upd')
const sessionInstance = new RedisSession();

function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}

module.exports = Composer.on('channel_post', async (ctx) => {

  if (!ctx.channelPost.document && (typeof ctx.channelPost.text !== undefined || typeof ctx.channelPost.caption !== undefined)) {
    let localChannels;
    await sessionInstance.getSession('channelsSession').then(session => { localChannels = session; });
    if (!localChannels) localChannels = {};
    if (!localChannels.channels) localChannels.channels = {};

    const channelID = ctx.channelPost.chat.id;
    const messageText = ctx.channelPost.text || ctx.channelPost.caption;

    if (!localChannels.channels[channelID]) {

      if (messageText === 'start') {
        localChannels.channels[channelID] = {
          indexers: [],
          studios: [],
          locked: false,
          type: 'archive'
        };
        ctx.replyWithHTML('Бип буп, записал канал. Присылай индексаторы \n\nПришли любое сообщение, которое будет содержать хотя бы 1 эмодзи "🔸" - я запомню его как Индексатор. \n\n<i>Рекомендую прислать минимум <b>2</b> таких сообщения</i>')
      }
      sessionInstance.saveSession('channelsSession', localChannels);

    } else

      if (messageText === 'stop') {

        ctx.replyWithHTML('🖐 Индексаторы в ручном режиме')
        localChannels.channels[channelID].locked = true;
        sessionInstance.saveSession('channelsSession', localChannels);

      } else


        if (messageText === 'start') {

          ctx.replyWithHTML('🤖 Индексаторы в автоматическом режиме')
          localChannels.channels[channelID].locked = false;
          sessionInstance.saveSession('channelsSession', localChannels);

        } else


          if (messageText === 'switch') {

            if (localChannels.channels[channelID].type === 'collection') {
              localChannels.channels[channelID].type = 'archive';
              ctx.replyWithHTML('Режим - архив БГ')
            } else if (localChannels.channels[channelID].type === 'archive') {
              localChannels.channels[channelID].type = 'collection';
              ctx.replyWithHTML('Режим - коллекция')
            }
            sessionInstance.saveSession('channelsSession', localChannels);

          } else


            if (messageText === 'reset') {

              localChannels.channels[channelID] = {
                indexers: [],
                studios: [],
                locked: false,
                type: 'archive'
              };

              ctx.replyWithHTML('Стёр всю информацию по каналу, можешь удалять старые индексаторы и присылать новые. \n\nПришли любое сообщение, которое будет содержать хотя бы 1 эмодзи "🔸" - я запомню его как Индексатор. \n\n<i>Рекомендую прислать минимум <b>2</b> таких сообщения</i>')
              sessionInstance.saveSession('channelsSession', localChannels);

            } else


              if (!localChannels.channels[channelID].locked) {
                if (!localChannels.channels[channelID].type) localChannels.channels[channelID].type = 'archive';
                //console.log(ctx.channelPost)
                if (messageText.indexOf('🔸') < 0) {
                  let needToChangeCaption = false;
                  let newCaption = '';

                  if (localChannels.channels[channelID].indexers.length === 0) {
                    ctx.replyWithHTML('Нет ни одного записанного индексатора! \n\nПришли любое сообщение, которое будет содержать хотя бы 1 эмодзи "🔸" - я запомню его как Индексатор. \n\n<i>Рекомендую прислать минимум <b>2</b> таких сообщения</i>');
                  } else {
                    let studioName = '';
                    let monthName = '';
                    let year = '';
                    let releaseName = '';

                    const months = {
                      'январь': '01',
                      'февраль': '02',
                      'март': '03',
                      'апрель': '04',
                      'май': '05',
                      'июнь': '06',
                      'июль': '07',
                      'август': '08',
                      'сентябрь': '09',
                      'октябрь': '10',
                      'ноябрь': '11',
                      'декабрь': '12',
                      'пыпы': '88'
                    }

                    if ((messageText.match(/^[a-zA-Z ]+- (20)2[0-9]\-{0,1}[01][0-9]/g) || []).length) {
                      needToChangeCaption = true;

                      studioName = messageText.match(/^[a-zA-Z ]+/g)[0].trim() || 'failedStudioName';

                      year = messageText.match(/ - (20)2[0-9]/g)[0].split(' - ')[1] || '9999';
                      if (year.length === 2) year = `20${year}`

                      let month = messageText.match(/([01][0-9]$)|([01][0-9] - )/g)[0].split(' - ')[0] || '88';

                      releaseName = messageText.match(/(?! )[a-zA-Z ]+$/g)[0] || `${year}${month}`;

                      newCaption = `<b>${studioName}</b> (${getKeyByValue(months, month)} ${year})`
                      if (releaseName.match(/^(20)2[0-9][01][0-9]$/g) == null) {
                        newCaption = newCaption + `\n<i>${releaseName}</i>`
                      }

                    } else {
                      monthName = messageText.split('\n')[0]?.split(' (')[1]?.split(' ')[0] || 'пыпы';
                      year = messageText.split('\n')[0]?.split(' (')[1]?.split(' ')[1]?.split(')')[0] || '2222';

                      if (messageText.indexOf('\n') > 0) {
                        studioName = messageText.split('\n')[0].split(' (')[0];
                        if (year == '2222' || months[monthName] == '88') {
                          releaseName = `${messageText.split('\n')[1]}`;
                        } else {
                          releaseName = `${year}${months[monthName]} - ${messageText.split('\n')[1]}`;
                        }
                      } else {
                        studioName = messageText.split(' (')[0];
                        releaseName = `${year}${months[monthName]}`;
                      }
                    }




                    let copy = localChannels.channels[channelID].studios;
                    const newPostInfo = {
                      name: studioName,
                      release: releaseName,
                      messageID: ctx.channelPost.message_id
                    }
                    copy.push(newPostInfo)
                    copy.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));

                    let newTextFirst = ``;
                    let newTextSecond = ``;
                    if (copy.length < 100) {
                      newTextFirst = `🔸 <b>Индексатор 1</b>🔸\n\n`
                      copy.forEach(st => {
                        if (localChannels.channels[channelID].type === 'archive')
                          newTextFirst += `<a href="https://t.me/c/${channelID.toString().split('-100')[1]}/${st.messageID}">${st.name} - ${st.release.split(' - ')[1] || st.release}</a>\n`
                        if (localChannels.channels[channelID].type === 'collection')
                          newTextFirst += `<a href="https://t.me/c/${channelID.toString().split('-100')[1]}/${st.messageID}">${st.release}</a>\n`
                      });
                    } else {
                      newTextFirst = `🔸 <b>Индексатор 1</b>🔸\n\n`
                      newTextSecond = `🔸 <b>Индексатор 2</b>🔸\n\n`
                      let counter = 1;
                      copy.forEach(st => {
                        if (localChannels.channels[channelID].type === 'archive') {
                          if (counter > 79) {
                            newTextSecond += `<a href="https://t.me/c/${channelID.toString().split('-100')[1]}/${st.messageID}">${st.name} - ${st.release.split(' - ')[1] || st.release}</a>\n`
                          } else {
                            newTextFirst += `<a href="https://t.me/c/${channelID.toString().split('-100')[1]}/${st.messageID}">${st.name} - ${st.release.split(' - ')[1] || st.release}</a>\n`
                          }
                        }
                        if (localChannels.channels[channelID].type === 'collection') {
                          if (counter > 79) {
                            newTextSecond += `<a href="https://t.me/c/${channelID.toString().split('-100')[1]}/${st.messageID}">${st.release}</a>\n`
                          } else {
                            newTextFirst += `<a href="https://t.me/c/${channelID.toString().split('-100')[1]}/${st.messageID}">${st.release}</a>\n`
                          }
                        }
                        counter++;
                      });
                    }

                    if (needToChangeCaption) {
                      try {
                        ctx.telegram.editMessageCaption(channelID, ctx.channelPost.message_id, undefined, newCaption, {
                          parse_mode: "HTML"
                        }).catch(e => {
                          console.log(e)
                        })
                      } catch (e) {
                        console.log(e)
                      }
                    }


                    try {
                      ctx.telegram.editMessageText(channelID, localChannels.channels[channelID].indexers[0].messageID, undefined, newTextFirst, {
                        parse_mode: "HTML"
                      }).catch(e => {
                        console.log(e)
                      })
                    } catch (e) {
                      console.log(e)
                    }

                    if (newTextSecond.length > 5) {
                      try {
                        ctx.telegram.editMessageText(channelID, localChannels.channels[channelID].indexers[1].messageID, undefined, newTextSecond, {
                          parse_mode: "HTML"
                        }).catch(e => {
                          console.log(e)
                        })
                      } catch (e) {
                        console.log(e)
                      }
                    }
                  }
                } else {

                  const numberOfIndexer = localChannels.channels[channelID].indexers.length + 1;
                  const defaultText = `🔸 <b>Индексатор ${numberOfIndexer}</b>🔸\n\n<i>Скоро тут будут ссылки на релизы!</i>`;
                  localChannels.channels[channelID].indexers.push({
                    messageID: ctx.channelPost.message_id
                  })
                  try {
                    ctx.telegram.editMessageText(channelID, ctx.channelPost.message_id, undefined, defaultText, {
                      parse_mode: "HTML"
                    }).catch(e => {
                      console.log(e)
                    })
                  } catch (e) {
                    console.log(e)
                  }
                  await ctx.telegram.pinChatMessage(channelID, ctx.channelPost.message_id);
                }

                sessionInstance.saveSession('channelsSession', localChannels);
              }
  }
})