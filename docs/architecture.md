# Architecture

## Overview

The library is organized into independent layers. Each layer can be used alone, or combined with the next for richer processing.

```
Raw GEDCOM text
       │
       ▼
┌─────────────────────────────────────────┐
│  Layer 1: Tag-oriented  (gedcstruct)    │
│  Tree of GEDCStruct nodes               │
│  – tag, payload (string/pointer), sub   │
└─────────────────────────────────────────┘
       │
       ▼ G7Dataset.fromGEDC()
┌─────────────────────────────────────────┐
│  Layer 2: Type-aware  (g7structure)     │
│  Tree of validated G7Structure nodes    │
│  – type (URI), payload (typed), sub (Map│
└─────────────────────────────────────────┘
       ▲
       │ powered by
┌─────────────────────────────────────────┐
│  Layer 3: Specification  (g7lookups)    │
│  G7Lookups: FamilySearch registry       │
│  – tag definitions, types, enumerations │
└─────────────────────────────────────────┘
```

---

## Layer 1: Tag-oriented — `gedcstruct.js`

### Role

This layer reads raw GEDCOM syntax without knowing the meaning of any tag. It produces a tree of `GEDCStruct` nodes by handling:

- level numbering (0, 1, 2…)
- cross-references (`@I1@`) resolved to direct pointers
- `CONT` (line continuation) and `CONC` (concatenation) pseudo-structures, which are transparent after parsing
- GEDCOM dialects (5.x or 7.x)

### Structure of a `GEDCStruct` node

Each node represents one GEDCOM line:

```
0 @I1@ INDI
1 NAME John /Doe/
1 BIRT
2 DATE 1 JAN 1900
```

| Property | Type | Description |
|----------|------|-------------|
| `tag` | `string` | The GEDCOM tag (`INDI`, `NAME`, `BIRT`…) |
| `payload` | `string \| GEDCStruct \| null \| undefined` | The line value, or a pointer to another node |
| `sub` | `GEDCStruct[]` | Child sub-structures |

`fromString` returns the level-0 nodes (root records). Each node holds its children in `sub`.

### Dialects

Two pre-built configuration objects match the official specifications:

- **`g7ConfGEDC`**: FamilySearch GEDCOM 7 — no line length limit, strictly alphanumeric tags, no `CONC`.
- **`g5ConfGEDC`**: GEDCOM 5.x — 255-character line limit, more permissive tag format.

The configuration controls: line length, tag and cross-reference format, allowed delimiters, and allowed payloads.

### Data flow (layer 1 only)

```
GEDCOM text
    │ GEDCStruct.fromString(text, config, logger)
    ▼
GEDCStruct[]  (array of level-0 nodes)
    │
    ├── querySelector('HEAD.GEDC.VERS')   → first match
    ├── querySelectorAll('.INDI')         → all individuals
    │
    │ toString(newline, maxlen, escapes)
    ▼
GEDCOM text  (round-trip)
```

---

## Layer 2: Type-aware — `g7structure.js`

### Role

This layer applies GEDCOM 7 semantics to the tree produced by layer 1. For each `GEDCStruct` node it:

1. determines the **type** (FamilySearch URI) based on context (tag + position in tree)
2. parses the **payload** into the correct type (date, age, enumeration, pointer…)
3. enforces **cardinality rules** (required fields, singular fields, etc.)
4. handles **extensions** (tags starting with `_`, unregistered tags, relocated tags)

### The two main classes

#### `G7Structure` — A typed node

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | GEDCOM 7 URI or undocumented extension tag |
| `payload` | variable | Typed value (string, G7Date, G7Enum, G7Structure, null…) |
| `sub` | `Map<type, G7Structure[]>` | Sub-structures indexed by type URI |

The `sub` map key is the type URI, not the tag. Multiple sub-structures of the same type are grouped in an array.

#### `G7Dataset` — The complete dataset

Top-level container holding:

| Property | Description |
|----------|-------------|
| `header` | The `G7Structure` of type `HEAD` |
| `records` | `Map<type_uri, G7Structure[]>` — all root records |

### Data flow (layer 2)

```
GEDCStruct[]  (layer 1)
    │ G7Dataset.fromGEDC(gedc, lookup)
    ▼
G7Dataset
    ├── header: G7Structure (HEAD)
    └── records: Map
         ├── 'https://gedcom.io/terms/v7/record-INDI' → [G7Structure, ...]
         ├── 'https://gedcom.io/terms/v7/record-FAM'  → [G7Structure, ...]
         └── ...

    │ dataset.validate()       → error count
    │ dataset.populateSchema() → add HEAD.SCHMA for extensions
    │ dataset.toString()       → GEDCOM text
    │ dataset.toJSON()         → JSON object
    ▼
Output
```

### Programmatic creation

Layer 2 can be used without parsing. A dataset is built from scratch:

```
new G7Dataset(lookup)
    │ createRecord(typeURI)
    ▼
G7Structure  (record)
    │ createSubstructure(typeURI, payload)
    ▼
G7Structure  (sub-structure)
    ...
```

The `findOrCreate` pattern enables declarative writes: the call describes the desired structure and the library either returns the existing one or creates it.

---

## Layer 3: Specification — `g7lookups.js`

### Role

`G7Lookups` wraps the `g7validation.json` file published by FamilySearch. This file describes all standard tags, their payload types, cardinality rules, and valid enumeration sets.

Layer 2 consults `G7Lookups` for every node during conversion from layer 1. The `err` and `warn` callbacks capture errors and warnings without interrupting processing.

### Extension handling

GEDCOM extensions are tags or structures defined outside the official specification. `G7Lookups` classifies them into four categories:

| Category | Description |
|----------|-------------|
| **Undocumented** | `_`-prefixed tag with no definition in `HEAD.SCHMA` |
| **Unregistered** | URI present in `SCHMA` but absent from the FamilySearch registry |
| **Aliased** | Tag that matches a standard type in a different context |
| **Relocated** | Standard structure used under an unexpected superstructure |

---

## Payload types — `g7datatypes.js`

GEDCOM 7 defines several structured value types. The library represents them as distinct objects:

| Class | GEDCOM example | Description |
|-------|----------------|-------------|
| `G7Age` | `> 35y 6m` | Age with operator, years, months, weeks, days |
| `G7Date` | `1 JAN 1900` | Precise date with calendar, month, day, year, epoch |
| `G7DateValue` | `ABT 1900`, `BET 1900 AND 1910` | Flexible date (approximation, range, period…) |
| `G7Time` | `12:30:45Z` | Time with timezone |
| `G7Enum` | `HUSB` | Enumeration value (URI or tag depending on context) |

`string` payloads (free text, name, language…) remain plain JavaScript strings.

---

## Separation of concerns

This architecture supports several independent use cases:

- **Simple parsing**: use only `gedcstruct.js` to read any GEDCOM file without type validation.
- **Validation**: go through all three layers to detect every violation of the GEDCOM 7 specification.
- **Transformation**: read at layer 1, modify, write back to GEDCOM without involving layer 2.
- **Typed creation**: build a valid GEDCOM 7 dataset from scratch using layer 2.
