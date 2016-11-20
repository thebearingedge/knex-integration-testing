import { after } from 'mocha'
import { expect } from 'chai'
import knex from 'knex'
import { development } from '../knexfile'

const db = knex(development)

before(() => db.seed.run())

after(() => db.destroy())

const rejected = promise => promise.catch(err => err)

const begin = setup => done => {
  rejected(db.transaction(trx => {
    setup(trx)
    done()
  }))
}

export {
  rejected,
  expect,
  begin
}
