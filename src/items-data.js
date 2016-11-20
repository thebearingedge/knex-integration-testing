export default function itemsData(db) {

  return {
    find,
    findById,
    create,
    updateById,
    deleteById
  }

  function find() {
    return db
      .select('*')
      .from('items')
  }

  function findById(id) {
    return db
      .select('*')
      .from('items')
      .where({ id })
      .first()
  }

  async function create(item) {
    const [ id ] = await db
      .insert(item)
      .into('items')
      .returning('id')
    return findById(id)
  }

  async function updateById(id, props) {
    await db
      .update(props)
      .where({ id })
      .into('items')
    return findById(id)
  }

  async function deleteById(id) {
    const [ deleted ] = await db
      .delete()
      .from('items')
      .where({ id })
      .returning('id')
    return !!deleted
  }
}
