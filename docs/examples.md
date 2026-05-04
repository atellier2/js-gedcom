# Exemples pratiques

## 1. Lire un fichier GEDCOM et en extraire des données

### Extraction simple avec la couche tags

Pour parcourir rapidement un fichier GEDCOM sans valider les types, la couche `GEDCStruct` suffit.

```js
import { GEDCStruct, g7ConfGEDC } from './gedcstruct.js'

const gedc = GEDCStruct.fromString(gedcomText, g7ConfGEDC, console.error)

// Lire la version GEDCOM
const version = gedc.querySelector('HEAD.GEDC.VERS')?.payload
console.log('Version :', version)  // "7.0"

// Lister tous les individus (INDI de niveau 0)
for (const indi of gedc.querySelectorAll('.INDI')) {
  const name = indi.querySelector('NAME')?.payload
  const birth = indi.querySelector('BIRT.DATE')?.payload
  console.log(name, '— né(e) :', birth)
}
```

### Extraction avec la couche types (GEDCOM 7)

Pour accéder aux payloads typés et bénéficier de la validation :

```js
import { GEDCStruct, g7ConfGEDC } from './gedcstruct.js'
import { G7Lookups } from './g7lookups.js'
import { G7Dataset } from './g7structure.js'

const spec    = await fetch('https://raw.githubusercontent.com/FamilySearch/GEDCOM-registries/main/generated_files/g7validation.json').then(r => r.json())
const lookup  = new G7Lookups(spec)
lookup.err  = msg => console.error(msg)
lookup.warn = msg => console.warn(msg)

const gedc    = GEDCStruct.fromString(gedcomText, g7ConfGEDC)
const dataset = G7Dataset.fromGEDC(gedc, lookup)

const INDI = 'https://gedcom.io/terms/v7/record-INDI'
const NAME = 'https://gedcom.io/terms/v7/NAME'
const BIRT = 'https://gedcom.io/terms/v7/BIRT'
const DATE = 'https://gedcom.io/terms/v7/DATE'

for (const person of dataset.records.get(INDI) ?? []) {
  const name = person.sub.get(NAME)?.[0]?.payload   // string
  const date = person.sub.get(BIRT)?.[0]?.sub.get(DATE)?.[0]?.payload  // G7DateValue
  console.log(name, date?.toString())
}
```

---

## 2. Valider un fichier GEDCOM 7

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

console.log(`${errors.length} erreur(s), ${warnings.length} avertissement(s)`)
errors.forEach(e => console.error('ERREUR :', e))
warnings.forEach(w => console.warn('AVERT. :', w))
```

---

## 3. Créer un dataset GEDCOM 7 depuis zéro

```js
import { G7Lookups } from './g7lookups.js'
import { G7Dataset } from './g7structure.js'

// Préfixes d'URI pour la lisibilité
const T = 'https://gedcom.io/terms/v7/'

const spec    = await fetch('...g7validation.json').then(r => r.json())
const lookup  = new G7Lookups(spec)
const dataset = new G7Dataset(lookup)

// Créer un individu
const person = dataset.createRecord(T + 'record-INDI')

// Ajouter un nom
person.createSubstructure(T + 'NAME', 'Marie /Dupont/')

// Ajouter une naissance
const birth = person.createSubstructure(T + 'BIRT', 'Y')
birth.createSubstructure(T + 'DATE', '15 MAR 1985')
birth.createSubstructure(T + 'PLAC', 'Paris, France')

// Ajouter une note
person.createSubstructure(T + 'NOTE', 'Ancêtre maternel.')

// Sérialiser
dataset.populateSchema()  // obligatoire si des extensions sont utilisées
const output = dataset.toString()
console.log(output)
```

---

## 4. Trouver ou créer des structures (import incrémental)

Le pattern `findOrCreate` est conçu pour les imports itératifs : on peut appeler la même opération plusieurs fois sans créer de doublons.

```js
const T = 'https://gedcom.io/terms/v7/'

// Créer ou retrouver un individu identifié par son REFN
const person = dataset.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'PERSON-001')

// Créer ou retrouver sa naissance identifiée par un UUID
const birth = person.findOrCreate(T + 'BIRT', -1, T + 'UID', 'a3f4-...')
birth.payload = 'Y'

// Créer ou retrouver un submitter identifié par son nom
const submitter = dataset.findOrCreate(T + 'record-SUBM', -1, T + 'NAME', 'Alice Martin')

