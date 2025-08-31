const knex = require('../../db/knex');

class LotsService {
  // Create a new lot
  async createLot(lotData) {
    const trx = await knex.transaction();
    
    try {
      // Insert main lot data
      const [lot] = await trx('lots').insert({
        title: lotData.name,
        description: lotData.link,
        author: lotData.author,
        price: lotData.price,
        currency: lotData.currency,
        created_by: lotData.whoCreated.id,
        chat_id: lotData.chatID,
        message_id: lotData.messageID,
        additional_message_id: lotData.additionalMessageID,
        metadata: {
          original_photos: lotData.photos,
          original_organizer: lotData.whoCreated
        }
      }).returning('*');

      // Insert photos
      if (lotData.photos && lotData.photos.length > 0) {
        const photoRecords = lotData.photos.map((fileId, index) => ({
          lot_id: lot.id,
          file_id: fileId,
          order_index: index
        }));
        
        await trx('lot_photos').insert(photoRecords);
      }

      // Insert tags if provided
      if (lotData.tags && lotData.tags.length > 0) {
        const tagAssignments = lotData.tags.map(tagId => ({
          lot_id: lot.id,
          tag_id: tagId
        }));
        
        await trx('lot_tag_assignments').insert(tagAssignments);
      }

      await trx.commit();
      return lot;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // Update lot message IDs
  async updateLotMessageId(lotId, messageId, chatId, additionalMessageId = null) {
    const updateData = {
      message_id: messageId,
      chat_id: chatId,
      updated_at: knex.fn.now()
    };
    
    if (additionalMessageId) {
      updateData.additional_message_id = additionalMessageId;
    }
    
    return await knex('lots')
      .where('id', lotId)
      .update(updateData);
  }

  // Get lot by ID with all related data
  async getLotById(lotId) {
    const lot = await knex('lots')
      .select('*')
      .where('id', lotId)
      .first();

    if (!lot) return null;

    // Get photos
    const photos = await knex('lot_photos')
      .select('file_id', 'order_index')
      .where('lot_id', lotId)
      .orderBy('order_index');

    // Get participants
    const participants = await knex('lot_participants')
      .select('*')
      .where('lot_id', lotId);

    // Get tags
    const tags = await knex('lot_tag_assignments as lta')
      .join('lot_tags as lt', 'lta.tag_id', 'lt.id')
      .join('lot_categories as lc', 'lt.category_id', 'lc.id')
      .select('lt.id', 'lt.name', 'lt.description', 'lc.name as category_name', 'lc.icon')
      .where('lta.lot_id', lotId);

    return {
      ...lot,
      photos: photos.map(p => p.file_id),
      participants,
      tags
    };
  }

  // Get all lots with filters
  async getLots(filters = {}) {
    let query = knex('lots as l')
      .select(
        'l.*',
        knex.raw('array_agg(DISTINCT lp.file_id ORDER BY lp.order_index) as photos'),
        knex.raw('array_agg(DISTINCT jsonb_build_object(\'id\', p.user_id, \'username\', p.username, \'first_name\', p.first_name, \'last_name\', p.last_name)) as participants')
      )
      .leftJoin('lot_photos as lp', 'l.id', 'lp.lot_id')
      .leftJoin('lot_participants as p', 'l.id', 'p.lot_id')
      .groupBy('l.id');

    // Apply filters
    if (filters.status) {
      query = query.where('l.status', filters.status);
    }
    
    if (filters.category) {
      query = query.join('lot_tag_assignments as lta', 'l.id', 'lta.lot_id')
        .join('lot_tags as lt', 'lta.tag_id', 'lt.id')
        .where('lt.category_id', filters.category);
    }
    
    if (filters.maxPrice) {
      query = query.where('l.price', '<=', filters.maxPrice);
    }
    
    if (filters.currency) {
      query = query.where('l.currency', filters.currency);
    }

    // Apply hashtag filters
    if (filters.hashtags && filters.hashtags.length > 0) {
      query = query.join('lot_tag_assignments as lta2', 'l.id', 'lta2.lot_id')
        .join('lot_tags as lt2', 'lta2.tag_id', 'lt2.id')
        .whereIn('lt2.name', filters.hashtags);
    }

    // Apply sorting
    if (filters.sortBy === 'price') {
      query = query.orderBy('l.price', filters.sortOrder || 'asc');
    } else if (filters.sortBy === 'created') {
      query = query.orderBy('l.created_at', filters.sortOrder || 'desc');
    } else {
      query = query.orderBy('l.created_at', 'desc');
    }

    return await query;
  }

  // Search lots by specific tag/hashtag
  async searchLotsByTag(tagName, filters = {}) {
    let query = knex('lots as l')
      .select(
        'l.*',
        knex.raw('array_agg(DISTINCT lp.file_id ORDER BY lp.order_index) as photos'),
        knex.raw('array_agg(DISTINCT jsonb_build_object(\'id\', p.user_id, \'username\', p.username, \'first_name\', p.first_name, \'last_name\', p.last_name)) as participants')
      )
      .join('lot_tag_assignments as lta', 'l.id', 'lta.lot_id')
      .join('lot_tags as lt', 'lta.tag_id', 'lt.id')
      .leftJoin('lot_photos as lp', 'l.id', 'lp.lot_id')
      .leftJoin('lot_participants as p', 'l.id', 'p.lot_id')
      .where('lt.name', tagName)
      .groupBy('l.id');

    // Apply additional filters
    if (filters.status) {
      query = query.where('l.status', filters.status);
    }
    
    if (filters.maxPrice) {
      query = query.where('l.price', '<=', filters.maxPrice);
    }
    
    if (filters.currency) {
      query = query.where('l.currency', filters.currency);
    }

    // Apply sorting
    if (filters.sortBy === 'price') {
      query = query.orderBy('l.price', filters.sortOrder || 'asc');
    } else if (filters.sortBy === 'created') {
      query = query.orderBy('l.created_at', filters.sortOrder || 'desc');
    } else {
      query = query.orderBy('l.created_at', 'desc');
    }

    return await query;
  }

  // Update lot status
  async updateLotStatus(lotId, status) {
    return await knex('lots')
      .where('id', lotId)
      .update({ status, updated_at: knex.fn.now() });
  }

  // Add participant to lot
  async addParticipant(lotId, userData) {
    return await knex('lot_participants').insert({
      lot_id: lotId,
      user_id: userData.id,
      username: userData.username,
      first_name: userData.first_name,
      last_name: userData.last_name
    }).onConflict(['lot_id', 'user_id']).ignore();
  }

  // Remove participant from lot
  async removeParticipant(lotId, userId) {
    return await knex('lot_participants')
      .where({ lot_id: lotId, user_id: userId })
      .del();
  }

  // Get user preferences
  async getUserPreferences(userId) {
    let prefs = await knex('user_preferences')
      .where('user_id', userId)
      .first();
    
    if (!prefs) {
      // Create default preferences
      prefs = await knex('user_preferences').insert({
        user_id: userId,
        favorite_categories: [],
        favorite_tags: [],
        notification_settings: {
          new_lots: true,
          price_alerts: true,
          category_updates: true
        },
        preferred_currency: 'USD'
      }).returning('*').then(([p]) => p);
    }
    
    return prefs;
  }

  // Update user preferences
  async updateUserPreferences(userId, preferences) {
    return await knex('user_preferences')
      .where('user_id', userId)
      .update({
        ...preferences,
        updated_at: knex.fn.now()
      });
  }

  // Add lot to user favorites
  async addToFavorites(userId, lotId) {
    return await knex('user_favorites').insert({
      user_id: userId,
      lot_id: lotId
    }).onConflict(['user_id', 'lot_id']).ignore();
  }

  // Remove lot from user favorites
  async removeFromFavorites(userId, lotId) {
    return await knex('user_favorites')
      .where({ user_id: userId, lot_id: lotId })
      .del();
  }

  // Get user's favorite lots
  async getUserFavorites(userId) {
    return await knex('user_favorites as uf')
      .join('lots as l', 'uf.lot_id', 'l.id')
      .select('l.*', 'uf.favorited_at')
      .where('uf.user_id', userId)
      .orderBy('uf.favorited_at', 'desc');
  }

  // Get all categories
  async getCategories() {
    return await knex('lot_categories')
      .where('is_active', true)
      .orderBy('name');
  }

  // Get tags by category
  async getTagsByCategory(categoryId) {
    return await knex('lot_tags')
      .where({ category_id: categoryId, is_active: true })
      .orderBy('name');
  }

  // Get all tags
  async getAllTags() {
    return await knex('lot_tags as lt')
      .join('lot_categories as lc', 'lt.category_id', 'lc.id')
      .select('lt.*', 'lc.name as category_name', 'lc.icon')
      .where('lt.is_active', true)
      .orderBy('lc.name', 'asc')
      .orderBy('lt.name', 'asc');
  }

  // Get popular tags (most used)
  async getPopularTags(limit = 20) {
    return await knex('lot_tag_assignments as lta')
      .join('lot_tags as lt', 'lta.tag_id', 'lt.id')
      .select('lt.*', knex.raw('COUNT(*) as usage_count'))
      .groupBy('lt.id')
      .orderBy('usage_count', 'desc')
      .limit(limit);
  }

  // Search lots by text
  async searchLots(searchTerm, filters = {}) {
    let query = knex('lots as l')
      .select('*')
      .where(function() {
        this.where('l.title', 'ilike', `%${searchTerm}%`)
          .orWhere('l.description', 'ilike', `%${searchTerm}%`)
          .orWhere('l.author', 'ilike', `%${searchTerm}%`);
      });

    // Apply additional filters
    if (filters.status) {
      query = query.where('l.status', filters.status);
    }
    
    if (filters.maxPrice) {
      query = query.where('l.price', '<=', filters.maxPrice);
    }

    return await query.orderBy('l.created_at', 'desc');
  }
}

module.exports = new LotsService();
