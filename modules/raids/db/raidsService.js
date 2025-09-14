const knex = require('../../db/knex');

class RaidsService {
  // Create a new raid
  async createRaid(raidData) {
    const trx = await knex.transaction();
    
    try {
      // Insert raid
      const [raidResult] = await trx('raids').insert({
        title: raidData.title || 'Рейд без названия',
        description: raidData.description || '',
        link: raidData.link || '',
        price: raidData.price,
        currency: raidData.currency || 'RUB',
        status: 'open',
        created_by: raidData.created_by,
        created_by_username: raidData.created_by_username,
        created_by_first_name: raidData.created_by_first_name,
        created_by_last_name: raidData.created_by_last_name,
        chat_id: raidData.chat_id,
        message_id: raidData.message_id,
        end_date: raidData.end_date,
        metadata: raidData.metadata || {}
      }).returning('id');
      
      const raidId = raidResult.id;

      // Insert photos
      if (raidData.photos && raidData.photos.length > 0) {
        const photoInserts = raidData.photos.map((photo, index) => ({
          raid_id: raidId,
          file_id: photo.file_id,
          order_index: photo.order_index || index
        }));
        
        await trx('raid_photos').insert(photoInserts);
      }

      // Insert creator as first participant
      await trx('raid_participants').insert({
        raid_id: raidId,
        user_id: raidData.created_by,
        username: raidData.created_by_username,
        first_name: raidData.created_by_first_name,
        last_name: raidData.created_by_last_name
      });

      await trx.commit();
      return { success: true, raidId };
      
    } catch (error) {
      await trx.rollback();
      console.error('Error creating raid:', error);
      return { success: false, error: error.message };
    }
  }

  // Get raid by ID with all related data
  async getRaidById(raidId) {
    try {
      const raid = await knex('raids')
        .select('*')
        .where('id', raidId)
        .first();

      if (!raid) {
        return null;
      }

      // Get photos
      const photos = await knex('raid_photos')
        .select('file_id', 'order_index')
        .where('raid_id', raidId)
        .orderBy('order_index');

      // Get participants
      const participants = await knex('raid_participants')
        .select('user_id', 'username', 'first_name', 'last_name', 'joined_at')
        .where('raid_id', raidId)
        .orderBy('joined_at');

      return {
        ...raid,
        photos: photos.map(p => ({
          file_id: p.file_id,
          order_index: p.order_index
        })),
        participants: participants.map(p => ({
          user_id: p.user_id,
          username: p.username,
          first_name: p.first_name,
          last_name: p.last_name,
          joined_at: p.joined_at
        }))
      };
    } catch (error) {
      console.error('Error getting raid by ID:', error);
      return null;
    }
  }

  // Get all raids with filters
  async getRaids(filters = {}) {
    try {
      let query = knex('raids as r')
        .select(
          'r.*',
          knex.raw('array_agg(DISTINCT rp.file_id ORDER BY rp.order_index) as photos'),
          knex.raw('array_agg(DISTINCT jsonb_build_object(\'user_id\', p.user_id, \'username\', p.username, \'first_name\', p.first_name, \'last_name\', p.last_name, \'joined_at\', p.joined_at)) as participants')
        )
        .leftJoin('raid_photos as rp', 'r.id', 'rp.raid_id')
        .leftJoin('raid_participants as p', 'r.id', 'p.raid_id')
        .groupBy('r.id');

      // Apply filters
      if (filters.status) {
        query = query.where('r.status', filters.status);
      }
      
      if (filters.created_by) {
        query = query.where('r.created_by', filters.created_by);
      }
      
      if (filters.maxPrice) {
        query = query.where('r.price', '<=', filters.maxPrice);
      }
      
      if (filters.currency) {
        query = query.where('r.currency', filters.currency);
      }

      // Apply sorting
      if (filters.sortBy === 'price') {
        query = query.orderBy('r.price', filters.sortOrder || 'asc');
      } else if (filters.sortBy === 'created') {
        query = query.orderBy('r.created_at', filters.sortOrder || 'desc');
      } else {
        query = query.orderBy('r.created_at', 'desc');
      }

      return await query;
    } catch (error) {
      console.error('Error getting raids:', error);
      return [];
    }
  }

  // Join a raid
  async joinRaid(raidId, userData) {
    try {
      console.log(`🔍 joinRaid called with raidId: ${raidId}, userData:`, userData);
      
      // Check if user is already participating
      const existing = await knex('raid_participants')
        .where('raid_id', raidId)
        .where('user_id', userData.user_id)
        .first();

      console.log(`🔍 Existing participation check:`, existing);

      if (existing) {
        return { success: false, error: 'User already participating in this raid' };
      }

      // Check if raid is still open
      const raid = await knex('raids')
        .where('id', raidId)
        .where('status', 'open')
        .first();

      console.log(`🔍 Raid status check:`, raid);

      if (!raid) {
        return { success: false, error: 'Raid is not available for joining' };
      }

      // Add participant
      const insertResult = await knex('raid_participants').insert({
        raid_id: raidId,
        user_id: userData.user_id,
        username: userData.username,
        first_name: userData.first_name,
        last_name: userData.last_name
      });

      console.log(`🔍 Insert result:`, insertResult);

      return { success: true };
    } catch (error) {
      console.error('Error joining raid:', error);
      return { success: false, error: error.message };
    }
  }

