# Architecture de js-gedcom

## Vue d'ensemble

La bibliothèque est organisée en couches indépendantes. Chaque couche peut être utilisée seule, ou combinée avec les suivantes pour des traitements plus riches.

```
Texte GEDCOM brut
       │
       ▼
┌─────────────────────────────────────────┐
│  Couche 1 : Orientée tags (gedcstruct)  │
│  Arbre de nœuds GEDCStruct              │
│  – tag, payload (string/pointeur), sub  │
└─────────────────────────────────────────┘
       │
       ▼ G7Dataset.fromGEDC()
┌─────────────────────────────────────────┐
│  Couche 2 : Orientée types (g7structure)│
│  Arbre de G7Structure validées          │
│  – type (URI), payload (typé), sub (Map)│
└─────────────────────────────────────────┘
       ▲
       │ alimentée par
┌─────────────────────────────────────────┐
│  Couche 3 : Spécification (g7lookups)   │
│  G7Lookups : registre FamilySearch      │
│  – définitions de tags, types, enums    │
└─────────────────────────────────────────┘
```

---

## Couche 1 : Orientée tags — `gedcstruct.js`

### Rôle

Cette couche lit la syntaxe GEDCOM brute sans rien savoir de la signification des tags. Elle produit un arbre de `GEDCStruct` en gérant :

- la numérotation des niveaux (0, 1, 2…)
- les cross-références (`@I1@`) transformées en pointeurs directs
- les pseudo-structures `CONT` (continuation de ligne) et `CONC` (concaténation), transparentes après parsing
- les dialectes GEDCOM (5.x ou 7.x)

### Structure d'un nœud `GEDCStruct`

Chaque nœud représente une ligne GEDCOM :

```
0 @I1@ INDI
1 NAME John /Doe/
1 BIRT
2 DATE 1 JAN 1900
```

| Propriété | Type | Description |
|-----------|------|-------------|
| `tag` | `string` | Le tag GEDCOM (`INDI`, `NAME`, `BIRT`…) |
| `payload` | `string \| GEDCStruct \| null \| undefined` | La valeur de la ligne, ou un pointeur vers un autre nœud |
| `sub` | `GEDCStruct[]` | Les sous-structures (enfants) |

La liste retournée par `fromString` représente les nœuds de niveau 0 (enregistrements racine). Chaque nœud contient ses enfants dans `sub`.

### Dialectes

Deux configurations prédéfinies correspondent aux spécifications officielles :

- **`g5ConfGEDC`** : GEDCOM 5.x — longueur de ligne limitée à 255 caractères, format de tag plus permissif.
- **`g7ConfGEDC`** : FamilySearch GEDCOM 7 — longueur illimitée, tags strictement alphanumériques, pas de `CONC`.

La configuration contrôle : longueur de ligne, format de tag et d'identifiant, séparateurs, payloads autorisés.

### Flux de données (couche 1 seule)

```
Texte GEDCOM
    │ GEDCStruct.fromString(text, config, logger)
    ▼
GEDCStruct[] (tableau des nœuds de niveau 0)
    │
    ├── querySelector('HEAD.GEDC.VERS')      → premier match
    ├── querySelectorAll('.INDI')            → tous les individus
    │
    │ toString(newline, maxlen, escapes)
    ▼
Texte GEDCOM (round-trip)
```

---

## Couche 2 : Orientée types — `g7structure.js`

### Rôle

Cette couche applique la sémantique GEDCOM 7 à l'arbre produit par la couche 1. Pour chaque nœud `GEDCStruct`, elle :

