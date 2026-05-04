# Référence API

## Module `gedcstruct.js`

### Classe `GEDCStruct`

Représente un nœud de l'arbre GEDCOM syntaxique (couche orientée tags).

#### Propriétés

| Propriété | Type | Description |
|-----------|------|-------------|
| `tag` | `string` | Le tag GEDCOM de ce nœud |
| `payload` | `string \| GEDCStruct \| null \| undefined` | La valeur du nœud : texte, pointeur vers un autre nœud, `null` si la destination du pointeur est inconnue, ou `undefined` si absent |
| `sub` | `GEDCStruct[]` | Les sous-structures enfants |
| `superstruct` | `GEDCStruct \| null` | La structure parente (lecture seule) |
| `references` | `GEDCStruct[]` | Structures qui pointent vers ce nœud (lecture seule) |
| `xref_id` | `string \| undefined` | Identifiant recommandé pour sérialiser les pointeurs vers ce nœud (lecture seule) |

#### Méthodes statiques

---

**`GEDCStruct.fromString(input, config?, logger?)`**

Parse un texte GEDCOM en tableau de `GEDCStruct` (nœuds de niveau 0).

| Paramètre | Type | Description |
|-----------|------|-------------|
| `input` | `string` | Le texte GEDCOM complet |
| `config` | `object` | Configuration du dialecte. Utiliser `g7ConfGEDC` ou `g5ConfGEDC`. Défaut : dialecte générique permissif |
| `logger` | `function(msg)` | Appelée pour chaque erreur de syntaxe |

Retourne : `GEDCStruct[]`

---

**`GEDCStruct.fromJSON(obj)`**

Reconstruit un tableau de `GEDCStruct` depuis un objet JSON produit par `toJSON()`.

Retourne : `GEDCStruct[]`

---

#### Méthodes d'instance

**`toString(newline?, maxlen?, escapes?)`**

Sérialise ce nœud et ses descendants en texte GEDCOM.

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `newline` | `string` | `'\n'` | Séparateur de lignes |
| `maxlen` | `number` | `0` | Longueur max par ligne (0 = illimité, négatif = illimité sans CONC) |
| `escapes` | `boolean` | `false` | Si `true`, ne pas échapper `@#` en `@@#` |

Retourne : `string`

---

**`toJSON()`**

Sérialise ce nœud en objet JSON reconstructible.

Retourne : `object`

---

**`querySelector(path)`**

Retourne le **premier** nœud correspondant au chemin de tags donné.

**`querySelectorAll(path)`**

Retourne un itérateur de **tous** les nœuds correspondant au chemin de tags donné.

Syntaxe des chemins :

| Chemin | Signification |
|--------|---------------|
| `XYZ` | N'importe quel nœud avec le tag `XYZ` |
| `.XYZ` | Un nœud racine (niveau 0) avec le tag `XYZ` |
| `ABC.XYZ` | Un `XYZ` enfant direct d'un `ABC` |
| `ABC..XYZ` | Un `XYZ` descendant quelconque d'un `ABC` |

Exemple :
```js
gedc.querySelector('HEAD.GEDC.VERS')  // Version GEDCOM
gedc.querySelectorAll('.INDI')        // Tous les individus
```

---

### Objets de configuration

#### `g7ConfGEDC` — FamilySearch GEDCOM 7

```js
{
  len: -1,        // pas de limite de longueur, CONC interdit
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
  len: 255,       // 255 caractères max par ligne
  tag: /^[0-9a-z_A-Z]{1,31}$/u,
  xref: /^[0-9a-z_A-Z][^\p{Cc}@]{0,19}$/u,
  linesep: /^[\r\n][\r\n \t]*$/,
  delim: /^ $/,
  zeros: false,
  escapes: true,
}
```

#### Clés de configuration

| Clé | Rôle |
|-----|------|
| `len` | Longueur max de ligne (0 = illimité, négatif = illimité sans CONC) |
| `tag` | Regex de validation des tags |
| `xref` | Regex de validation des identifiants cross-référence |
| `linesep` | Regex des séparateurs de lignes autorisés |
| `delim` | Regex des délimiteurs autorisés |
| `payload` | Regex des payloads texte autorisés |
| `zeros` | `true` pour autoriser les niveaux avec zéros initiaux (`00`, `01`…) |
| `escapes` | `true` pour ne pas échapper `@#` en `@@#` lors de la sérialisation |

---

## Module `g7lookups.js`

### Classe `G7Lookups`

Encapsule la spécification FamilySearch GEDCOM 7 et sert de registre dynamique pour la résolution des types de tags et la gestion des extensions.

