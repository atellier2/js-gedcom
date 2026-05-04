# API Reference

## Module `gedcstruct.js`

### Class `GEDCStruct`

Represents a node in the GEDCOM syntactic tree (tag-oriented layer).

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `tag` | `string` | The GEDCOM tag of this node |
| `payload` | `string \| GEDCStruct \| null \| undefined` | Node value: text, pointer to another node, `null` if the pointer destination is unknown, or `undefined` if absent |
| `sub` | `GEDCStruct[]` | Child sub-structures |
| `superstruct` | `GEDCStruct \| null` | Parent structure (read-only) |
| `references` | `GEDCStruct[]` | Structures pointing to this node (read-only) |
| `xref_id` | `string \| undefined` | Recommended identifier for serializing pointers to this node (read-only) |

#### Static methods

---

**`GEDCStruct.fromString(input, config?, logger?)`**

Parses a GEDCOM text into an array of `GEDCStruct` (level-0 nodes).

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string` | The complete GEDCOM text |
| `config` | `object` | Dialect configuration. Use `g7ConfGEDC` or `g5ConfGEDC`. Default: permissive generic dialect |
| `logger` | `function(msg)` | Called for each syntax error |

Returns: `GEDCStruct[]`

---

**`GEDCStruct.fromJSON(obj)`**

Reconstructs a `GEDCStruct` array from a JSON object produced by `toJSON()`.

Returns: `GEDCStruct[]`

---

#### Instance methods

**`toString(newline?, maxlen?, escapes?)`**

Serializes this node and its descendants to GEDCOM text.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `newline` | `string` | `'\n'` | Line separator |
| `maxlen` | `number` | `0` | Max characters per line (0 = unlimited, negative = unlimited without CONC) |
| `escapes` | `boolean` | `false` | If `true`, do not escape `@#` as `@@#` |

Returns: `string`

---

**`toJSON()`**

Serializes this node to a JSON object that can be restored with `fromJSON`.

Returns: `object`

---

**`querySelector(path)`**

Returns the **first** node matching the given tag path.

**`querySelectorAll(path)`**

Returns an iterator over **all** nodes matching the given tag path.

Path syntax:

| Path | Meaning |
|------|---------|
| `XYZ` | Any node with tag `XYZ` |
| `.XYZ` | A root (level-0) node with tag `XYZ` |
| `ABC.XYZ` | An `XYZ` that is a direct child of an `ABC` |
| `ABC..XYZ` | An `XYZ` that is any descendant of an `ABC` |

Example:
```js
gedc.querySelector('HEAD.GEDC.VERS')  // GEDCOM version
gedc.querySelectorAll('.INDI')        // all individuals
```

---

### Configuration objects

#### `g7ConfGEDC` — FamilySearch GEDCOM 7

```js
{
  len: -1,        // no line length limit, CONC not allowed
  tag: /^([A-Z]|_[0-9_A-Z])[0-9_A-Z]*$/u,
  xref: /^([A-Z]|_[0-9_A-Z])[0-9_A-Z]*$/u,
  linesep: /^(\r\n?|\n\r?)$/,
  delim: /^ $/,
  payload: /^.+$/,
  zeros: false,
  escapes: false,
}
```

#### `g5ConfGEDC` — GEDCOM 5.x

```js
{
  len: 255,       // max 255 characters per line
  tag: /^[0-9a-z_A-Z]{1,31}$/u,
  xref: /^[0-9a-z_A-Z][^\p{Cc}@]{0,19}$/u,
  linesep: /^[\r\n][\r\n \t]*$/,
  delim: /^ $/,
  zeros: false,
  escapes: true,
}
```

#### Configuration keys

| Key | Role |
|-----|------|
| `len` | Max line length (0 = unlimited, negative = unlimited without CONC) |
| `tag` | Regex for valid tags |
| `xref` | Regex for valid cross-reference identifiers |
| `linesep` | Regex for allowed line separators |
| `delim` | Regex for allowed delimiters |
| `payload` | Regex for allowed string payloads |
| `zeros` | `true` to allow leading zeros on levels (`00`, `01`…) |
| `escapes` | `true` to suppress escaping `@#` as `@@#` during serialization |

