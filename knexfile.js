require('dotenv').config();

module.exports = {
	client: 'pg',
	connection: {
		host: process.env.PGHOST || '127.0.0.1',
		port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
		database: process.env.PGDATABASE || 'goblinhelperbot',
		user: process.env.PGUSER || 'goblinhelper',
		password: process.env.PGPASSWORD || null
	},
	pool: { min: 0, max: 10 },
	migrations: { tableName: 'knex_migrations' }
};


