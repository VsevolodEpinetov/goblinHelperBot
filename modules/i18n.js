const fs = require('fs');
const path = require('path');

let cached = null;

function loadLocale () {
	if (cached) return cached;
	const filePath = path.join(__dirname, '..', 'locales', 'ru.json');
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		cached = JSON.parse(raw);
		return cached;
	} catch (err) {
		cached = {};
		return cached;
	}
}

function interpolate (template, params) {
	return String(template).replace(/\{(\w+)\}/g, (_, key) => {
		return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : '';
	});
}

function t (key, params = {}) {
	const dict = loadLocale();
	const value = key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), dict);
	if (value === undefined) return key;
	if (typeof value === 'string') return interpolate(value, params);
	return value;
}

module.exports = { t, loadLocale };

