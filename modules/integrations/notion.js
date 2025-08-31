const { Client } = require('@notionhq/client');

const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DB || process.env.NOTION_DATABASE_ID;

const notion = token ? new Client({ auth: token }) : null;

async function safeCreatePage (properties) {
	if (!notion || !databaseId) return null;
	return notion.pages.create({
		parent: { database_id: databaseId },
		properties
	});
}

async function safeUpdatePage (pageId, properties) {
	if (!notion) return null;
	return notion.pages.update({ page_id: pageId, properties });
}

module.exports = { notion, databaseId, safeCreatePage, safeUpdatePage };


