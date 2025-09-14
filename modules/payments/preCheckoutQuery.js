const { rpg } = require('../../configs/rpg');

/**
 * Pre-checkout query handler for Telegram Stars payments
 * This handler validates payment amounts before processing
 */
const handlePreCheckoutQuery = async (ctx) => {
  try {
    console.log('💳 Pre-checkout query received:', ctx.preCheckoutQuery);
    
    const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
    
    if (payload.type === 'subscription') {
      const expectedPrice = payload.subscriptionType === 'plus' ? 
        parseInt(rpg.prices.plusStars || process.env.PLUS_PRICE) : parseInt(rpg.prices.regularStars || process.env.REGULAR_PRICE);
      if (ctx.preCheckoutQuery.total_amount < expectedPrice) {
        console.error('Pre-checkout amount too low (subscription):', { expected: expectedPrice, received: ctx.preCheckoutQuery.total_amount, subscriptionType: payload.subscriptionType, currency: ctx.preCheckoutQuery.currency });
        await ctx.answerPreCheckoutQuery(false, 'Payment amount too low');
        return;
      }
      await ctx.answerPreCheckoutQuery(true);
    } else if (payload.type === 'old_month') {
      const expectedPrice = parseInt((rpg.prices.regularStars || process.env.REGULAR_PRICE)) * 3;
      if (ctx.preCheckoutQuery.total_amount < expectedPrice) {
        console.error('Pre-checkout amount too low (old_month):', { expected: expectedPrice, received: ctx.preCheckoutQuery.total_amount, currency: ctx.preCheckoutQuery.currency });
        await ctx.answerPreCheckoutQuery(false, 'Payment amount too low');
        return;
      }
      await ctx.answerPreCheckoutQuery(true);
    } else {
      await ctx.answerPreCheckoutQuery(false, 'Invalid payment type');
      return;
    }
    
  } catch (error) {
    console.error('❌ Error processing pre-checkout query:', error);
    await ctx.answerPreCheckoutQuery(false, 'Payment processing error');
  }
};

module.exports = { handlePreCheckoutQuery };