1. détermine le **type** (URI FamilySearch) en fonction du contexte (tag + position dans l'arbre)
2. parse le **payload** dans le type correct (date, âge, énumération, pointeur…)
3. vérifie les **règles de cardinalité** (champs requis, champs uniques, etc.)
4. gère les **extensions** (tags commençant par `_`, tags non enregistrés, tags relocalisés)

### Les deux classes principales

#### `G7Structure` — Un nœud typé

| Propriété | Type | Description |
|-----------|------|-------------|
| `type` | `string` | URI GEDCOM 7 ou tag d'extension non documenté |
| `payload` | variable | Valeur typée (string, G7Date, G7Enum, G7Structure, null…) |
| `sub` | `Map<type, G7Structure[]>` | Sous-structures indexées par type |

La clé de `sub` est le type URI, pas le tag. Plusieurs sous-structures du même type sont regroupées dans un tableau.

#### `G7Dataset` — Le dataset complet

Conteneur de niveau supérieur. Contient :

| Propriété | Description |
|-----------|-------------|
| `header` | Le `G7Structure` de type `HEAD` |
| `records` | `Map<type_uri, G7Structure[]>` — tous les enregistrements racine |

### Flux de données (couche 2)

```
GEDCStruct[] (couche 1)
    │ G7Dataset.fromGEDC(gedc, lookup)
    ▼
G7Dataset
    ├── header: G7Structure (HEAD)
    └── records: Map
         ├── 'https://gedcom.io/terms/v7/record-INDI' → [G7Structure, ...]
         ├── 'https://gedcom.io/terms/v7/record-FAM'  → [G7Structure, ...]
         └── ...

    │ dataset.validate()      → compte les erreurs
    │ dataset.populateSchema() → ajoute HEAD.SCHMA pour les extensions
    │ dataset.toString()       → texte GEDCOM
    │ dataset.toJSON()         → objet JSON
    ▼
Sortie
```

### Création programmatique

La couche 2 peut être utilisée sans parsing. On construit un dataset de zéro :

```
new G7Dataset(lookup)
    │ createRecord(typeURI)
    ▼
G7Structure (record)
    │ createSubstructure(typeURI, payload)
    ▼
G7Structure (sous-structure)
    ...
```

Le pattern `findOrCreate` permet de travailler de manière déclarative : on décrit la structure souhaitée et la bibliothèque la crée si elle n'existe pas, ou retourne l'existante si elle est déjà là.

---

## Couche 3 : Spécification — `g7lookups.js`

### Rôle

`G7Lookups` encapsule le fichier `g7validation.json` publié par FamilySearch. Ce fichier décrit l'ensemble des tags standard, leurs types de payload, leurs règles de cardinalité, et les ensembles d'énumérations valides.

La couche 2 consulte `G7Lookups` pour chaque nœud pendant la conversion depuis la couche 1. Les callbacks `err` et `warn` permettent de capturer les erreurs et avertissements sans interrompre le traitement.

### Gestion des extensions

Les extensions GEDCOM sont des tags ou structures définis en dehors de la spécification officielle. `G7Lookups` les gère en plusieurs catégories :

| Catégorie | Description |
|-----------|-------------|
| **Non documentée** | Tag `_` sans définition dans `HEAD.SCHMA` |
| **Non enregistrée** | URI présente dans `SCHMA` mais absente du registre FamilySearch |
| **Alias** | Tag qui correspond à un type standard dans un autre contexte |
| **Relocalisée** | Structure standard utilisée sous une superstructure non prévue |

---

## Types de payloads — `g7datatypes.js`

GEDCOM 7 définit plusieurs types de valeurs structurées. La bibliothèque les représente comme des objets distincts :

| Classe | Exemple GEDCOM | Description |
|--------|----------------|-------------|
| `G7Age` | `> 35y 6m` | Âge avec opérateur, années, mois, semaines, jours |
| `G7Date` | `1 JAN 1900` | Date précise avec calendrier, mois, jour, année, époque |
| `G7DateValue` | `ABT 1900`, `BET 1900 AND 1910` | Valeur de date (approximation, plage, période…) |
| `G7Time` | `12:30:45Z` | Heure avec fuseau horaire |
| `G7Enum` | `HUSB` | Valeur d'énumération (URI ou tag selon contexte) |

Les payloads de type `string` (texte libre, nom, langue…) restent des chaînes JavaScript.

---

## Séparation des responsabilités

Cette architecture permet plusieurs usages indépendants :

- **Parsing simple** : utiliser uniquement `gedcstruct.js` pour lire n'importe quel fichier GEDCOM sans valider les types.
- **Validation** : passer par les trois couches pour détecter toutes les violations de la spécification GEDCOM 7.
- **Transformation** : lire en couche 1, modifier, réécrire en GEDCOM sans passer par la couche 2.
- **Création typée** : construire un dataset GEDCOM 7 valide depuis zéro avec la couche 2.
