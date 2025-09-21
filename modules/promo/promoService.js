const knex = require('../db/knex');

/**
 * Promo Service
 * Handles promo file selection, cooldown management, and usage tracking
 */

const COOLDOWN_HOURS = 48;

/**
 * Get a random promo file that the user hasn't used recently
 * @param {number} userId - User ID
 * @returns {Object|null} Promo file data or null if none available
 */
async function getRandomPromoFile(userId) {
  try {
    // Get files that user hasn't used in the last 48 hours
    const cooldownThreshold = new Date(Date.now() - (COOLDOWN_HOURS * 60 * 60 * 1000));
    
    // First, get all active promo files
    const allFiles = await knex('promo_files')
      .where('is_active', true)
      .select('*');

    if (allFiles.length === 0) {
      return null;
    }

    // Get files that user has used recently (within cooldown)
    const recentlyUsedFiles = await knex('user_promo_usage')
      .where('user_id', userId)
      .where('used_at', '>', cooldownThreshold)
      .select('promo_file_id');

    const usedFileIds = recentlyUsedFiles.map(usage => usage.promo_file_id);
    
    // Filter out recently used files
    const availableFiles = allFiles.filter(file => !usedFileIds.includes(file.id));

    if (availableFiles.length === 0) {
      return null;
    }

    // Select random file
    const randomIndex = Math.floor(Math.random() * availableFiles.length);
    return availableFiles[randomIndex];
  } catch (error) {
    console.error('❌ Error getting random promo file:', error);
    return null;
  }
}

/**
 * Check if user is on cooldown for promo files
 * @param {number} userId - User ID
 * @returns {Object} { isOnCooldown: boolean, cooldownUntil: Date|null }
 */
async function checkUserCooldown(userId) {
  try {
    const latestUsage = await knex('user_promo_usage')
      .where('user_id', userId)
      .orderBy('used_at', 'desc')
      .first();

    if (!latestUsage) {
      return { isOnCooldown: false, cooldownUntil: null };
    }

    const now = new Date();
    const cooldownUntil = new Date(latestUsage.cooldown_until);
    
    return {
      isOnCooldown: now < cooldownUntil,
      cooldownUntil: cooldownUntil
    };
  } catch (error) {
    console.error('❌ Error checking user cooldown:', error);
    return { isOnCooldown: true, cooldownUntil: null };
  }
}

/**
 * Record promo file usage for a user
 * @param {number} userId - User ID
 * @param {number} promoFileId - Promo file ID
 * @returns {boolean} Success status
 */
async function recordPromoUsage(userId, promoFileId) {
  try {
    const cooldownUntil = new Date(Date.now() + (COOLDOWN_HOURS * 60 * 60 * 1000));
    
    await knex('user_promo_usage').insert({
      user_id: userId,
      promo_file_id: promoFileId,
      cooldown_until: cooldownUntil
    });

    return true;
  } catch (error) {
    console.error('❌ Error recording promo usage:', error);
    return false;
  }
}

/**
 * Get time remaining until cooldown ends
 * @param {Date} cooldownUntil - Cooldown end time
 * @returns {string} Formatted time remaining
 */
function getTimeRemaining(cooldownUntil) {
  const now = new Date();
  const diff = cooldownUntil - now;
  
  if (diff <= 0) {
    return '0 минут';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  } else {
    return `${minutes}м`;
  }
}

/**
 * Add a new promo file
 * @param {string} fileId - Telegram file ID
 * @param {string} fileType - File type (photo, video, document, etc.)
 * @param {string} fileName - Original file name
 * @param {number} fileSize - File size in bytes
 * @param {number} uploadedBy - Admin user ID who uploaded
 * @returns {boolean} Success status
 */
async function addPromoFile(fileId, fileType, fileName, fileSize, uploadedBy) {
  try {
    await knex('promo_files').insert({
      file_id: fileId,
      file_type: fileType,
      file_name: fileName,
      file_size: fileSize,
      uploaded_by: uploadedBy
    });

    return true;
  } catch (error) {
    console.error('❌ Error adding promo file:', error);
    return false;
  }
}

/**
 * Get all promo files (for admin interface)
 * @returns {Array} Array of promo files
 */
async function getAllPromoFiles() {
  try {
    return await knex('promo_files')
      .orderBy('uploaded_at', 'desc');
  } catch (error) {
    console.error('❌ Error getting all promo files:', error);
    return [];
  }
}

/**
 * Toggle promo file active status
 * @param {number} fileId - Promo file ID
 * @param {boolean} isActive - New active status
 * @returns {boolean} Success status
 */
async function togglePromoFileStatus(fileId, isActive) {
  try {
    await knex('promo_files')
      .where('id', fileId)
      .update({ is_active: isActive });

    return true;
  } catch (error) {
    console.error('❌ Error toggling promo file status:', error);
    return false;
  }
}

module.exports = {
  getRandomPromoFile,
  checkUserCooldown,
  recordPromoUsage,
  getTimeRemaining,
  addPromoFile,
  getAllPromoFiles,
  togglePromoFileStatus
};
