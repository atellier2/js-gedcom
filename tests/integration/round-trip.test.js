/**
 * End-to-end round-trip tests.
 * Verifies that parsing → serialising → re-parsing produces equivalent output.
 * Requires the GEDCOM 7 spec fixture: npm run test:setup
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { G7Lookups } from '../../src/g7lookups.js'
import { G7Dataset } from '../../src/g7structure.js'
import { GEDCStruct, g7ConfGEDC } from '../../src/gedcstruct.js'
import { loadSpec } from '../helpers/spec.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MINIMAL_GED = join(__dirname, '../fixtures/minimal.ged')

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let spec
let minimalText

before(async () => {
  ;[spec, minimalText] = await Promise.all([
    loadSpec(),
    readFile(MINIMAL_GED, 'utf-8'),
  ])
})

function makeLookup() {
  const lk = new G7Lookups(spec)
  lk.err  = () => {}
  lk.warn = () => {}
  return lk
}

// ---------------------------------------------------------------------------
// Layer 1 round-trip (GEDCStruct)
// ---------------------------------------------------------------------------

describe('GEDCStruct text round-trip', () => {
  // Use a self-contained string where every xref ID is referenced by a pointer,
  // so the serialiser preserves the IDs (unreferenced IDs are intentionally dropped).
  const ROUND_TRIP_TEXT = [
    '0 HEAD',
    '1 GEDC',
    '2 VERS 7.0',
    '1 SUBM @U1@',
    '0 @U1@ SUBM',
    '1 NAME Test',
    '0 TRLR',
    '',
  ].join('\n')

  it('fromString → toString reproduces the original text', () => {
    const gedc = GEDCStruct.fromString(ROUND_TRIP_TEXT, g7ConfGEDC)
    assert.equal(gedc.toString(), ROUND_TRIP_TEXT)
  })

  it('fromString → toJSON → fromJSON → toString is stable', () => {
    const original = GEDCStruct.fromString(ROUND_TRIP_TEXT, g7ConfGEDC)
    const json      = original.map(s => s.toJSON())
    const restored  = GEDCStruct.fromJSON(json)
    assert.equal(restored.toString(), original.toString())
  })
})

// ---------------------------------------------------------------------------
// Layer 2 round-trip (G7Dataset)
// ---------------------------------------------------------------------------

describe('G7Dataset text round-trip', () => {
  it('fromString → toString → fromString produces identical structure counts', () => {
    const first = G7Dataset.fromString(minimalText, makeLookup())
    const text2 = first.toString()
    const second = G7Dataset.fromString(text2, makeLookup())

    const T = 'https://gedcom.io/terms/v7/'
    assert.equal(
      first.records.get(T + 'record-INDI')?.length ?? 0,
      second.records.get(T + 'record-INDI')?.length ?? 0,
      'INDI count should be preserved through round-trip'
    )
  })

  it('serialised output can be re-parsed without syntax errors', () => {
    const errors = []
    const first  = G7Dataset.fromString(minimalText, makeLookup())
    GEDCStruct.fromString(first.toString(), g7ConfGEDC, e => errors.push(e))
    assert.equal(errors.length, 0, `Syntax errors after round-trip: ${errors.join('; ')}`)
  })

  it('HEAD.GEDC.VERS is preserved as 7.0', () => {
    const ds   = G7Dataset.fromString(minimalText, makeLookup())
    const text = ds.toString()
    assert.ok(text.includes('VERS 7.0'), 'VERS 7.0 must appear in serialised output')
  })
})

// ---------------------------------------------------------------------------
// Layer 2 JSON round-trip
// ---------------------------------------------------------------------------

describe('G7Dataset JSON round-trip', () => {
  it('toJSON → fromJSON → toString is stable', () => {
    const original  = G7Dataset.fromString(minimalText, makeLookup())
    const json      = original.toJSON()
    const restored  = G7Dataset.fromJSON(json, makeLookup())
    assert.equal(restored.toString(), original.toString())
  })

  it('toJSON produces a plain serialisable object', () => {
    const ds   = G7Dataset.fromString(minimalText, makeLookup())
    const json = ds.toJSON()
    assert.doesNotThrow(() => JSON.stringify(json))
  })
})

// ---------------------------------------------------------------------------
// Data preservation through round-trip
// ---------------------------------------------------------------------------

describe('Data preservation', () => {
  it('individual names survive a full round-trip', () => {
    const T    = 'https://gedcom.io/terms/v7/'
    const ds   = G7Dataset.fromString(minimalText, makeLookup())
    const names = (ds.records.get(T + 'record-INDI') ?? [])
      .map(p => p.sub.get(T + 'NAME')?.[0]?.payload)
      .filter(Boolean)
      .sort()

    const restored = G7Dataset.fromString(ds.toString(), makeLookup())
    const names2 = (restored.records.get(T + 'record-INDI') ?? [])
      .map(p => p.sub.get(T + 'NAME')?.[0]?.payload)
      .filter(Boolean)
      .sort()

    assert.deepEqual(names, names2)
  })

  it('pointer relationships survive a full round-trip', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '1 NAME Submitter',
      '0 TRLR',
    ].join('\n') + '\n'

    const ds  = G7Dataset.fromString(text, makeLookup())
    const out = ds.toString()
    assert.ok(out.includes('SUBM @'), 'pointer to SUBM must appear in output')
  })
})