---

## Module `g7lookups.js`

### Class `G7Lookups`

Wraps the FamilySearch GEDCOM 7 specification and acts as a dynamic registry for tag type resolution and extension handling.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `err` | `function(msg)` | Callback for specification violations |
| `warn` | `function(msg)` | Callback for discouraged patterns |

Duplicate messages are automatically suppressed: each unique message is reported only once.

#### Constructor

**`new G7Lookups(g7validation)`**

| Parameter | Type | Description |
|-----------|------|-------------|
| `g7validation` | `object` | Content of FamilySearch's `g7validation.json` |

The file can be fetched from:
`https://raw.githubusercontent.com/FamilySearch/GEDCOM-registries/main/generated_files/g7validation.json`

---

## Module `g7structure.js`

### Class `G7Dataset`

Top-level container for a complete GEDCOM 7 dataset.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `header` | `G7Structure` | The `HEAD` structure of the dataset |
| `records` | `Map<string, G7Structure[]>` | Root records indexed by type URI |

#### Static methods

---

**`G7Dataset.fromString(text, lookup)`**

Parses a GEDCOM text directly into a `G7Dataset` (combines `GEDCStruct.fromString` and `fromGEDC`).

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | The complete GEDCOM text |
| `lookup` | `G7Lookups` | The GEDCOM 7 specification |

Returns: `G7Dataset`

---

**`G7Dataset.fromGEDC(gedc, lookup)`**

Converts a `GEDCStruct` array into a typed, validated `G7Dataset`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `gedc` | `GEDCStruct[]` | Result of `GEDCStruct.fromString()` |
| `lookup` | `G7Lookups` | The GEDCOM 7 specification |

Returns: `G7Dataset`

---

**`G7Dataset.fromJSON(obj, lookup)`**

Reconstructs a `G7Dataset` from a JSON object produced by `toJSON()`.

Returns: `G7Dataset`

---

#### Instance methods

**`createRecord(type, payload?, pltype?, id?)`**

Creates a root record and adds it to the dataset.

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `string` | GEDCOM 7 type URI (e.g. `'https://gedcom.io/terms/v7/record-INDI'`) |
| `payload` | variable | Initial payload value |
| `pltype` | `string` | Explicit payload type if not inferrable |
| `id` | `string` | Suggested xref identifier for serialization |

Returns: `G7Structure`

---

**`find(type, payload, ...args)`**

Searches for a record of the given type. Accepts additional criteria as `(typeURI, value)` pairs to match against sub-structures.

```js
// Find the individual with REFN "ID-42"
const person = dataset.find(
  'https://gedcom.io/terms/v7/record-INDI', -1,
  'https://gedcom.io/terms/v7/REFN', 'ID-42'
)
// Returns null if not found
```

The value `-1` as payload means "any value".

Returns: `G7Structure | null`

---

**`findOrCreate(type, payload, ...args)`**

Like `find`, but creates the record if it does not exist. Multiple calls with the same arguments always return the same object.

Returns: `G7Structure`

---

**`validate()`**

Recursively traverses the entire dataset and checks GEDCOM 7 rules (cardinality, payload types, required fields). Errors and warnings are reported via the `G7Lookups` callbacks.

Returns: `number` — the number of errors found.

---

**`populateSchema()`**

Inspects the extensions used in the dataset and automatically adds the required `HEAD.SCHMA.TAG` entries. Call this before `toString()` if any extensions are present.

---

**`toString()`**

Serializes the dataset to GEDCOM 7 text.

Returns: `string`

---

**`toJSON()`**

Serializes the dataset to a JSON object that can be restored with `fromJSON`.

Returns: `object`

---

**`toGEDC()`**

Converts the dataset to a `GEDCStruct` array (layer 1), enabling fine-grained serialization via `GEDCStruct.toString()`.