  // Leave a raid
  async leaveRaid(raidId, userId) {
    try {
      // Check if user is participating
      const existing = await knex('raid_participants')
        .where('raid_id', raidId)
        .where('user_id', userId)
        .first();

      if (!existing) {
        return { success: false, error: 'User is not participating in this raid' };
      }

      // Check if user is the creator
      const raid = await knex('raids')
        .where('id', raidId)
        .where('created_by', userId)
        .first();

      if (raid) {
        return { success: false, error: 'Creator cannot leave their own raid' };
      }

      // Remove participant
      await knex('raid_participants')
        .where('raid_id', raidId)
        .where('user_id', userId)
        .del();

      return { success: true };
    } catch (error) {
      console.error('Error leaving raid:', error);
      return { success: false, error: error.message };
    }
  }

  // Close a raid
  async closeRaid(raidId, userId) {
    try {
      // Check if user is authorized to close the raid
      const raid = await knex('raids')
        .where('id', raidId)
        .first();

      if (!raid) {
        return { success: false, error: 'Raid not found' };
      }

      // Only creator or admin can close
      if (raid.created_by !== userId) {
        // Check if user is admin (you might want to add admin check here)
        return { success: false, error: 'Not authorized to close this raid' };
      }

      // Update status
      await knex('raids')
        .where('id', raidId)
        .update({ status: 'closed' });

      return { success: true };
    } catch (error) {
      console.error('Error closing raid:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user's raids (both created and participated)
  async getUserRaids(userId, filters = {}) {
    try {
      // First get the raid IDs
      let query = knex('raids as r')
        .distinct('r.id', 'r.created_at')
        .leftJoin('raid_participants as p', 'r.id', 'p.raid_id')
        .where(function() {
          this.where('r.created_by', userId)
            .orWhere('p.user_id', userId);
        });

      if (filters.status) {
        query = query.where('r.status', filters.status);
      }

      const raidIds = await query.orderBy('r.created_at', 'desc');
      
      if (raidIds.length === 0) {
        return [];
      }

      // Now get full raid details with participants for each raid
      const raids = [];
      for (const { id } of raidIds) {
        const raid = await this.getRaidById(id);
        if (raid) {
          raids.push(raid);
        }
      }

      return raids;
    } catch (error) {
      console.error('Error getting user raids:', error);
      return [];
    }
  }

  // Get user's created raids only
  async getUserCreatedRaids(userId, filters = {}) {
    try {
      console.log('🔍 getUserCreatedRaids: userId =', userId, 'type:', typeof userId);
      let query = knex('raids as r')
        .where('r.created_by', userId);

      if (filters.status) {
        query = query.where('r.status', filters.status);
      }

      const raidIds = await query.orderBy('r.created_at', 'desc');
      console.log('🔍 getUserCreatedRaids: raidIds =', raidIds);
      
      if (raidIds.length === 0) {
        return [];
      }

      // Now get full raid details with participants for each raid
      const raids = [];
      for (const { id } of raidIds) {
        const raid = await this.getRaidById(id);
        if (raid) {
          console.log('🔍 getUserCreatedRaids: raid =', { id: raid.id, created_by: raid.created_by, type: typeof raid.created_by });
          raids.push(raid);
        }
      }

      return raids;
    } catch (error) {
      console.error('Error getting user created raids:', error);
      return [];
    }
  }

  // Update raid data
  async updateRaid(raidId, updateData) {
    try {
      console.log(`🔍 Updating raid ${raidId} with data:`, updateData);
      
      await knex('raids')
        .where('id', raidId)
        .update({
          ...updateData,
          updated_at: knex.fn.now()
        });
      
      // Raid updated successfully
      return { success: true };
    } catch (error) {
      console.error('Error updating raid:', error);
      return { success: false, error: error.message };
    }
  }

  // Update raid message IDs
  async updateRaidMessageIds(raidId, messageIds) {
    try {
      console.log(`🔍 Updating message IDs for raid ${raidId}:`, messageIds);
      
      await knex('raids')
        .where('id', raidId)
        .update({
          message_id: messageIds[0] || null,
          metadata: knex.raw('metadata || ?', [JSON.stringify({ messageIds })])
        });
      
      // Message IDs updated
      return { success: true };
    } catch (error) {
      console.error('Error updating raid message IDs:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new RaidsService();
