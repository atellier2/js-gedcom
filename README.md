# js-gedcom

Bibliothèque JavaScript sans dépendances pour lire, valider et créer des fichiers [GEDCOM](https://gedcom.io/) (arbres généalogiques). Supporte GEDCOM 5.x et [FamilySearch GEDCOM 7](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html).

> **Validateur en ligne** : Pour valider un fichier GEDCOM 7 directement dans le navigateur, visitez <https://gedcom7code.github.io/js-gedcom/>.

---

## Qu'est-ce que GEDCOM ?

GEDCOM (Genealogical Data Communication) est le format standard d'échange de données généalogiques. Un fichier GEDCOM est un arbre de structures en texte brut. Chaque ligne contient un **niveau**, un **tag**, et une **valeur** (payload) optionnelle :

```
0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME John /Doe/
1 BIRT
2 DATE 1 JAN 1900
```

Les structures s'imbriquent par niveau : une ligne de niveau `2` est enfant de la dernière ligne de niveau `1`.

---

## Architecture

La bibliothèque est organisée en **trois couches**, chacune construite sur la précédente :

| Couche | Module | Rôle |
|--------|--------|------|
| Orientée tags | `gedcstruct.js` | Lire/écrire la syntaxe GEDCOM brute |
| Orientée types | `g7structure.js` | Valider la sémantique GEDCOM 7 |
| Spécification | `g7lookups.js` | Registre FamilySearch GEDCOM 7 |

La couche orientée tags est suffisante pour lire et manipuler des fichiers GEDCOM sans validation stricte. La couche orientée types nécessite la spécification FamilySearch et applique les règles de cardinalité, de types de payload, et de gestion des extensions.

→ Voir [docs/architecture.md](docs/architecture.md) pour une explication détaillée.

---

## Démarrage rapide

### Lire un fichier GEDCOM (couche tags)

```js
import { GEDCStruct, g7ConfGEDC } from './gedcstruct.js'

const gedc = GEDCStruct.fromString(gedcomText, g7ConfGEDC, console.error)
// gedc est un tableau de GEDCStruct de niveau 0

const version = gedc.querySelector('HEAD.GEDC.VERS')?.payload  // "7.0"
const individus = [...gedc.querySelectorAll('.INDI')]           // tous les INDI
```

### Lire et valider un fichier GEDCOM 7

```js
import { GEDCStruct, g7ConfGEDC } from './gedcstruct.js'
import { G7Lookups } from './g7lookups.js'
import { G7Dataset } from './g7structure.js'

// 1. Charger la spécification GEDCOM 7
const spec = await fetch('https://raw.githubusercontent.com/FamilySearch/GEDCOM-registries/main/generated_files/g7validation.json')
  .then(r => r.json())
const lookup = new G7Lookups(spec)
lookup.err  = msg => console.error('Erreur :', msg)
lookup.warn = msg => console.warn('Avertissement :', msg)

// 2. Parser
const gedc    = GEDCStruct.fromString(gedcomText, g7ConfGEDC)
const dataset = G7Dataset.fromGEDC(gedc, lookup)

// 3. Valider
dataset.validate()
```

### Créer un dataset programmatiquement

```js
const dataset = new G7Dataset(lookup)

// Créer un individu
const person = dataset.createRecord('https://gedcom.io/terms/v7/record-INDI')

// Ajouter une naissance
person.createSubstructure('https://gedcom.io/terms/v7/BIRT', 'Y')
  .createSubstructure('https://gedcom.io/terms/v7/DATE', '1 JAN 1900')

// Sérialiser en texte GEDCOM
const output = dataset.toString()
```

### Trouver ou créer (find-or-create)

```js
// Trouver un individu par sa valeur REFN, ou le créer s'il n'existe pas
const person = dataset.findOrCreate(
  'https://gedcom.io/terms/v7/record-INDI', -1,
  'https://gedcom.io/terms/v7/REFN', 'ID-42'
)

// Appeler plusieurs fois retourne toujours le même objet
const same = dataset.findOrCreate(
  'https://gedcom.io/terms/v7/record-INDI', -1,
  'https://gedcom.io/terms/v7/REFN', 'ID-42'
)
// person === same  →  true
```

---

## Modules

### `gedcstruct.js` — Couche orientée tags

Transforme un texte GEDCOM en arbre de nœuds `GEDCStruct`. Gère les pseudo-structures `CONT`/`CONC`, les pointeurs cross-référence, et les dialectes 5.x ou 7.x.

Exports : `GEDCStruct`, `g5ConfGEDC`, `g7ConfGEDC`

### `g7lookups.js` — Registre GEDCOM 7

Encapsule le fichier [g7validation.json](https://github.com/FamilySearch/GEDCOM-registries) de FamilySearch. Fournit la résolution dynamique des types de tags, des types de payload, des ensembles d'énumérations, et des extensions.

Exports : `G7Lookups`

### `g7structure.js` — Couche orientée types

Convertit les nœuds `GEDCStruct` en `G7Structure` typées et validées selon la spécification GEDCOM 7. Gère les règles de cardinalité, les extensions, et la sérialisation SCHMA.

Exports : `G7Structure`, `G7Dataset`

### `g7datatypes.js` — Types de payloads

Implémente les types de valeurs GEDCOM 7 : `G7Date`, `G7DateValue`, `G7Age`, `G7Time`, `G7Enum`.

---

## Documentation détaillée

- [Architecture et flux de données](docs/architecture.md)
- [Référence API](docs/api.md)
- [Exemples pratiques](docs/examples.md)

---

## Encodage des caractères

La bibliothèque travaille sur des chaînes JavaScript. Elle ne gère pas la conversion d'encodage binaire (UTF-8, ANSEL, etc.) : le fichier doit être décodé en chaîne JavaScript avant d'être passé à la bibliothèque.

---

## Licence

Publiée sous [MIT](LICENSE-MIT) et [Unlicense](LICENSE-UNLICENSE). Les deux s'appliquent simultanément ; utilisez celle qui vous convient.

---

## Contribuer

Les rapports de bugs et les pull requests sont les bienvenus via [GitHub Issues](https://github.com/gedcom7code/js-gedcom/issues).

---

## État du développement

<details>
<summary>Voir la liste des fonctionnalités</summary>

- [x] Couche orientée tags
    - [x] Parser avec gestion CONT/CONC et dialectes multiples
    - [x] Création manuelle de structures
    - [x] Sérialiseur/désérialiseur JSON
    - [x] `querySelector` et `querySelectorAll`
- [x] Couche orientée types
    - [x] Chargement de la spécification GEDCOM 7 (GEDCOM-registries)
    - [x] Résolution contextuelle du type de structure
    - [x] Validation du type de payload et des règles de cardinalité
    - [x] Gestion des extensions (non documentées, non enregistrées, aliases, relocalisées)
    - [x] Avertissements de dépréciation
    - [x] Création manuelle avec vérification d'erreurs (`.validate()`)
    - [ ] Vérification automatique partielle à la création
    - [x] Sérialisation vers la couche tags avec déduction du schéma
    - [x] Sérialiseur/désérialiseur JSON
    - [x] `find` et `findOrCreate`

</details>
