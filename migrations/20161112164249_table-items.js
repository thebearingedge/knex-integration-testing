export const up = ({ schema }) =>
  schema
    .createTable('items', tb => {
      tb.increments('id')
        .primary()
      tb.string('sku')
        .unique()
        .notNullable()
      tb.string('mpn')
      tb.text('description')
    })

export const down = ({ schema }) =>
  schema
    .dropTable('items')
