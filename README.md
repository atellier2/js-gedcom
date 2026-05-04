# js-gedcom

A dependency-free JavaScript library for parsing, validating, and creating [GEDCOM](https://gedcom.io/) genealogy files. Supports both GEDCOM 5.x and [FamilySearch GEDCOM 7](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html).

> **Online validator**: To validate a GEDCOM 7 file directly in your browser, visit <https://gedcom7code.github.io/js-gedcom/>.

---

## What is GEDCOM?

GEDCOM (Genealogical Data Communication) is the standard format for exchanging family tree data between genealogy applications. A GEDCOM file is a plain-text tree of structures. Each line contains a **level**, a **tag**, and an optional **payload**:

```
0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME John /Doe/
1 BIRT
2 DATE 1 JAN 1900
```

Structures nest by level: a level-`2` line is a child of the last level-`1` line.

---

## Architecture

The library is organized into **three layers**, each building on the previous:

| Layer | Module | Role |
|-------|--------|------|
| Tag-oriented | `gedcstruct.js` | Parse/serialize raw GEDCOM syntax |
| Type-aware | `g7structure.js` | Validate and work with GEDCOM 7 semantics |
| Specification | `g7lookups.js` | FamilySearch GEDCOM 7 registry |

The tag-oriented layer alone is sufficient to read and manipulate GEDCOM files without strict validation. The type-aware layer requires the FamilySearch specification and enforces cardinality rules, payload types, and extension handling.

→ See [docs/architecture.md](docs/architecture.md) for a detailed explanation.

---

## Quick Start

### Read a GEDCOM file (tag-oriented layer)

```js
import { GEDCStruct, g7ConfGEDC } from './src/gedcstruct.js'

const gedc = GEDCStruct.fromString(gedcomText, g7ConfGEDC, console.error)
// gedc is an array of level-0 GEDCStruct nodes

const version    = gedc.querySelector('HEAD.GEDC.VERS')?.payload  // "7.0"
const individuals = [...gedc.querySelectorAll('.INDI')]            // all INDI records
```

### Read and validate a GEDCOM 7 file

```js
import { GEDCStruct, g7ConfGEDC } from './src/gedcstruct.js'
import { G7Lookups } from './src/g7lookups.js'
import { G7Dataset } from './src/g7structure.js'

// 1. Load the GEDCOM 7 specification
const spec = await fetch('https://raw.githubusercontent.com/FamilySearch/GEDCOM-registries/main/generated_files/g7validation.json')
  .then(r => r.json())
const lookup = new G7Lookups(spec)
lookup.err  = msg => console.error('Error:', msg)
lookup.warn = msg => console.warn('Warning:', msg)

// 2. Parse
const gedc    = GEDCStruct.fromString(gedcomText, g7ConfGEDC)
const dataset = G7Dataset.fromGEDC(gedc, lookup)

// 3. Validate
dataset.validate()
```

### Build a dataset programmatically

```js
const dataset = new G7Dataset(lookup)

// Create an individual
const person = dataset.createRecord('https://gedcom.io/terms/v7/record-INDI')

// Add a birth event
person.createSubstructure('https://gedcom.io/terms/v7/BIRT', 'Y')
  .createSubstructure('https://gedcom.io/terms/v7/DATE', '1 JAN 1900')

// Serialize to GEDCOM text
const output = dataset.toString()
```

### Find or create (idempotent writes)

```js
// Find an individual by REFN value, or create it if not found
const person = dataset.findOrCreate(
  'https://gedcom.io/terms/v7/record-INDI', -1,
  'https://gedcom.io/terms/v7/REFN', 'ID-42'
)

// Calling again with the same arguments returns the same object
const same = dataset.findOrCreate(
  'https://gedcom.io/terms/v7/record-INDI', -1,
  'https://gedcom.io/terms/v7/REFN', 'ID-42'
)
// person === same  →  true
```

---

## Modules

### `src/gedcstruct.js` — Tag-oriented layer

Turns GEDCOM text into a tree of `GEDCStruct` nodes. Handles `CONT`/`CONC` pseudo-structures, cross-reference pointers, and 5.x or 7.x dialects.

Exports: `GEDCStruct`, `g5ConfGEDC`, `g7ConfGEDC`

### `src/g7lookups.js` — GEDCOM 7 specification

Wraps the [FamilySearch GEDCOM Registries](https://github.com/FamilySearch/GEDCOM-registries) JSON to provide tag definitions, payload types, enumeration sets, and extension handling.

Exports: `G7Lookups`

### `src/g7structure.js` — Type-aware layer

Converts tag-oriented nodes into type-validated `G7Structure` objects. Understands GEDCOM 7 semantics, cardinality rules, payload types, and extension handling.

Exports: `G7Structure`, `G7Dataset`

### `src/g7datatypes.js` — Payload data types

Implements typed payload values: `G7Date`, `G7DateValue`, `G7Age`, `G7Time`, `G7Enum`.

---

## Documentation

- [Architecture and data flow](docs/architecture.md)
- [API reference](docs/api.md)
- [Practical examples](docs/examples.md)

---

## Testing

Requires Node.js 20+. The integration tests depend on the FamilySearch GEDCOM 7 specification, which is downloaded once and cached locally.

```bash
# First-time setup: download the spec fixture
npm run test:setup

# Run all tests
npm test

# Run only unit tests (no network required)
npm run test:unit

# Run only integration tests
npm run test:integration
```

| Suite | Location | Requires spec |
|-------|----------|:-------------:|
| Unit — `GEDCStruct` | `tests/unit/gedcstruct.test.js` | No |
| Unit — datatypes | `tests/unit/g7datatypes.test.js` | No |
| Integration — `G7Dataset` | `tests/integration/g7dataset.test.js` | Yes |
| Integration — round-trip | `tests/integration/round-trip.test.js` | Yes |

---

## Character Encoding

This library operates on JavaScript strings. It does not handle byte-level encoding conversion (UTF-8, ANSEL, etc.) — you must decode the file into a JavaScript string before passing it to the library.

---

## License

Released under both the [MIT License](LICENSE-MIT) and the [Unlicense](LICENSE-UNLICENSE). Both apply simultaneously; use whichever suits you.

---

## Contributing

Bug reports and pull requests are welcome via [GitHub Issues](https://github.com/gedcom7code/js-gedcom/issues).

---

## Development Status

<details>
<summary>Feature checklist</summary>

- [x] Tag-oriented layer
    - [x] Parser with CONT/CONC handling and multiple dialects
    - [x] Manual structure creation
    - [x] JSON serializer/deserializer
    - [x] `querySelector` and `querySelectorAll`
- [x] Type-aware layer
    - [x] Load GEDCOM 7 specification from GEDCOM-registries
    - [x] Context-aware structure type resolution
    - [x] Payload type validation and cardinality rules
    - [x] Extension handling (undocumented, unregistered, aliased, relocated)
    - [x] Deprecation warnings
    - [x] Manual structure creation with error checking (`.validate()`)
    - [ ] Automatic partial checking on creation
    - [x] Serialize to tag-oriented layer with schema deduction
    - [x] JSON serializer/deserializer
    - [x] `find` and `findOrCreate`

</details>
