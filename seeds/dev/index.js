export const seed = async knex => {

  const { tables } = await knex
    .select(knex.raw('array_to_json(array_agg(tablename)) as tables'))
    .from('pg_tables')
    .where('schemaname', 'public')
    .whereNot('tablename', 'like', '%migrations%')
    .first()

  await knex.raw(`truncate table ${tables} restart identity`)

  await knex
    .insert([
      { sku: 'hammer', description: 'A Claw Hammer' },
      { sku: 'drill', description: 'A Power Drill' },
      { sku: 'toolbelt', description: 'A Useful Belt' }
    ])
    .into('items')
}
