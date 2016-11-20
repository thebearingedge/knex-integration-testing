import { describe, beforeEach, afterEach, it } from 'mocha'
import { begin, expect } from './__test__'
import itemsData from './items-data'

describe('items', () => {

  let trx
  let items

  beforeEach(begin(_trx => {
    trx = _trx
    items = itemsData(trx)
  }))

  afterEach(() => trx.rollback())

  describe('find', () => {

    it('returns a list of items', async () => {
      const list = await items.find()
      expect(list).to.have.length.above(1)
    })

  })

  describe('findById', () => {

    it('finds one item', async () => {
      const item = await items.findById(1)
      expect(item).to.have.keys([
        'id', 'sku', 'mpn', 'description'
      ])
    })

  })

  describe('create', () => {

    it('creates an item', async () => {
      const item = { sku: 'saw', description: 'A Nice Saw' }
      const created = await items.create(item)
      expect(created).to.contain.keys(['id', 'mpn'])
      expect(created).to.include(item)
    })

  })

  describe('updateById', () => {

    it('updates an item', async () => {
      const updates = { description: 'Our best seller!' }
      const updated = await items.updateById(1, updates)
      expect(updated).to.include(updates)
    })

  })

  describe('deleteById', () => {

    it('deletes an item', async () => {
      const deleted = await items.deleteById(1)
      expect(deleted).to.be.true
    })

  })

})
