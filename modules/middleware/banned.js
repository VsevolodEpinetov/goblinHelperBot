const knex = require('../db/knex');

module.exports = async (ctx, next) => {
	try {
		const userId = (ctx.from && ctx.from.id) || (ctx.callbackQuery && ctx.callbackQuery.from && ctx.callbackQuery.from.id);
		if (!userId) {
			return next();
		}
		
		// Check if user is banned with a direct, fast query
		const isBanned = await knex('userRoles')
			.where('userId', userId)
			.where('role', 'banned')
			.first();
			
		if (isBanned) {
			return;
		}
	} catch (error) {
		console.error('❌ Banned middleware error:', error);
	}
	return next();
};


