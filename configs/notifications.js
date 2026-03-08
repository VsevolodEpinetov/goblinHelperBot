const SETTINGS = require('../settings.json');

module.exports = {
  rpgTopicId: Number(process.env.RPG_TOPIC_ID || SETTINGS.TOPICS?.GOBLIN?.RPG) || null,
  mainGroupId: Number(process.env.MAIN_GROUP_ID || SETTINGS.CHATS?.GOBLIN) || null
};
