#!/usr/bin/env node
/**
 * Downloads the FamilySearch GEDCOM 7 validation spec used by integration tests.
 * Run once before the full test suite: npm run test:setup
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = join(__dirname, 'fixtures/g7validation.json')
const SPEC_URL =
  'https://raw.githubusercontent.com/FamilySearch/GEDCOM-registries/main/generated_files/g7validation.json'

console.log('Downloading FamilySearch GEDCOM 7 specification…')
const res = await fetch(SPEC_URL)
if (!res.ok) throw new Error(`HTTP ${res.status} — cannot reach ${SPEC_URL}`)

const text = await res.text()
await mkdir(join(__dirname, 'fixtures'), { recursive: true })
await writeFile(FIXTURE_PATH, text, 'utf-8')
console.log(`Saved → ${FIXTURE_PATH}`)
console.log('Setup complete. You can now run: npm test')
