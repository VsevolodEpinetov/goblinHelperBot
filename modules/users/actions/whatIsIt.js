const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('whatIsIt', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  // Step 2: What it is explanation
  await ctx.editMessageText(
    '🎯 <b>Что это такое?</b>\n\n' +
    'Это закрытое сообщество для любителей 3D-печати и STL-моделей.\n\n' +
    'У нас есть:\n' +
    '• Эксклюзивные STL-файлы\n' +
    '• Доступ к кикстартерам\n' +
    '• Коллекции моделей\n' +
    '• Общение с единомышленниками\n\n' +
    'Но есть правила, которые нужно соблюдать. Хочешь их узнать?',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📜 Какие правила?', 'showRules')]
      ])
    }
  );
});
