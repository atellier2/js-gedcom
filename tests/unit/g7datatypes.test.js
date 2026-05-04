import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  G7Age, G7Date, G7DateValue, G7Time, G7Enum,
  G7Datatype, checkDatatype,
} from '../../src/g7datatypes.js'

// ---------------------------------------------------------------------------
// Minimal mock for G7Lookups
// The datatypes only need: err, warn, calendar, month, enumval, tag
// ---------------------------------------------------------------------------

const GREG_URI = 'https://gedcom.io/terms/v7/cal-GREGORIAN'

function makeLookup() {
  const errors = [], warnings = []
  return {
    errors,
    warnings,
    err:     msg => errors.push(msg),
    warn:    msg => warnings.push(msg),
    calendar: tag => ({ type: GREG_URI }),
    month:   (_cal, tag) => `${GREG_URI}/month/${tag}`,
    enumval: (_set, tag) => tag,
    tag:     uri => {
      if (uri === GREG_URI) return 'GREGORIAN'
      return uri.split('/').pop()
    },
  }
}

// ---------------------------------------------------------------------------
// G7Age
// ---------------------------------------------------------------------------

describe('G7Age', () => {
  it('parses years only', () => {
    const age = new G7Age('35y', makeLookup())
    assert.equal(age.years, 35)
    assert.equal(age.mod, undefined)
    assert.equal(age.months, undefined)
  })

  it('parses all components with greater-than modifier', () => {
    // No space between modifier and first component per the parsing regex
    const age = new G7Age('>5y 3m 2w 1d', makeLookup())
    assert.equal(age.mod, '>')
    assert.equal(age.years, 5)
    assert.equal(age.months, 3)
    assert.equal(age.weeks, 2)
    assert.equal(age.days, 1)
  })

  it('parses less-than modifier', () => {
    const age = new G7Age('<1y', makeLookup())
    assert.equal(age.mod, '<')
  })

  it('parses days only', () => {
    const age = new G7Age('10d', makeLookup())
    assert.equal(age.days, 10)
    assert.equal(age.years, undefined)
  })

  it('isEmpty returns true when no time component is set', () => {
    assert.ok(new G7Age('', makeLookup()).isEmpty())
  })

  it('isEmpty returns false when at least one component is set', () => {
    assert.equal(new G7Age('1y', makeLookup()).isEmpty(), false)
  })

  it('reports an error for an unrecognised format', () => {
    const lk = makeLookup()
    new G7Age('not-an-age', lk)
    assert.ok(lk.errors.length > 0)
  })

  it('round-trips a full age string through toString', () => {
    const src = '>5y 3m 2w 1d'
    assert.equal(new G7Age(src, makeLookup()).toString(), src)
  })

  it('toString omits undefined components', () => {
    assert.equal(new G7Age('10y', makeLookup()).toString(), '10y')
  })

  it('toString places modifier directly before the first component', () => {
    assert.equal(new G7Age('>1y', makeLookup()).toString(), '>1y')
  })
})

// ---------------------------------------------------------------------------
// G7Date
// ---------------------------------------------------------------------------

describe('G7Date', () => {
  it('parses a full day-month-year date', () => {
    const d = new G7Date('1 JAN 2024', makeLookup())
    assert.equal(d.day, 1)
    assert.equal(d.year, 2024)
    assert.ok(d.month)
    assert.equal(d.calendar, GREG_URI)
  })

  it('parses year only', () => {
    const d = new G7Date('2024', makeLookup())
    assert.equal(d.year, 2024)
    assert.equal(d.day, undefined)
    assert.equal(d.month, undefined)
  })

  it('parses month and year without day', () => {
    const d = new G7Date('JAN 2024', makeLookup())
    assert.equal(d.year, 2024)
    assert.ok(d.month)
    assert.equal(d.day, undefined)
  })

  it('reports an error for an invalid date string', () => {
    const lk = makeLookup()
    new G7Date('not a date', lk)
    assert.ok(lk.errors.length > 0)
  })

  it('sets calendar to _ERROR on invalid input', () => {
    const d = new G7Date('bad', makeLookup())
    assert.equal(d.calendar, '_ERROR')
    assert.equal(d.year, 0)
  })

  it('round-trips a full date through toString', () => {
    const src = '1 JAN 2024'
    assert.equal(new G7Date(src, makeLookup()).toString(), src)
  })

  it('omits GREGORIAN prefix unless showGregorian=true', () => {
    const d = new G7Date('1 JAN 2024', makeLookup())
    assert.ok(!d.toString(false).startsWith('GREGORIAN'))
    assert.ok(d.toString(true).startsWith('GREGORIAN'))
  })

  it('constructs from a plain object (fromJSON path)', () => {
    const lk = makeLookup()
    const d = new G7Date({ calendar: GREG_URI, year: 2024, day: 1 }, lk)
    assert.equal(d.year, 2024)
    assert.equal(d.day, 1)
    assert.equal(lk.errors.length, 0)
  })
})

