exports.up = function(knex) {
  return knex.schema.hasTable('invitationLinks').then((exists) => {
    if (exists) return;
    return knex.schema.createTable('invitationLinks', function(table) {
      table.increments('id').primary();
      table.bigInteger('userId').notNullable();
      table.string('groupPeriod').notNullable(); // The unique part of the invite link
      table.string('groupType').defaultTo('logs'); // 'main' or 'logs'
      table.string('telegramInviteLink').notNullable(); // Full invite link
      table.string('telegramInviteLinkName').nullable();
      table.bigInteger('telegramInviteLinkCreatorId').nullable();
      table.boolean('telegramInviteLinkIsPrimary').defaultTo(false);
      table.boolean('telegramInviteLinkIsRevoked').defaultTo(false);
      table.timestamp('telegramInviteLinkExpireDate').nullable();
      table.integer('telegramInviteLinkMemberLimit').defaultTo(1);
      table.boolean('createsJoinRequest').defaultTo(true); // Approval mode
      table.integer('useCount').defaultTo(0); // How many times it's been used
      table.timestamp('usedAt').nullable(); // When it was used
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
      // Foreign key constraint
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
      
      // Indexes
      table.index('userId');
      table.index('groupPeriod');
      table.index('usedAt');
    });
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('invitationLinks');
};
