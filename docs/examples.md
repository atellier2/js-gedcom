# Practical Examples

## 1. Read a GEDCOM file and extract data

### Simple extraction with the tag-oriented layer

For quickly scanning a GEDCOM file without type validation, `GEDCStruct` alone is sufficient.

```js
import { GEDCStruct, g7ConfGEDC } from './gedcstruct.js'

const gedc = GEDCStruct.fromString(gedcomText, g7ConfGEDC, console.error)

// Read the GEDCOM version
const version = gedc.querySelector('HEAD.GEDC.VERS')?.payload
console.log('Version:', version)  // "7.0"

// List all individuals
for (const indi of gedc.querySelectorAll('.INDI')) {
  const name  = indi.querySelector('NAME')?.payload
  const birth = indi.querySelector('BIRT.DATE')?.payload
  console.log(name, '— born:', birth)
}
```

### Extraction with the type-aware layer (GEDCOM 7)

To access typed payloads and benefit from validation:

```js
import { GEDCStruct, g7ConfGEDC } from './gedcstruct.js'
import { G7Lookups } from './g7lookups.js'
import { G7Dataset } from './g7structure.js'

const spec   = await fetch('https://raw.githubusercontent.com/FamilySearch/GEDCOM-registries/main/generated_files/g7validation.json').then(r => r.json())
const lookup = new G7Lookups(spec)
lookup.err  = msg => console.error(msg)
lookup.warn = msg => console.warn(msg)

const gedc    = GEDCStruct.fromString(gedcomText, g7ConfGEDC)
const dataset = G7Dataset.fromGEDC(gedc, lookup)

const INDI = 'https://gedcom.io/terms/v7/record-INDI'
const NAME = 'https://gedcom.io/terms/v7/NAME'
const BIRT = 'https://gedcom.io/terms/v7/BIRT'
const DATE = 'https://gedcom.io/terms/v7/DATE'

for (const person of dataset.records.get(INDI) ?? []) {
  const name = person.sub.get(NAME)?.[0]?.payload         // string
  const date = person.sub.get(BIRT)?.[0]?.sub.get(DATE)?.[0]?.payload  // G7DateValue
  console.log(name, date?.toString())
}
```

---

## 2. Validate a GEDCOM 7 file

```js
import { GEDCStruct, g7ConfGEDC } from './gedcstruct.js'
import { G7Lookups } from './g7lookups.js'
import { G7Dataset } from './g7structure.js'

const errors   = []
const warnings = []

const spec   = await fetch('...g7validation.json').then(r => r.json())
const lookup = new G7Lookups(spec)
lookup.err  = msg => errors.push(msg)
lookup.warn = msg => warnings.push(msg)

const gedc    = GEDCStruct.fromString(gedcomText, g7ConfGEDC)
const dataset = G7Dataset.fromGEDC(gedc, lookup)
dataset.validate()

console.log(`${errors.length} error(s), ${warnings.length} warning(s)`)
errors.forEach(e   => console.error('ERROR:', e))
warnings.forEach(w => console.warn('WARN: ', w))
```

---

## 3. Build a GEDCOM 7 dataset from scratch

```js
import { G7Lookups } from './g7lookups.js'
import { G7Dataset } from './g7structure.js'

const T = 'https://gedcom.io/terms/v7/'  // URI prefix shorthand

const spec    = await fetch('...g7validation.json').then(r => r.json())
const lookup  = new G7Lookups(spec)
const dataset = new G7Dataset(lookup)

// Create an individual
const person = dataset.createRecord(T + 'record-INDI')

// Add a name
person.createSubstructure(T + 'NAME', 'Marie /Dupont/')

// Add a birth event
const birth = person.createSubstructure(T + 'BIRT', 'Y')
birth.createSubstructure(T + 'DATE', '15 MAR 1985')
birth.createSubstructure(T + 'PLAC', 'Paris, France')

// Add a note
person.createSubstructure(T + 'NOTE', 'Maternal ancestor.')

// Serialize
dataset.populateSchema()  // required if any extensions are used
const output = dataset.toString()
console.log(output)
```

---

## 4. Find or create structures (incremental import)

The `findOrCreate` pattern is designed for iterative imports: the same operation can be called multiple times without creating duplicates.

```js
const T = 'https://gedcom.io/terms/v7/'

// Create or retrieve an individual identified by their REFN value
const person = dataset.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'PERSON-001')

// Create or retrieve their birth event identified by a UUID
const birth = person.findOrCreate(T + 'BIRT', -1, T + 'UID', 'a3f4-...')
birth.payload = 'Y'

// Create or retrieve a submitter identified by name
const submitter = dataset.findOrCreate(T + 'record-SUBM', -1, T + 'NAME', 'Alice Martin')

// Link the submitter to the individual (idempotent)
person.findOrCreate(T + 'SUBM', submitter)
```