// ---------------------------------------------------------------------------
// G7DateValue
// ---------------------------------------------------------------------------

describe('G7DateValue', () => {
  it('parses an exact date', () => {
    const dv = new G7DateValue('1 JAN 2024', makeLookup())
    assert.equal(dv.type, 'date')
    assert.ok(dv.date)
    assert.equal(dv.date2, undefined)
  })

  it('parses ABT (approximate)', () => {
    const dv = new G7DateValue('ABT 2024', makeLookup())
    assert.equal(dv.type, 'ABT')
    assert.ok(dv.date)
  })

  it('parses CAL (calculated)', () => {
    assert.equal(new G7DateValue('CAL 2024', makeLookup()).type, 'CAL')
  })

  it('parses EST (estimated)', () => {
    assert.equal(new G7DateValue('EST 2024', makeLookup()).type, 'EST')
  })

  it('parses BET...AND range', () => {
    const dv = new G7DateValue('BET 1900 AND 2000', makeLookup())
    assert.equal(dv.type, 'dateRange')
    assert.ok(dv.date)
    assert.ok(dv.date2)
  })

  it('parses AFT date (range with only lower bound)', () => {
    const dv = new G7DateValue('AFT 1900', makeLookup())
    assert.equal(dv.type, 'dateRange')
    assert.ok(dv.date)
    assert.equal(dv.date2, undefined)
  })

  it('parses BEF date (range with only upper bound)', () => {
    const dv = new G7DateValue('BEF 2000', makeLookup())
    assert.equal(dv.type, 'dateRange')
    assert.equal(dv.date, undefined)
    assert.ok(dv.date2)
  })

  it('parses FROM...TO period', () => {
    const dv = new G7DateValue('FROM 1900 TO 2000', makeLookup())
    assert.equal(dv.type, 'DatePeriod')
    assert.ok(dv.date)
    assert.ok(dv.date2)
  })

  it('parses FROM-only period', () => {
    const dv = new G7DateValue('FROM 1900', makeLookup())
    assert.equal(dv.type, 'DatePeriod')
    assert.ok(dv.date)
    assert.equal(dv.date2, undefined)
  })

  it('treats empty string as empty type', () => {
    const dv = new G7DateValue('', makeLookup())
    assert.ok(dv.isEmpty())
  })

  it('isEmpty returns false for non-empty date', () => {
    assert.equal(new G7DateValue('2024', makeLookup()).isEmpty(), false)
  })

  it('round-trips an exact date through toString', () => {
    const src = '1 JAN 2024'
    assert.equal(new G7DateValue(src, makeLookup()).toString(), src)
  })

  it('round-trips an ABT date', () => {
    const src = 'ABT 2024'
    assert.equal(new G7DateValue(src, makeLookup()).toString(), src)
  })

  it('round-trips a BET...AND range', () => {
    const src = 'BET 1900 AND 2000'
    assert.equal(new G7DateValue(src, makeLookup()).toString(), src)
  })
})

// ---------------------------------------------------------------------------
// G7Time
// ---------------------------------------------------------------------------

describe('G7Time', () => {
  it('parses hours and minutes', () => {
    const t = new G7Time('14:30', makeLookup())
    assert.equal(t.hour, 14)
    assert.equal(t.minute, 30)
    assert.equal(t.second, undefined)
    assert.equal(t.tz, undefined)
  })

  it('parses with seconds', () => {
    const t = new G7Time('14:30:45', makeLookup())
    assert.equal(t.second, 45)
  })

  it('parses UTC timezone marker', () => {
    const t = new G7Time('14:30:45Z', makeLookup())
    assert.equal(t.tz, 'Z')
  })

  it('parses fractional seconds', () => {
    const t = new G7Time('14:30:45.5', makeLookup())
    assert.equal(t.second, 45.5)
  })

  it('reports an error for an invalid format', () => {
    const lk = makeLookup()
    new G7Time('not-a-time', lk)
    assert.ok(lk.errors.length > 0)
  })

  it('zero-pads a single-digit hour in toString', () => {
    // Minutes must be exactly 2 digits in the format; hour is optional single digit
    const t = new G7Time('9:05', makeLookup())
    assert.equal(t.toString(), '09:05')
  })

  it('round-trips HH:MM:SSZ', () => {
    const src = '09:05:30Z'
    assert.equal(new G7Time(src, makeLookup()).toString(), src)
  })

  it('round-trips HH:MM:SS without timezone', () => {
    const src = '23:59:59'
    assert.equal(new G7Time(src, makeLookup()).toString(), src)
  })
})

