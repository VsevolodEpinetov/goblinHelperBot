const knex = require('../db/knex');

module.exports = async (ctx, next) => {
	try {
		const userId = (ctx.from && ctx.from.id) || (ctx.callbackQuery && ctx.callbackQuery.from && ctx.callbackQuery.from.id);
		if (!userId) {
			console.log('🚫 Banned middleware: No userId found');
			return next();
		}
		
		console.log('🔍 Banned middleware: Checking user', userId);
		
		// Check if user is banned with a direct, fast query
		const bannedRole = await knex('userRoles')
			.where('userId', userId)
			.where('role', 'banned')
			.first();
			
		if (bannedRole) {
			console.log('🚫 Banned middleware: User', userId, 'is banned, ignoring');
			return; // ignore banned users silently
		}
		console.log('✅ Banned middleware: User', userId, 'is not banned, proceeding');
	} catch (error) {
		console.log('❌ Banned middleware error:', error);
	}
	return next();
};


