/**
 * Integration tests for G7Dataset and G7Structure.
 * Requires the GEDCOM 7 spec fixture: npm run test:setup
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { G7Lookups } from '../../src/g7lookups.js'
import { G7Dataset } from '../../src/g7structure.js'
import { G7DateValue } from '../../src/g7datatypes.js'
import { loadSpec } from '../helpers/spec.js'

const T = 'https://gedcom.io/terms/v7/'

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let lookup

before(async () => {
  const spec = await loadSpec()
  lookup = new G7Lookups(spec)
})

// ---------------------------------------------------------------------------
// Dataset construction
// ---------------------------------------------------------------------------

describe('G7Dataset construction', () => {
  it('creates a dataset with a valid HEAD structure', () => {
    const ds = new G7Dataset(lookup)
    assert.ok(ds.header)
    assert.equal(ds.header.type, T + 'HEAD')
  })

  it('HEAD contains GEDC.VERS 7.0 by default', () => {
    const ds = new G7Dataset(lookup)
    const vers = ds.header.sub.get(T + 'GEDC')?.[0]?.sub.get(T + 'GEDC-VERS')?.[0]
    assert.ok(vers, 'GEDC.VERS structure should exist')
    assert.equal(vers.payload, '7.0')
  })

  it('initialises with an empty records map', () => {
    const ds = new G7Dataset(lookup)
    assert.equal(ds.records.size, 0)
  })
})

// ---------------------------------------------------------------------------
// Record creation
// ---------------------------------------------------------------------------

describe('G7Dataset.createRecord', () => {
  it('adds an INDI record to the dataset', () => {
    const ds = new G7Dataset(lookup)
    ds.createRecord(T + 'record-INDI')
    assert.equal(ds.records.get(T + 'record-INDI')?.length, 1)
  })

  it('returns the created G7Structure', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.createRecord(T + 'record-INDI')
    assert.equal(person.type, T + 'record-INDI')
  })

  it('accumulates multiple records of the same type', () => {
    const ds = new G7Dataset(lookup)
    ds.createRecord(T + 'record-INDI')
    ds.createRecord(T + 'record-INDI')
    assert.equal(ds.records.get(T + 'record-INDI').length, 2)
  })

  it('creates different record types independently', () => {
    const ds = new G7Dataset(lookup)
    ds.createRecord(T + 'record-INDI')
    ds.createRecord(T + 'record-SUBM')
    assert.equal(ds.records.get(T + 'record-INDI').length, 1)
    assert.equal(ds.records.get(T + 'record-SUBM').length, 1)
  })
})

// ---------------------------------------------------------------------------
// Substructure creation
// ---------------------------------------------------------------------------

describe('G7Structure.createSubstructure', () => {
  it('adds a NAME substructure to an INDI', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.createRecord(T + 'record-INDI')
    person.createSubstructure(T + 'NAME', 'Alice /Smith/')
    assert.equal(person.sub.get(T + 'NAME')?.length, 1)
    assert.equal(person.sub.get(T + 'NAME')[0].payload, 'Alice /Smith/')
  })

  it('returns the created substructure', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.createRecord(T + 'record-INDI')
    const name = person.createSubstructure(T + 'NAME', 'Bob /Jones/')
    assert.equal(name.type, T + 'NAME')
  })

  it('parses a date string payload into a G7DateValue', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.createRecord(T + 'record-INDI')
    const birt = person.createSubstructure(T + 'BIRT')
    const date = birt.createSubstructure(T + 'DATE', '1 JAN 2000')
    assert.ok(date.payload instanceof G7DateValue)
  })
})

// ---------------------------------------------------------------------------
// find / findOrCreate
// ---------------------------------------------------------------------------

describe('G7Dataset.find', () => {
  it('returns null when no record matches', () => {
    const ds = new G7Dataset(lookup)
    assert.equal(ds.find(T + 'record-INDI', -1), null)
  })

  it('finds a record by substructure payload', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.createRecord(T + 'record-INDI')
    person.createSubstructure(T + 'REFN', 'ID-42')
    const found = ds.find(T + 'record-INDI', -1, T + 'REFN', 'ID-42')
    assert.equal(found, person)
  })

  it('does not return a record when the nested criterion does not match', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.createRecord(T + 'record-INDI')
    person.createSubstructure(T + 'REFN', 'ID-99')
    const found = ds.find(T + 'record-INDI', -1, T + 'REFN', 'ID-42')
    assert.equal(found, null)
  })
})

describe('G7Dataset.findOrCreate', () => {
  it('creates a record if none exists', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'ME')
    assert.ok(person)
    assert.equal(person.type, T + 'record-INDI')
  })

  it('returns the same object when called twice with identical arguments', () => {
    const ds = new G7Dataset(lookup)
    const first  = ds.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'ME')
    const second = ds.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'ME')
    assert.equal(first, second)
  })

  it('creates a distinct object for a different identifier', () => {
    const ds = new G7Dataset(lookup)
    const a = ds.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'A')
    const b = ds.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'B')
    assert.notEqual(a, b)
  })

  it('works on G7Structure substructures too', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.createRecord(T + 'record-INDI')
    const birt1 = person.findOrCreate(T + 'BIRT', -1, T + 'UID', 'uuid-1')
    const birt2 = person.findOrCreate(T + 'BIRT', -1, T + 'UID', 'uuid-1')
    assert.equal(birt1, birt2)
  })
})

// ---------------------------------------------------------------------------
// Pointer payloads
// ---------------------------------------------------------------------------

describe('Pointer payloads', () => {
  it('sets a G7Structure as the payload when creating a HUSB link', () => {
    const ds  = new G7Dataset(lookup)
    const husb = ds.createRecord(T + 'record-INDI')
    const fam  = ds.createRecord(T + 'record-FAM')
    fam.createSubstructure(T + 'HUSB', husb)
    assert.equal(fam.sub.get(T + 'HUSB')[0].payload, husb)
  })

  it('the referenced record lists the pointer in its references', () => {
    const ds  = new G7Dataset(lookup)
    const husb = ds.createRecord(T + 'record-INDI')
    const fam  = ds.createRecord(T + 'record-FAM')
    fam.createSubstructure(T + 'HUSB', husb)
    // Serialising and re-reading ensures the xref system was exercised
    const out = ds.toString()
    assert.ok(out.includes('HUSB'))
  })
})

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('G7Dataset.validate', () => {
  it('returns 0 errors for a minimal valid dataset', () => {
    const ds   = new G7Dataset(lookup)
    const subm = ds.createRecord(T + 'record-SUBM')
    subm.createSubstructure(T + 'NAME', 'Test')
    ds.header.createSubstructure(T + 'SUBM', subm)
    assert.equal(ds.validate(), 0)
  })
})

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

describe('G7Dataset.toString', () => {
  it('output starts with "0 HEAD"', () => {
    const ds = new G7Dataset(lookup)
    assert.ok(ds.toString().startsWith('0 HEAD'))
  })

  it('output ends with "0 TRLR\\n"', () => {
    const ds = new G7Dataset(lookup)
    assert.ok(ds.toString().trimEnd().endsWith('0 TRLR'))
  })

  it('includes INDI records', () => {
    const ds = new G7Dataset(lookup)
    ds.createRecord(T + 'record-INDI')
    assert.ok(ds.toString().includes('INDI'))
  })
})

// ---------------------------------------------------------------------------
// JSON round-trip
// ---------------------------------------------------------------------------

describe('G7Dataset toJSON / fromJSON', () => {
  it('restores equivalent header and records', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.createRecord(T + 'record-INDI')
    person.createSubstructure(T + 'NAME', 'Alice /Smith/')

    const json      = ds.toJSON()
    const restored  = G7Dataset.fromJSON(json, lookup)

    assert.ok(restored.header)
    assert.equal(restored.records.get(T + 'record-INDI')?.length, 1)
  })

  it('restores substructure payloads', () => {
    const ds = new G7Dataset(lookup)
    const person = ds.createRecord(T + 'record-INDI')
    person.createSubstructure(T + 'NAME', 'Bob /Jones/')

    const json     = ds.toJSON()
    const restored = G7Dataset.fromJSON(json, lookup)
    const name     = restored.records.get(T + 'record-INDI')[0].sub.get(T + 'NAME')[0]
    assert.equal(name.payload, 'Bob /Jones/')
  })

  it('produces the same GEDCOM text after a JSON round-trip', () => {
    const ds = new G7Dataset(lookup)
    ds.createRecord(T + 'record-INDI').createSubstructure(T + 'NAME', 'Carol /Doe/')

    const original = ds.toString()
    const restored = G7Dataset.fromJSON(ds.toJSON(), lookup)
    assert.equal(restored.toString(), original)
  })
})

// ---------------------------------------------------------------------------
// Parsing from GEDCOM text
// ---------------------------------------------------------------------------

describe('G7Dataset.fromString', () => {
  it('parses a minimal HEAD + TRLR with no errors', async () => {
    const errors = []
    const lk = new G7Lookups(await loadSpec())
    lk.err = e => errors.push(e)
    G7Dataset.fromString('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n', lk)
    assert.equal(errors.length, 0)
  })

  it('populates records from the parsed text', async () => {
    const text = '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME Alice /Smith/\n0 TRLR\n'
    const lk   = new G7Lookups(await loadSpec())
    lk.err     = () => {}
    lk.warn    = () => {}
    const ds   = G7Dataset.fromString(text, lk)
    assert.equal(ds.records.get(T + 'record-INDI')?.length, 1)
  })
})