#### Propriétés

| Propriété | Type | Description |
|-----------|------|-------------|
| `err` | `function(msg)` | Callback pour les violations de la spécification |
| `warn` | `function(msg)` | Callback pour les comportements déconseillés |

Les doublons sont automatiquement filtrés : chaque message unique n'est reporté qu'une seule fois.

#### Constructeur

**`new G7Lookups(g7validation)`**

| Paramètre | Type | Description |
|-----------|------|-------------|
| `g7validation` | `object` | Le contenu du fichier `g7validation.json` de FamilySearch |

Le fichier peut être obtenu depuis :
`https://raw.githubusercontent.com/FamilySearch/GEDCOM-registries/main/generated_files/g7validation.json`

---

## Module `g7structure.js`

### Classe `G7Dataset`

Conteneur de niveau supérieur pour un dataset GEDCOM 7 complet.

#### Propriétés

| Propriété | Type | Description |
|-----------|------|-------------|
| `header` | `G7Structure` | La structure `HEAD` du dataset |
| `records` | `Map<string, G7Structure[]>` | Enregistrements racine, indexés par type URI |

#### Méthodes statiques

---

**`G7Dataset.fromString(text, lookup)`**

Parse un texte GEDCOM directement en `G7Dataset` (combine `fromString` de `GEDCStruct` et `fromGEDC`).

| Paramètre | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Le texte GEDCOM complet |
| `lookup` | `G7Lookups` | La spécification GEDCOM 7 |

Retourne : `G7Dataset`

---

**`G7Dataset.fromGEDC(gedc, lookup)`**

Convertit un tableau de `GEDCStruct` en `G7Dataset` typé et validé.

| Paramètre | Type | Description |
|-----------|------|-------------|
| `gedc` | `GEDCStruct[]` | Résultat de `GEDCStruct.fromString()` |
| `lookup` | `G7Lookups` | La spécification GEDCOM 7 |

Retourne : `G7Dataset`

---

**`G7Dataset.fromJSON(obj, lookup)`**

Reconstruit un `G7Dataset` depuis un objet JSON produit par `toJSON()`.

Retourne : `G7Dataset`

---

#### Méthodes d'instance

**`createRecord(type, payload?, pltype?, id?)`**

Crée un enregistrement racine et l'ajoute au dataset.

| Paramètre | Type | Description |
|-----------|------|-------------|
| `type` | `string` | L'URI du type GEDCOM 7 (ex. `'https://gedcom.io/terms/v7/record-INDI'`) |
| `payload` | variable | La valeur initiale du payload |
| `pltype` | `string` | Type de payload explicite si non déductible |
| `id` | `string` | Identifiant xref suggéré pour la sérialisation |

Retourne : `G7Structure`

---

**`find(type, payload, ...args)`**

Recherche un enregistrement du type donné. Accepte des critères supplémentaires sous forme de paires `(typeURI, valeur)` à vérifier dans les sous-structures.

```js
// Trouver l'individu ayant le REFN "ID-42"
const person = dataset.find(
  'https://gedcom.io/terms/v7/record-INDI', -1,
  'https://gedcom.io/terms/v7/REFN', 'ID-42'
)
// Retourne null si non trouvé
```

La valeur `-1` comme payload signifie "n'importe quelle valeur".

Retourne : `G7Structure | null`

---

**`findOrCreate(type, payload, ...args)`**

Comme `find`, mais crée l'enregistrement s'il n'existe pas. Plusieurs appels avec les mêmes arguments retournent toujours le même objet.

Retourne : `G7Structure`

---

**`validate()`**

Parcourt récursivement tout le dataset et vérifie les règles GEDCOM 7 (cardinalité, types de payload, champs requis). Les erreurs et avertissements sont reportés via les callbacks de `G7Lookups`.

Retourne : `number` — le nombre d'erreurs trouvées.

---

**`populateSchema()`**

Examine les extensions utilisées dans le dataset et ajoute automatiquement les entrées `HEAD.SCHMA.TAG` nécessaires. À appeler avant `toString()` si des extensions sont présentes.

---

**`toString()`**

Sérialise le dataset en texte GEDCOM 7.

Retourne : `string`

---

**`toJSON()`**

Sérialise le dataset en objet JSON reconstructible via `fromJSON`.

Retourne : `object`

---

**`toGEDC()`**

Convertit le dataset en tableau de `GEDCStruct` (couche 1), permettant une sérialisation fine via `GEDCStruct.toString()`.

Retourne : `GEDCStruct[]`

