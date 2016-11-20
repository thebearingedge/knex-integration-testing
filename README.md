---
title: Leveraging Database Transactions for Integration Tests
date: 2016-11-11 15:53:12
author: Tim Davis
tags: node, sql, postgresql, knex
categories: JavaScript, SQL, Testing
---

In the worlds of Java, C#, and Ruby, a common strategy for testing code that touches the database is to wrap tests in transactions. This ensures a consistent database state at the start of every test.

1. `BEGIN;` a transaction.
2. Run a data access method in the context of the transaction.
3. Make an assertion about the result.
4. `ROLLBACK;` the transaction

I had trouble finding examples of this approach in JavaScript, but after digging around I found [this issue](https://github.com/tgriesser/knex/issues/353) and was able to flesh things out and incorporate it into my projects.

## Criteria for Success

1. Automated setup of a known database state.
2. Repeatable, isolated tests.
3. Minimal and consistent boilerplate.

## Application

Let's build a simple inventory catalog including item bundles.

## Tools

We'll be using [Knex](http://knexjs.org/#), [Mocha](https://mochajs.org/), and [Chai](http://chaijs.com/) to build a PostgreSQL data access layer in JavaScript.

#### Knex

> Knex.js is a "batteries included" SQL query builder for Postgres, MSSQL, MySQL, MariaDB, SQLite3, and Oracle designed to be flexible, portable, and fun to use.

##### JavaScript

```js
// example.knex.js
import knex from 'knex'
import { connection } from './config'

const db = knex(connection)

db
  .select('id', 'username')
  .from('users')
  .where('username', 'foo')
  .first()
  .then(user => /* the user named "foo" */)
```

##### SQL Command

```sql
select "id", "username" from "users" where "username" = 'foo' limit 1;
```

#### Mocha

> Mocha is a feature-rich JavaScript test framework running on Node.js and in the browser, making asynchronous testing simple and fun.

```js
// example.mocha.js
import { before, describe, beforeEach, context, it } from 'mocha'

before(() => /* do something before all tests */)

describe('my subject under test', () => {

  beforeEach(() => /* do something before each test */)

  context('when this happens', () => {
    // this
    it('does this...')
  })

  context('when that happens', () => {
    // that
    it('does that...')
  })

})
```

#### Chai

> Chai is a BDD / TDD assertion library for node and the browser that can be delightfully paired with any javascript testing framework.

```js
// example.chai.js
import { it } from 'mocha'
import { expect } from 'chai'

it('tells the truth', () => {
  expect(true).to.be.true
})
```

## Step 1: Setting Up the Environment

First things first, we'll need a database to develop against. Once you have PostgreSQL with `psql` installed, create a user and database.

```bash
λ createuser inventory
λ createdb -O inventory inventory
```

Next, let's scaffold out the project.

```bash
λ mkdir inventory && cd inventory
λ npm init --yes
λ npm install -S knex pg
λ npm install -D babel-cli babel-plugin-transform-es2015-modules-commonjs babel-plugin-transform-async-to-generator knex mocha chai
λ touch .babelrc
λ mkdir src && touch src/example.test.js
```

We'll be authoring our project with ES2015 modules and `async/await` so let's configure `.babelrc`.

```json
{
  "plugins": [
    "transform-async-to-generator",
    "transform-es2015-modules-commonjs"
  ]
}
```

Now we need to add some test `scripts` to `package.json`.

```json
{
  "scripts": {
    "test": "mocha -r babel-register src/*.test.js",
    "tdd": "npm t -s -- -w -R min"
  }
}
```

##### `npm test`

Run the `mocha` executable in `node_modules/.bin` against `.test.js` files in `src/`, requiring `babel-register` to transform our modules.

```bash
λ npm test
# 0 passing (0ms)
```

##### `npm run tdd`

Same as above, but using a minimal reporter and watching for file changes.

```bash
λ npm run tdd # 0 passing (0ms)
```

Now to add some database-specific `scripts` to `package.json`.

```json
{
  "scripts": {
    "test": "mocha -r babel-register src/*.test.js",
    "tdd": "npm t -s -- -w -R min",
    "db": "babel-node node_modules/.bin/knex --",
    "db:make": "npm run -s db migrate:make --",
    "db:up": "npm run -s db migrate:latest",
    "db:down": "npm run -s db migrate:rollback"
  }
}
```

##### `npm run db`

Run the `knex` executable in `node_modules/.bin/` with `babel-node` to transform our modules, passing any following commands.

##### `npm run db:make`, `db:up`, or `db:down`

Aliases for the [`knex` migration commands](http://knexjs.org/#Migrations-CLI), but run with `babel-node` per our `db` script.

Lastly, let's generate a `knexfile.js`:

```bash
λ npm run db init
```

and replace its contents with:

```js
export const development = {
  client: 'postgresql',
  connection: {
    database: 'inventory',
    user: 'inventory'
  },
  seeds: {
    directory: 'seeds/dev'
  }
}
```

## Step 2: Make a Table Migration

```bash
λ npm run db:make table-items
```

By default `knex` will drop migration files into `./migrations`, creating the directory if necessary. Replace the file's contents with:

```js
// migrations/<created-at>_table-items.js
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
```

```bash
λ npm run db:up
# Using environment: development
# Batch 1 run: 1 migrations
```

## Step 3: Make a Seed Script

```bash
λ npm run db seed:make index
# Using environment: development
# Created seed file: /path/to/seeds/dev/index.js
```

We want to restore our database to a known state before running tests so let's reset everything (except the `knex_migration` tables) and insert some data.

```js
// seeds/dev/index.js
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
      { sku: 'toolbelt', description: 'A Stylish Toolbelt' }
    ])
    .into('items')
}
```

Let's run this to make sure everything works.

```bash
λ npm run db seed:run
# Using environment: development
# Ran 1 seed files
λ psql -c 'select * from items;' inventory
# id |   sku    | mpn |    description
# ----+----------+-----+--------------------
#  1 | hammer   |     | A Claw Hammer
#  2 | drill    |     | A Power Drill
#  3 | toolbelt |     | A Stylish Toolbelt
# (3 rows)
```

## Step 4: Prep the Test Harness

Once we've confirmed that `npm test` and `npm run tdd` give the expected results (`0 passing (0ms)`), prep the test harness by creating adding the following to `src/__test__.js`:

```js
// src/__test__.js
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
```

Before the any tests run, seed the database. After all tests are finished, destroy the database connection pool.

At this point our project should look like this:

```
/path/to/inventory/
├── migrations
│   └── <created-at>_table-items.js
├── node_modules
├── seeds
│   └── dev
│       └── index.js
├── src
│   ├── __test__.js
│   └── example.test.js
├── .babelrc
├── knexfile.js
├── package.json
└── README.md
```

## Step 5: Write A Failing Test!

Yep. We can totally TDD this thing from here. Let's write one.

```bash
λ mv src/example.test.js src/items-data.test.js
```

```js
// src/items-data.test.js
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
      expect(list).to.have.length.above(0)
    })

  })

})
```

Of course, this test fails because our source file hasn't been authored yet.

```js
// src/items-data.js
export default function itemsData(db) {

  return { find }

  function find() {
    return db
      .select('*')
      .from('items')
  }
}
```

Ok, so let's backtrack and explain what is going on in our `beforeEach` and `afterEach` hooks, starting with `begin`. Notice how `begin` is closed over the `db` object.

```js
const begin = setup => done => {
  rejected(db.transaction(trx => {
    setup(trx)
    done()
  }))
}
```

A call to `begin(setup)` returns another function. Let's call that `asyncHook` for the moment.

```js
const setup = _trx => { /* do something with _trx */ }

const asyncHook = begin(setup)

beforeEach(asyncHook)
```

This `asyncHook` is a closure over `setup` and expects one parameter; `done`. We pass `asyncHook` to `beforeEach` which in turn invokes passes it a `done` callback. The test suite then waits for `done` to be called. A database transaction is passed to `setup`, then `done` is called, allowing the test suite to proceed. This way, we can pop a fresh `trx` object into the scope of each test and create a new `items` object.

`afterEach` test we simply rollback the transaction. `begin` has wrapped `db.transaction()` with `rejected` to handle the promise rejection of `trx.rollback()`.

```js
describe('items', () => {

  let trx
  let items

  beforeEach(begin(_trx => {
    trx = _trx
    items = itemsData(trx)
  }))

  afterEach(() => trx.rollback())

})
```

Why does this work? The `trx` object exposes a `knex` query builder interface, so our `items` object can happily delegate database queries to it as normal.

```js
function find() {
  return db // <- really a transaction object in tests 😆
    .select('*')
    .from('items')
}
```

Let's add some other tests to `items-data.test.js`...

```js
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
```

...and their respective implementations to `items-data.js`.

```js
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
```
