const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getAllUsers } = require('../../../db/helpers');
const date = require('../../../date');

// Message templates for different reminder levels
const REMINDER_MESSAGES = {
  soft: {
    text: '🔔 <b>Напоминание от логова</b>\n\n' +
          'Новый цикл начался. Можно продлевать подписку. \n' +
          'Гоблины щедры к тем, кто вовремя заботится о своём месте у костра.',
    button: '💰 Оплатить взнос'
  },
  medium: {
    text: '⚔️ <b>Пора внести взнос</b>\n\n' +
          'Половина цикла позади, а твой взнос ещё не замечен в свитках. \n' +
          'Не тяни — в логове ценят тех, кто платит вовремя. Остальные рискуют остаться за дверью.',
    button: '💰 Внести взнос'
  },
  hard: {
    text: '💀 <b>Последнее предупреждение</b>\n\n' +
          'Цикл заканчивается. Если взнос не поступит — тебя вышвырнут из логова без сожалений. \n' +
          'Гоблины не церемонятся с бездельниками. У тебя совсем мало времени.',
    button: '💀 Оплатить немедленно'
  }
};

async function sendReminders(ctx, level) {
  const currentPeriodInfo = util.getCurrentPeriod(ctx);
  const currentYear = currentPeriodInfo.year;
  const currentMonth = currentPeriodInfo.month;
  const current = currentPeriodInfo.period;
  let counter = 0, failed = 0;
  let usernames = [], failedUsernames = [];

  const allUsers = await getAllUsers();
  for (const userId in allUsers.list) {
    const userData = allUsers.list[userId];
    // Check if user has goblin role, doesn't have admin roles, and hasn't purchased current month (regular or plus)
    const hasGoblinRole = userData.roles.includes('goblin');
    const hasAdminRole = userData.roles.includes('admin') || userData.roles.includes('adminPlus');
    const hasCurrentRegular = userData.purchases.groups.regular.includes(current);
    const hasCurrentPlus = userData.purchases.groups.plus.includes(current);
    const isRejected = userData.roles.includes('rejected');
    
    // User should be reminded if they have goblin role, no admin roles, no current month purchase (either regular or plus), and not rejected
    if (hasGoblinRole && !hasAdminRole && !hasCurrentRegular && !hasCurrentPlus && !isRejected) {
      try {
        const message = REMINDER_MESSAGES[level];
        await ctx.telegram.sendMessage(userData.id, message.text, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            Markup.button.callback(message.button, `sendPayment_currentMonth`)
          ])
        });
        usernames.push(userData.username !== 'not_set' ? userData.username : `${userData.first_name} ${userData.last_name}`);
        counter++;
      } catch (e) {
        failedUsernames.push(userData.username !== 'not_set' ? userData.username : `${userData.first_name} ${userData.last_name}`);
        failed++;
      }
    }
  }

  return { counter, failed, usernames, failedUsernames };
}

const remindComposer = new Composer();

remindComposer.action('adminRemind', async (ctx) => {
  const userId = ctx.callbackQuery.from.id;

  if (userId != SETTINGS.CHATS.EPINETOV && userId != SETTINGS.CHATS.GLAVGOBLIN) {
    return;
  }

  // Show level selection
  await ctx.editMessageText('🔔 <b>Выберите уровень напоминания</b>\n\nВыберите, насколько настойчиво напомнить гоблинам о необходимости оплаты:', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔔 Мягкое', 'adminRemind_soft'),
        Markup.button.callback('⚔️ Среднее', 'adminRemind_medium'),
        Markup.button.callback('💀 Жёсткое', 'adminRemind_hard')
      ],
      [
        Markup.button.callback('← Назад', 'adminMonths'),
      ]
    ])
  });
});

remindComposer.action(/^adminRemind_/, async (ctx) => {
  const userId = ctx.callbackQuery.from.id;

  if (userId != SETTINGS.CHATS.EPINETOV && userId != SETTINGS.CHATS.GLAVGOBLIN) {
    return;
  }

  const callbackData = ctx.callbackQuery.data;
  const level = callbackData.split('_')[1]; // Extract level from adminRemind_soft, adminRemind_medium, adminRemind_hard

  if (!REMINDER_MESSAGES[level]) {
    await ctx.answerCbQuery('❌ Неверный уровень напоминания');
    return;
  }

  await ctx.answerCbQuery(`📤 Отправляю ${level === 'soft' ? 'мягкие' : level === 'medium' ? 'средние' : 'жёсткие'} напоминания...`);

  // Log the reminder action
  const levelText = level === 'soft' ? 'мягкие' : level === 'medium' ? 'средние' : 'жёсткие';
  console.log(`[INFO] ${date.getTimeForLogging()} @${ctx.callbackQuery.from.username} (${ctx.callbackQuery.from.id}) initiated ${levelText} reminders in DM`);

  const result = await sendReminders(ctx, level);

  await ctx.editMessageText(`🔔 <b>${levelText.charAt(0).toUpperCase() + levelText.slice(1)} напоминания отправлены</b>\n\n` +
    `✅ Отправлено: ${result.counter}\n` +
    `❌ С ошибкой: ${result.failed}\n\n` +
    `<u>Напомнил:</u>\n${result.usernames.join('\n')}\n\n` +
    `<u>Хотел, но не смог:</u>\n${result.failedUsernames.join('\n')}`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔔 Ещё раз', 'adminRemindLevels'),
        Markup.button.callback('← Месяцы', 'adminMonths')
      ],
      [
        Markup.button.callback('🏠 Главное меню', 'adminMenu')
      ]
    ])
  });
});

module.exports = remindComposer;