const { Pool } = require('pg');

const pool = new Pool({
	host: process.env.PGHOST || '127.0.0.1',
	port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
	database: process.env.PGDATABASE || 'goblinhelperbot',
	user: process.env.PGUSER || 'goblinhelper',
	password: process.env.PGPASSWORD || ''
});

async function query (text, params) {
	const client = await pool.connect();
	try {
		return await client.query(text, params);
	} finally {
		client.release();
	}
}

module.exports = {
	pool,
	query
};