Returns: `GEDCStruct[]`

---

### Class `G7Structure`

Represents a typed node in the GEDCOM 7 tree.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | GEDCOM 7 URI or undocumented extension tag |
| `payload` | variable | Typed value depending on the structure type |
| `sub` | `Map<string, G7Structure[]>` | Sub-structures indexed by type URI |
| `superstruct` | `G7Structure \| null` | Parent structure (read-only) |
| `references` | object | Structures pointing to this one (read-only) |
| `xref_id` | `string \| undefined` | Suggested xref identifier (read-only) |

#### Instance methods

**`createSubstructure(type, payload?, pltype?)`**

Creates a sub-structure and attaches it to this node.

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `string` | GEDCOM 7 type URI |
| `payload` | variable | Initial payload value |
| `pltype` | `string` | Explicit payload type if not inferrable |

Returns: `G7Structure` (the new sub-structure)

---

**`find(type, payload, ...args)`**

Like `G7Dataset.find`, but searches within this node's sub-structures.

Returns: `G7Structure | null`

---

**`findOrCreate(type, payload, ...args)`**

Like `G7Dataset.findOrCreate`, but operates on this node's sub-structures.

Returns: `G7Structure`

---

**`validate()`**

Runs recursive validation from this node downward.

Returns: `number` — error count.

---

**`toString()`**, **`toJSON()`**, **`toGEDC()`**

Same as the `G7Dataset` methods, but scoped to this node and its descendants.

---

## Module `g7datatypes.js`

These classes represent the structured payload types of GEDCOM 7. They are returned automatically by the type-aware layer; you generally do not construct them manually.

### `G7Age`

Represents a GEDCOM 7 age value (e.g. `> 35y 6m`).

| Property | Type | Description |
|----------|------|-------------|
| `operator` | `string \| undefined` | `'<'` or `'>'` |
| `years` | `number \| undefined` | Number of years |
| `months` | `number \| undefined` | Number of months |
| `weeks` | `number \| undefined` | Number of weeks |
| `days` | `number \| undefined` | Number of days |

### `G7Date`

Represents a precise calendar date (e.g. `1 JAN 1900`).

| Property | Type | Description |
|----------|------|-------------|
| `calendar` | `string` | Calendar URI (Gregorian by default) |
| `month` | `string \| undefined` | Month code (`JAN`, `FEB`…) |
| `day` | `number \| undefined` | Day of month |
| `year` | `number` | Year |
| `epoch` | `string \| undefined` | Epoch (`BCE`…) |

### `G7DateValue`

Represents a flexible date: precise date, approximation, range, or period.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | `'date'`, `'dateRange'`, `'datePeriod'`, or qualifier (`'ABT'`, `'CAL'`, `'EST'`) |
| `date` | `G7Date \| undefined` | Primary date |
| `date2` | `G7Date \| undefined` | Second date (for `BET … AND …` ranges) |

### `G7Time`

Represents a time value (e.g. `12:30:45.5Z`).

| Property | Type | Description |
|----------|------|-------------|
| `hours` | `number` | Hours (0–23) |
| `minutes` | `number` | Minutes |
| `seconds` | `number \| undefined` | Seconds |
| `timezone` | `string \| undefined` | Timezone (`'Z'` or offset `+HH:MM`) |

### `G7Enum`

Represents a GEDCOM 7 enumeration value.

| Property | Type | Description |
|----------|------|-------------|
| `value` | `string` | The tag or URI of the enumeration value |

---

## Payload types by structure

The nature of a `G7Structure`'s payload depends on its type URI:

| Payload type | JavaScript class |
|--------------|-----------------|
| Free text | `string` |
| Pointer | `G7Structure` (or `null` if destination unknown) |
| Absent | `undefined` |
| Integer | `number` |
| Age | `G7Age` |
| Date | `G7DateValue` |
| Time | `G7Time` |
| Enumeration | `G7Enum` |
| List | `Array` |