---

## 5. Create a family with parent–child links

```js
const T = 'https://gedcom.io/terms/v7/'

const father = dataset.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'FATHER')
father.createSubstructure(T + 'NAME', 'Jean /Dupont/')

const mother = dataset.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'MOTHER')
mother.createSubstructure(T + 'NAME', 'Isabelle /Martin/')

const child = dataset.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'CHILD')
child.createSubstructure(T + 'NAME', 'Marie /Dupont/')

// Create the family record
const family = dataset.createRecord(T + 'record-FAM')
family.createSubstructure(T + 'HUSB', father)  // payload is a pointer
family.createSubstructure(T + 'WIFE', mother)
family.createSubstructure(T + 'CHIL', child)

// Required symmetric back-links
father.createSubstructure(T + 'INDI-FAMS', family)
mother.createSubstructure(T + 'INDI-FAMS', family)
child.createSubstructure(T + 'INDI-FAMC', family)
```

---

## 6. Use an extension

Extensions are structures defined outside the standard specification. They must start with `_` or be registered in `HEAD.SCHMA`.

```js
const person = dataset.createRecord('https://gedcom.io/terms/v7/record-INDI')

// Documented extension (URI registered in HEAD.SCHMA)
person.createSubstructure('https://example.com/myapp/EXT-FIELD', 'value')

// populateSchema() automatically adds the reference to HEAD.SCHMA
dataset.populateSchema()
const output = dataset.toString()
```

---

## 7. Round-trip: read, modify, rewrite

```js
import { GEDCStruct, g7ConfGEDC } from './gedcstruct.js'
import { G7Lookups } from './g7lookups.js'
import { G7Dataset } from './g7structure.js'

const spec    = await fetch('...g7validation.json').then(r => r.json())
const lookup  = new G7Lookups(spec)
const gedc    = GEDCStruct.fromString(originalText, g7ConfGEDC)
const dataset = G7Dataset.fromGEDC(gedc, lookup)

const T = 'https://gedcom.io/terms/v7/'

// Modify: add a note to every individual that does not already have one
for (const person of dataset.records.get(T + 'record-INDI') ?? []) {
  if (!person.sub.has(T + 'NOTE')) {
    person.createSubstructure(T + 'NOTE', 'Imported automatically.')
  }
}

// Validate before rewriting
dataset.validate()
dataset.populateSchema()

const modifiedText = dataset.toString()
```

---

## 8. Serialize to JSON and restore

The JSON format is useful for storing or transferring a dataset without going through GEDCOM text.

```js
// Serialize
const json       = dataset.toJSON()
const jsonString = JSON.stringify(json)

// Restore
const restored = G7Dataset.fromJSON(JSON.parse(jsonString), lookup)
const text     = restored.toString()
```

---

## 9. Use only the tag-oriented layer (GEDCOM 5.x or non-standard)

For GEDCOM 5.x files or non-standard dialects, use `gedcstruct.js` alone with `g5ConfGEDC`:

```js
import { GEDCStruct, g5ConfGEDC } from './gedcstruct.js'

const gedc = GEDCStruct.fromString(gedcom5Text, g5ConfGEDC, console.error)

// Read fields without semantic validation
const source = gedc.querySelector('.SOUR')
const title  = source?.querySelector('TITL')?.payload

// Rewrite (preserves 5.x dialect: 255-char limit, CONC if needed)
const output = gedc.map(s => s.toString('\r\n', 255, true)).join('')
```

---

## 10. Separate syntax errors from validation errors

There are two distinct levels of errors:

1. **Syntax errors**: detected by `GEDCStruct.fromString()` via the `logger` callback
2. **Validation errors**: detected by `G7Dataset.fromGEDC()` and `validate()` via `lookup.err` / `lookup.warn`

```js
const syntaxErrors  = []
const typeErrors    = []
const typeWarnings  = []

const gedc = GEDCStruct.fromString(text, g7ConfGEDC, msg => syntaxErrors.push(msg))

const lookup = new G7Lookups(spec)
lookup.err  = msg => typeErrors.push(msg)
lookup.warn = msg => typeWarnings.push(msg)

const dataset = G7Dataset.fromGEDC(gedc, lookup)
dataset.validate()

console.log('Syntax:    ', syntaxErrors)
console.log('Type:      ', typeErrors)
console.log('Suggestions:', typeWarnings)
```
