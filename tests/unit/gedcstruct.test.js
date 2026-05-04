import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { GEDCStruct, g5ConfGEDC, g7ConfGEDC } from '../../src/gedcstruct.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse(text, config = g7ConfGEDC, logger) {
  const errors = []
  const result = GEDCStruct.fromString(text, config, logger ?? (e => errors.push(e)))
  return { result, errors }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

describe('GEDCStruct.fromString — basic structure', () => {
  it('parses a minimal file into level-0 nodes', () => {
    const { result } = parse('0 HEAD\n0 TRLR')
    assert.equal(result.length, 2)
    assert.equal(result[0].tag, 'HEAD')
    assert.equal(result[1].tag, 'TRLR')
  })

  it('builds parent-child relationships from levels', () => {
    const { result } = parse('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR')
    const [head] = result
    assert.equal(head.sub.length, 1)
    assert.equal(head.sub[0].tag, 'GEDC')
    assert.equal(head.sub[0].sub[0].tag, 'VERS')
    assert.equal(head.sub[0].sub[0].payload, '7.0')
  })

  it('sets superstruct on child nodes', () => {
    const { result } = parse('0 HEAD\n1 GEDC\n0 TRLR')
    assert.equal(result[0].sub[0].superstruct, result[0])
  })

  it('returns a falsy superstruct on root nodes', () => {
    const { result } = parse('0 HEAD\n0 TRLR')
    assert.ok(!result[0].superstruct)
  })

  it('strips a leading BOM character', () => {
    const { result } = parse('﻿0 HEAD\n0 TRLR')
    assert.equal(result[0].tag, 'HEAD')
  })

  it('parses a structure with no payload', () => {
    const { result } = parse('0 HEAD\n1 BIRT\n0 TRLR')
    assert.equal(result[0].sub[0].payload, undefined)
  })
})

// ---------------------------------------------------------------------------
// CONT / CONC handling
// ---------------------------------------------------------------------------

describe('GEDCStruct.fromString — CONT / CONC', () => {
  it('merges CONT into payload with a newline', () => {
    const { result } = parse('0 HEAD\n1 NOTE first\n2 CONT second\n0 TRLR')
    assert.equal(result[0].sub[0].payload, 'first\nsecond')
  })

  it('merges multiple CONT lines', () => {
    const { result } = parse('0 HEAD\n1 NOTE a\n2 CONT b\n2 CONT c\n0 TRLR')
    assert.equal(result[0].sub[0].payload, 'a\nb\nc')
  })

  it('handles CONT with empty continuation (blank line)', () => {
    const { result } = parse('0 HEAD\n1 NOTE text\n2 CONT\n0 TRLR')
    assert.equal(result[0].sub[0].payload, 'text\n')
  })

  it('concatenates CONC without separator (g5 only)', () => {
    const { result } = parse('0 HEAD\n1 NOTE hello\n2 CONC world\n0 TRLR', g5ConfGEDC)
    assert.equal(result[0].sub[0].payload, 'helloworld')
  })

  it('rejects CONC under g7ConfGEDC and logs an error', () => {
    const { errors } = parse('0 HEAD\n1 NOTE hello\n2 CONC world\n0 TRLR')
    assert.ok(errors.length > 0, 'expected an error for CONC in GEDCOM 7')
  })
})

// ---------------------------------------------------------------------------
// Pointer resolution
// ---------------------------------------------------------------------------

describe('GEDCStruct.fromString — cross-reference pointers', () => {
  it('resolves a pointer payload to the target GEDCStruct', () => {
    const { result, errors } = parse('0 @I1@ INDI\n0 HEAD\n1 SUBM @I1@\n0 TRLR')
    assert.equal(errors.length, 0)
    const head = result.find(s => s.tag === 'HEAD')
    const indi = result.find(s => s.tag === 'INDI')
    assert.equal(head.sub[0].payload, indi)
  })

  it('records the target in its references list', () => {
    const { result } = parse('0 @I1@ INDI\n0 HEAD\n1 SUBM @I1@\n0 TRLR')
    const indi = result.find(s => s.tag === 'INDI')
    assert.equal(indi.references.length, 1)
  })

  it('sets payload to null and logs an error for an undefined xref', () => {
    const { result, errors } = parse('0 HEAD\n1 SUBM @MISSING@\n0 TRLR')
    assert.ok(errors.length > 0)
    assert.equal(result[0].sub[0].payload, null)
  })

  it('handles @VOID@ as a null payload without an error', () => {
    const { result, errors } = parse('0 HEAD\n1 SUBM @VOID@\n0 TRLR')
    assert.equal(errors.length, 0)
    assert.equal(result[0].sub[0].payload, null)
  })

  it('preserves the recommended xref_id on a referenced structure', () => {
    const { result } = parse('0 @I1@ INDI\n0 HEAD\n1 SUBM @I1@\n0 TRLR')
    const indi = result.find(s => s.tag === 'INDI')
    assert.equal(indi.xref_id, 'I1')
  })
})

// ---------------------------------------------------------------------------
// Payload escaping
// ---------------------------------------------------------------------------

describe('GEDCStruct.fromString — payload escaping', () => {
  it('unescapes @@ at the start of a payload to @', () => {
    const { result } = parse('0 HEAD\n1 NOTE @@#escaped\n0 TRLR')
    assert.equal(result[0].sub[0].payload, '@#escaped')
  })

  it('leaves @# (without doubling) as @# when escapes config is true', () => {
    const { result } = parse('0 HEAD\n1 NOTE @#DATE\n0 TRLR', g5ConfGEDC)
    assert.equal(result[0].sub[0].payload, '@#DATE')
  })
})