// ---------------------------------------------------------------------------
// G7Datatype.fromString — dispatch
// ---------------------------------------------------------------------------

describe('G7Datatype.fromString', () => {
  it('returns a string for type "?"', () => {
    const result = G7Datatype.fromString({ type: '?' }, 'anything', makeLookup())
    assert.equal(result, 'anything')
  })

  it('returns undefined and reports error for null type with a payload', () => {
    const lk = makeLookup()
    const result = G7Datatype.fromString({ type: null }, 'oops', lk)
    assert.equal(result, undefined)
    assert.ok(lk.errors.length > 0)
  })

  it('returns undefined for null type with no payload', () => {
    const result = G7Datatype.fromString({ type: null }, undefined, makeLookup())
    assert.equal(result, undefined)
  })

  it('returns 0 and reports error for a non-integer nonNegativeInteger payload', () => {
    const lk = makeLookup()
    const plt = { type: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger' }
    const result = G7Datatype.fromString(plt, 'abc', lk)
    assert.equal(result, 0)
    assert.ok(lk.errors.length > 0)
  })

  it('parses a valid nonNegativeInteger', () => {
    const plt = { type: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger' }
    const result = G7Datatype.fromString(plt, '42', makeLookup())
    assert.equal(result, 42)
  })

  it('returns a G7Age for type-Age', () => {
    const plt = { type: 'https://gedcom.io/terms/v7/type-Age' }
    const result = G7Datatype.fromString(plt, '5y', makeLookup())
    assert.ok(result instanceof G7Age)
  })

  it('returns a G7DateValue for type-Date', () => {
    const plt = { type: 'https://gedcom.io/terms/v7/type-Date' }
    const result = G7Datatype.fromString(plt, '1 JAN 2024', makeLookup())
    assert.ok(result instanceof G7DateValue)
  })

  it('returns a G7Time for type-Time', () => {
    const plt = { type: 'https://gedcom.io/terms/v7/type-Time' }
    const result = G7Datatype.fromString(plt, '12:00', makeLookup())
    assert.ok(result instanceof G7Time)
  })
})

// ---------------------------------------------------------------------------
// G7Datatype constructor guard
// ---------------------------------------------------------------------------

describe('G7Datatype constructor', () => {
  it('throws when instantiated directly', () => {
    assert.throws(() => new G7Datatype(), /Use fromString or fromJSON instead/)
  })
})

// ---------------------------------------------------------------------------
// checkDatatype
// ---------------------------------------------------------------------------

describe('checkDatatype', () => {
  it('accepts any value for type "?"', () => {
    assert.ok(checkDatatype('text',      { type: '?' }))
    assert.ok(checkDatatype(42,          { type: '?' }))
    assert.ok(checkDatatype(undefined,   { type: '?' }))
  })

  it('accepts undefined for type null', () => {
    assert.ok(checkDatatype(undefined, { type: null }))
  })

  it('rejects a defined value for type null', () => {
    assert.equal(checkDatatype('something', { type: null }), false)
  })

  it('accepts 0 for nonNegativeInteger', () => {
    const plt = { type: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger' }
    assert.ok(checkDatatype(0, plt))
  })

  it('rejects a negative number for nonNegativeInteger', () => {
    const plt = { type: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger' }
    assert.equal(checkDatatype(-1, plt), false)
  })

  it('rejects a float for nonNegativeInteger', () => {
    const plt = { type: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger' }
    assert.equal(checkDatatype(1.5, plt), false)
  })

  it('accepts a G7Age instance for type-Age', () => {
    const age = new G7Age('5y', makeLookup())
    assert.ok(checkDatatype(age, { type: 'https://gedcom.io/terms/v7/type-Age' }))
  })

  it('rejects a plain string for type-Age', () => {
    assert.equal(checkDatatype('5y', { type: 'https://gedcom.io/terms/v7/type-Age' }), false)
  })

  it('accepts a G7DateValue instance for type-Date', () => {
    const dv = new G7DateValue('2024', makeLookup())
    assert.ok(checkDatatype(dv, { type: 'https://gedcom.io/terms/v7/type-Date' }))
  })

  it('accepts a G7Time instance for type-Time', () => {
    const t = new G7Time('12:00', makeLookup())
    assert.ok(checkDatatype(t, { type: 'https://gedcom.io/terms/v7/type-Time' }))
  })

  it('accepts "Y" for Y|<NULL>', () => {
    assert.ok(checkDatatype('Y', { type: 'Y|<NULL>' }))
  })

  it('accepts empty string for Y|<NULL>', () => {
    assert.ok(checkDatatype('', { type: 'Y|<NULL>' }))
  })

  it('rejects an arbitrary string for Y|<NULL>', () => {
    assert.equal(checkDatatype('N', { type: 'Y|<NULL>' }), false)
  })
})
