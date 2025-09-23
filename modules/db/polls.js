/**
 * Database helper functions for polls system
 */

const knex = require('./knex');

/**
 * Get all active core studios
 * @returns {Promise<Array>} Array of core studio objects
 */
async function getCoreStudios() {
  try {
    const studios = await knex('polls_core_studios')
      .orderBy('name', 'asc')
      .select('name');
    
    return studios;
  } catch (error) {
    console.error('Error getting core studios:', error);
    return [];
  }
}

/**
 * Get all dynamic studios
 * @returns {Promise<Array>} Array of dynamic studio objects
 */
async function getDynamicStudios() {
  try {
    const studios = await knex('polls_studios')
      .orderBy('name', 'asc')
      .select('name');
    
    return studios;
  } catch (error) {
    console.error('Error getting dynamic studios:', error);
    return [];
  }
}

/**
 * Get all studios (core + dynamic)
 * @returns {Promise<Array>} Array of studio names
 */
async function getAllStudios() {
  try {
    const coreStudios = await getCoreStudios();
    const dynamicStudios = await getDynamicStudios();
    
    const allStudios = [...coreStudios, ...dynamicStudios]
      .map(s => s.name)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    return allStudios;
  } catch (error) {
    console.error('Error getting all studios:', error);
    return [];
  }
}

/**
 * Add a studio to dynamic studios
 * @param {string} studioName - Name of the studio to add
 * @returns {Promise<boolean>} Success status
 */
async function addStudio(studioName) {
  try {
    await knex('polls_studios').insert({
      name: studioName
    });

    return true;
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      console.log(`Studio ${studioName} already exists`);
      return false;
    }
    console.error('Error adding studio:', error);
    return false;
  }
}

/**
 * Remove a studio from dynamic studios
 * @param {string} studioName - Name of the studio to remove
 * @returns {Promise<boolean>} Success status
 */
async function removeStudio(studioName) {
  try {
    const deleted = await knex('polls_studios')
      .where('name', studioName)
      .del();

    return deleted > 0;
  } catch (error) {
    console.error('Error removing studio:', error);
    return false;
  }
}

/**
 * Add a studio to core studios
 * @param {string} studioName - Name of the studio to add
 * @returns {Promise<boolean>} Success status
 */
async function addCoreStudio(studioName) {
  try {
    await knex('polls_core_studios').insert({
      name: studioName
    });

    return true;
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      console.log(`Core studio ${studioName} already exists`);
      return false;
    }
    console.error('Error adding core studio:', error);
    return false;
  }
}

/**
 * Remove a studio from core studios
 * @param {string} studioName - Name of the studio to remove
 * @returns {Promise<boolean>} Success status
 */
async function removeCoreStudio(studioName) {
  try {
    const deleted = await knex('polls_core_studios')
      .where('name', studioName)
      .del();

    return deleted > 0;
  } catch (error) {
    console.error('Error removing core studio:', error);
    return false;
  }
}

/**
 * Clear all dynamic studios
 * @returns {Promise<boolean>} Success status
 */
async function clearDynamicStudios() {
  try {
    await knex('polls_studios').del();
    return true;
  } catch (error) {
    console.error('Error clearing dynamic studios:', error);
    return false;
  }
}

/**
 * Get studio statistics
 * @returns {Promise<Object>} Studio statistics
 */
async function getStats() {
  try {
    const coreCount = await knex('polls_core_studios')
      .count('* as count')
      .first();

    const dynamicCount = await knex('polls_studios')
      .count('* as count')
      .first();

    return {
      coreStudios: parseInt(coreCount.count),
      dynamicStudios: parseInt(dynamicCount.count),
      totalStudios: parseInt(coreCount.count) + parseInt(dynamicCount.count)
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { coreStudios: 0, dynamicStudios: 0, totalStudios: 0 };
  }
}

module.exports = {
  getCoreStudios,
  getDynamicStudios,
  getAllStudios,
  addStudio,
  removeStudio,
  addCoreStudio,
  removeCoreStudio,
  clearDynamicStudios,
  getStats
};