// Lier le submitter à l'individu (idempotent)
person.findOrCreate(T + 'SUBM', submitter)
```

---

## 5. Créer une famille avec des liens parent–enfant

```js
const T = 'https://gedcom.io/terms/v7/'

const father = dataset.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'FATHER')
father.createSubstructure(T + 'NAME', 'Jean /Dupont/')

const mother = dataset.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'MOTHER')
mother.createSubstructure(T + 'NAME', 'Isabelle /Martin/')

const child = dataset.findOrCreate(T + 'record-INDI', -1, T + 'REFN', 'CHILD')
child.createSubstructure(T + 'NAME', 'Marie /Dupont/')

// Créer la famille
const family = dataset.createRecord(T + 'record-FAM')
family.createSubstructure(T + 'HUSB', father)  // payload = pointeur
family.createSubstructure(T + 'WIFE', mother)
family.createSubstructure(T + 'CHIL', child)

// Liens symétriques obligatoires
father.createSubstructure(T + 'INDI-FAMS', family)
mother.createSubstructure(T + 'INDI-FAMS', family)
child.createSubstructure(T + 'INDI-FAMC', family)
```

---

## 6. Utiliser une extension

Les extensions sont des structures définies en dehors de la spécification standard. Elles doivent commencer par `_` ou être enregistrées dans `HEAD.SCHMA`.

```js
const person = dataset.createRecord('https://gedcom.io/terms/v7/record-INDI')

// Extension documentée (URI enregistrée dans HEAD.SCHMA)
person.createSubstructure('https://example.com/myapp/EXT-FIELD', 'valeur')

// populateSchema() ajoute automatiquement la référence dans HEAD.SCHMA
dataset.populateSchema()
const output = dataset.toString()
```

---

## 7. Round-trip : lire, modifier, réécrire

```js
import { GEDCStruct, g7ConfGEDC } from './gedcstruct.js'
import { G7Lookups } from './g7lookups.js'
import { G7Dataset } from './g7structure.js'

const spec    = await fetch('...g7validation.json').then(r => r.json())
const lookup  = new G7Lookups(spec)
const gedc    = GEDCStruct.fromString(originalText, g7ConfGEDC)
const dataset = G7Dataset.fromGEDC(gedc, lookup)

const T = 'https://gedcom.io/terms/v7/'

// Modifier : ajouter une note à tous les individus
for (const person of dataset.records.get(T + 'record-INDI') ?? []) {
  if (!person.sub.has(T + 'NOTE')) {
    person.createSubstructure(T + 'NOTE', 'Importé automatiquement.')
  }
}

// Valider avant de réécrire
dataset.validate()
dataset.populateSchema()

const modifiedText = dataset.toString()
```

---

## 8. Sérialiser en JSON et restaurer

Le format JSON est utile pour stocker ou transférer un dataset sans passer par le texte GEDCOM.

```js
// Sérialiser
const json = dataset.toJSON()
const jsonString = JSON.stringify(json)

// Restaurer
const restored = G7Dataset.fromJSON(JSON.parse(jsonString), lookup)
const text = restored.toString()
```

---

## 9. Utiliser uniquement la couche tags (GEDCOM 5.x ou non-standard)

Pour les fichiers GEDCOM 5.x ou les dialectes non standard, utilisez uniquement `gedcstruct.js` avec `g5ConfGEDC` :

```js
import { GEDCStruct, g5ConfGEDC } from './gedcstruct.js'

const gedc = GEDCStruct.fromString(gedcom5Text, g5ConfGEDC, console.error)

// Lire les champs sans validation sémantique
const source = gedc.querySelector('.SOUR')
const title  = source?.querySelector('TITL')?.payload

// Réécrire (préserve le dialecte 5.x : longueur 255, CONC si nécessaire)
const output = gedc.map(s => s.toString('\r\n', 255, true)).join('')
```

---

## 10. Capturer les erreurs de parsing séparément des erreurs de validation

Il y a deux niveaux d'erreurs distincts :

1. **Erreurs de syntaxe** : détectées par `GEDCStruct.fromString()` via le `logger`
2. **Erreurs de validation** : détectées par `G7Dataset.fromGEDC()` et `validate()` via les callbacks `lookup.err` / `lookup.warn`

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

console.log('Syntaxe :', syntaxErrors)
console.log('Types   :', typeErrors)
console.log('Conseils:', typeWarnings)
```