---

### Classe `G7Structure`

Représente un nœud typé dans l'arbre GEDCOM 7.

#### Propriétés

| Propriété | Type | Description |
|-----------|------|-------------|
| `type` | `string` | URI GEDCOM 7 ou tag d'extension non documenté |
| `payload` | variable | Valeur typée selon le type de structure |
| `sub` | `Map<string, G7Structure[]>` | Sous-structures indexées par type URI |
| `superstruct` | `G7Structure \| null` | Structure parente (lecture seule) |
| `references` | objet | Structures qui pointent vers celle-ci (lecture seule) |
| `xref_id` | `string \| undefined` | Identifiant xref suggéré (lecture seule) |

#### Méthodes d'instance

**`createSubstructure(type, payload?, pltype?)`**

Crée une sous-structure et l'attache à ce nœud.

| Paramètre | Type | Description |
|-----------|------|-------------|
| `type` | `string` | URI du type GEDCOM 7 |
| `payload` | variable | Valeur initiale du payload |
| `pltype` | `string` | Type de payload explicite si non déductible |

Retourne : `G7Structure` (la nouvelle sous-structure)

---

**`find(type, payload, ...args)`**

Comme `G7Dataset.find`, mais cherche dans les sous-structures de ce nœud.

Retourne : `G7Structure | null`

---

**`findOrCreate(type, payload, ...args)`**

Comme `G7Dataset.findOrCreate`, mais opère sur les sous-structures de ce nœud.

Retourne : `G7Structure`

---

**`validate()`**

Lance la validation récursive depuis ce nœud.

Retourne : `number` — nombre d'erreurs.

---

**`toString()`**, **`toJSON()`**, **`toGEDC()`**

Équivalents aux méthodes de `G7Dataset`, mais limités à ce nœud et ses descendants.

---

## Module `g7datatypes.js`

Ces classes représentent les types de payloads structurés de GEDCOM 7. Elles sont retournées automatiquement par la couche orientée types ; vous ne les construisez généralement pas manuellement.

### `G7Age`

Représente un âge GEDCOM 7 (ex. `> 35y 6m`).

| Propriété | Type | Description |
|-----------|------|-------------|
| `operator` | `string \| undefined` | `'<'` ou `'>'` |
| `years` | `number \| undefined` | Nombre d'années |
| `months` | `number \| undefined` | Nombre de mois |
| `weeks` | `number \| undefined` | Nombre de semaines |
| `days` | `number \| undefined` | Nombre de jours |

### `G7Date`

Représente une date calendaire précise (ex. `1 JAN 1900`).

| Propriété | Type | Description |
|-----------|------|-------------|
| `calendar` | `string` | URI du calendrier (grégorien par défaut) |
| `month` | `string \| undefined` | Code du mois (`JAN`, `FEB`…) |
| `day` | `number \| undefined` | Jour du mois |
| `year` | `number` | Année |
| `epoch` | `string \| undefined` | Époque (`BCE`…) |

### `G7DateValue`

Représente une valeur de date flexible : date précise, approximation, plage, ou période.

| Propriété | Type | Description |
|-----------|------|-------------|
| `type` | `string` | `'date'`, `'dateRange'`, `'datePeriod'`, ou qualificatif (`'ABT'`, `'CAL'`, `'EST'`) |
| `date` | `G7Date \| undefined` | La date principale |
| `date2` | `G7Date \| undefined` | La seconde date (pour les plages `BET … AND …`) |

### `G7Time`

Représente une heure (ex. `12:30:45.5Z`).

| Propriété | Type | Description |
|-----------|------|-------------|
| `hours` | `number` | Heures (0–23) |
| `minutes` | `number` | Minutes |
| `seconds` | `number \| undefined` | Secondes |
| `timezone` | `string \| undefined` | Fuseau horaire (`'Z'` ou offset `+HH:MM`) |

### `G7Enum`

Représente une valeur d'énumération GEDCOM 7.

| Propriété | Type | Description |
|-----------|------|-------------|
| `value` | `string` | Le tag ou l'URI de la valeur |

---

## Types de payloads par structure

La nature du payload d'un `G7Structure` dépend de son type URI :

| Type de payload | Classe JavaScript |
|-----------------|-------------------|
| Texte libre | `string` |
| Pointeur | `G7Structure` (ou `null` si destination inconnue) |
| Absent | `undefined` |
| Entier | `number` |
| Âge | `G7Age` |
| Date | `G7DateValue` |
| Heure | `G7Time` |
| Énumération | `G7Enum` |
| Liste | `Array` |
