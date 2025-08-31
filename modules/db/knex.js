const knex = require('knex');
const config = require('../../knexfile');

let instance = null;

function getKnex () {
	if (!instance) instance = knex(config);
	return instance;
}

module.exports = getKnex();


