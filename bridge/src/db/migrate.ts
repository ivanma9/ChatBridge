import 'dotenv/config'
import { promises as fs } from 'fs'
import { FileMigrationProvider, Migrator } from 'kysely'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { initDb, destroyDb } from './connection.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runMigrations() {
  const db = initDb()

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  results?.forEach((r) => {
    if (r.status === 'Success') {
      console.log(`Migration "${r.migrationName}" executed successfully`)
    } else if (r.status === 'Error') {
      console.error(`Migration "${r.migrationName}" failed`)
    }
  })

  if (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  await destroyDb()
  console.log('Migrations complete')
}

runMigrations()
