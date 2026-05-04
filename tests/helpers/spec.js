/**
 * Loads the FamilySearch GEDCOM 7 validation spec from a local fixture.
 * If the fixture is absent, fetches it from GitHub and caches it for future runs.
 *
 * Run `npm run test:setup` once before executing the integration tests offline.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = join(__dirname, '../fixtures/g7validation.json')
const SPEC_URL =
  'https://raw.githubusercontent.com/FamilySearch/GEDCOM-registries/main/generated_files/g7validation.json'

let cached = null

export async function loadSpec() {
  if (cached) return cached

  if (existsSync(FIXTURE_PATH)) {
    cached = JSON.parse(await readFile(FIXTURE_PATH, 'utf-8'))
    return cached
  }

  const res = await fetch(SPEC_URL)
  if (!res.ok) {
    throw new Error(
      `Cannot load GEDCOM 7 spec (HTTP ${res.status}).\n` +
      'Run: npm run test:setup'
    )
  }
  const text = await res.text()
  await mkdir(dirname(FIXTURE_PATH), { recursive: true })
  await writeFile(FIXTURE_PATH, text, 'utf-8')
  cached = JSON.parse(text)
  return cached
}