// ---------------------------------------------------------------------------
// Dialect validation
// ---------------------------------------------------------------------------

describe('GEDCStruct.fromString — dialect constraints', () => {
  it('rejects a tag not matching the g7 tag regex', () => {
    const { errors } = parse('0 HEAD\n1 lowercase\n0 TRLR')
    assert.ok(errors.length > 0)
  })

  it('rejects leading zeros on level numbers when zeros=false', () => {
    const { errors } = parse('00 HEAD\n0 TRLR')
    assert.ok(errors.length > 0)
  })

  it('accepts leading zeros when zeros=true', () => {
    const { errors } = parse('00 HEAD\n0 TRLR', { ...g7ConfGEDC, zeros: true })
    assert.equal(errors.length, 0)
  })

  it('reports error for a line exceeding the g5 255-char limit', () => {
    const long = 'A'.repeat(300)
    const { errors } = parse(`0 HEAD\n1 NOTE ${long}\n0 TRLR`, g5ConfGEDC)
    assert.ok(errors.length > 0)
  })
})

// ---------------------------------------------------------------------------
// querySelector / querySelectorAll
// ---------------------------------------------------------------------------

describe('GEDCStruct querySelector / querySelectorAll', () => {
  let gedc

  before(() => {
    ;({ result: gedc } = parse(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n1 NOTE note\n0 @I1@ INDI\n1 NAME Alice\n0 @I2@ INDI\n1 NAME Bob\n0 TRLR'
    ))
  })

  it('finds a node via a dotted path', () => {
    const vers = gedc.querySelector('HEAD.GEDC.VERS')
    assert.ok(vers)
    assert.equal(vers.payload, '7.0')
  })

  it('finds a root-level node with a leading dot', () => {
    const indi = gedc.querySelector('.INDI')
    assert.ok(indi)
    assert.equal(indi.tag, 'INDI')
  })

  it('returns undefined when no node matches', () => {
    assert.equal(gedc.querySelector('.MISSING'), undefined)
  })

  it('finds a descendant with double-dot notation', () => {
    const vers = gedc.querySelector('HEAD..VERS')
    assert.ok(vers)
    assert.equal(vers.tag, 'VERS')
  })

  it('yields all matching root nodes with querySelectorAll', () => {
    const all = [...gedc.querySelectorAll('.INDI')]
    assert.equal(all.length, 2)
  })

  it('yields all nested matches regardless of position', () => {
    const names = [...gedc.querySelectorAll('INDI.NAME')]
    assert.equal(names.length, 2)
  })

  it('querySelector returns the first match only', () => {
    const indi = gedc.querySelector('.INDI')
    assert.equal(indi.sub[0].payload, 'Alice')
  })
})

// ---------------------------------------------------------------------------
// toString (serialization)
// ---------------------------------------------------------------------------

describe('GEDCStruct.toString', () => {
  it('round-trips a simple structure', () => {
    const text = '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n'
    const { result } = parse(text)
    assert.equal(result.toString(), text)
  })

  it('serializes a pointer payload as @id@', () => {
    const text = '0 @I1@ INDI\n0 HEAD\n1 SUBM @I1@\n0 TRLR\n'
    const { result } = parse(text)
    assert.ok(result.toString().includes('@I1@'))
  })

  it('serializes a null pointer as @VOID@', () => {
    const text = '0 HEAD\n1 SUBM @VOID@\n0 TRLR\n'
    const { result } = parse(text)
    assert.ok(result.toString().includes('@VOID@'))
  })

  it('emits CONT lines for multiline payloads', () => {
    const text = '0 HEAD\n1 NOTE line1\n2 CONT line2\n0 TRLR\n'
    const { result } = parse(text)
    assert.ok(result.toString().includes('2 CONT line2'))
  })

  it('wraps long lines with CONC when maxlen is set', () => {
    const long = 'A'.repeat(300)
    const { result } = parse(`0 HEAD\n1 NOTE ${long}\n0 TRLR\n`, g5ConfGEDC)
    const output = result[0].sub[0].toString('\n', 80)
    assert.ok(output.includes('CONC'), 'CONC expected for long payload')
  })

  it('escapes a payload starting with @ as @@', () => {
    const { result } = parse('0 HEAD\n1 NOTE @@#value\n0 TRLR\n')
    const out = result.toString()
    assert.ok(out.includes('@@#value'), 'payload should be double-escaped')
  })
})

// ---------------------------------------------------------------------------
// JSON round-trip
// ---------------------------------------------------------------------------

describe('GEDCStruct toJSON / fromJSON', () => {
  it('restores the same structure', () => {
    const text = '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n'
    const { result: original } = parse(text)
    const json = original.map(s => s.toJSON())
    const restored = GEDCStruct.fromJSON(json)
    assert.equal(restored.toString(), original.toString())
  })

  it('preserves pointer relationships after round-trip', () => {
    const text = '0 @I1@ INDI\n0 HEAD\n1 SUBM @I1@\n0 TRLR\n'
    const { result: original } = parse(text)
    const json = original.map(s => s.toJSON())
    const restored = GEDCStruct.fromJSON(json)
    const head = restored.find(s => s.tag === 'HEAD')
    const indi = restored.find(s => s.tag === 'INDI')
    assert.equal(head.sub[0].payload, indi)
  })

  it('adds querySelector/querySelectorAll to the restored array', () => {
    const { result } = parse('0 HEAD\n0 TRLR\n')
    const restored = GEDCStruct.fromJSON(result.map(s => s.toJSON()))
    assert.equal(typeof restored.querySelector, 'function')
  })
})
