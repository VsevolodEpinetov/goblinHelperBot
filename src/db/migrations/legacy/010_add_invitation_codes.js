/**
 * Add invitation codes to applications table
 * This allows searching for applications by invitation code (гоблин-XXXX format)
 */

exports.up = async function(knex) {
  // Add invitation code column to applications table
  await knex.schema.alterTable('applications', function(table) {
    table.string('invitationCode', 20).nullable().unique();
    table.index('invitationCode');
  });
  
  // Generate invitation codes for existing applications that don't have them
  const existingApplications = await knex('applications')
    .whereNull('invitationCode')
    .select('id', 'userId');
  
  for (const app of existingApplications) {
    const invitationCode = `гоблин-${app.userId.toString().slice(-4)}`;
    await knex('applications')
      .where('id', app.id)
      .update({ invitationCode });
  }
};

exports.down = async function(knex) {
  await knex.schema.alterTable('applications', function(table) {
    table.dropIndex('invitationCode');
    table.dropColumn('invitationCode');
  });
};
