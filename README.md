# Planification des études — DIRO (prototype)

## À quoi sert le projet

Choisir ses cours à l'université, ça paraît simple, jusqu'à ce qu'on réalise que l'offre est éparpillée (répertoire des cours, pages de département, projets négociés avec des profs, stages, séminaires annoncés par courriel) et que les règles du programme se découvrent souvent trop tard. Notre outil aide les étudiants du baccalauréat en informatique du DIRO (UdeM), y compris ceux en échange, à construire un plan de session qui tient la route : il rassemble l'offre au même endroit, montre les contraintes (crédits, temps plein, charge hebdomadaire, préalables, chevauchements d'horaire) avant qu'on s'engage, et garde une trace de nos démarches.

**Il ne remplace ni le conseil académique ni l'inscription officielle (registrariat).** C'est un coup de main pour décider, pas une place réservée.

Nous sommes partis du prototype *Mon cheminement* : nous l'avons d'abord manipulé et critiqué, puis nous avons conçu notre propre système plutôt que de le corriger.

### Nos objectifs

- **O1** Rassembler l'offre : cours, projets supervisés, stages, séminaires.
- **O2** Relier l'offre à la personne : profil, statut, intérêts.
- **O3** Rendre les contraintes visibles avant la décision.
- **O4** Tenir compte du temps : demandes, délais, dates limites.
- **O5** Dépasser la session en cours : projection sur plusieurs trimestres.
- **O6** Réduire la dépendance à la connaissance tacite : indicateurs vérifiables.

## Où on en est

### Ce qui fonctionne

- Les règles de programme (`src/data/program_rules.json`) et la logique métier, testée avec Vitest.
- L'écran **Profil** : les règles s'affichent avec leur explication, la cible de crédits reste dans les bornes autorisées et la cohérence des paramètres est vérifiée.
- L'écran **Plan** : on parcourt le catalogue, on ajoute des activités, les chevauchements d'horaire sont détectés et un panneau résume les contraintes (vert, orange, rouge, toujours accompagnés d'un texte et d'une icône).
- Les sélecteurs de rôle et d'étudiant.
- L'état est conservé dans le navigateur (`localStorage`).

### Ce qui est simulé

- Les données de démo : 16 cours réels, 1 cours fictif (`HORS-001`, non reconnu par le DIRO, pour tester cette règle) et 3 étudiants.
- Les préalables, horaires et charges hebdomadaires (7 h par cours, 9 h pour le projet) sont des valeurs de démo, à valider.
- Les 15 règles de programme sont toutes marquées « à valider » : aucune n'est encore confirmée par une source de l'UdeM.
- Le choix du rôle : il n'y a pas de vraie authentification.
- La persistance : `localStorage` remplace Supabase pour l'instant.

### Ce qu'il reste à faire

Dans cet ordre : filtres et score de pertinence, grille horaire, demandes, projection sur plusieurs trimestres, informations d'appoint, vues des autres rôles, activités et encadrants fictifs, échéances et date simulée, `supabase/schema.sql` et `seed.sql`, page « À propos des limites » et checklist d'accessibilité.

## Installer et lancer le prototype

Le plus simple : ouvrir le fichier HTML généré (`planification.html`) par double-clic.

Pour travailler sur le code, il faut Node 22.12 ou plus (la logique utilise `Object.groupBy`) et un navigateur récent (Safari 17.4+, Chrome 117+, Firefox 119+) :

```
npm install
npm test       # logique pure, Vitest
npm run dev    # serveur de développement (Vite)
npm run build  # génère dist/planification.html : un seul fichier, ouvrable par double-clic
```

Le fichier généré vient de `src/` : mieux vaut ne pas le modifier à la main. Il n'y a aucune dépendance d'exécution, Vite et Vitest servent seulement au développement.

## L'équipe

Nous sommes trois à avoir travaillé sur ce projet :

| Membre | Ce qu'il ou elle a fait |
|---|---|
| Arthur BARTHE | Relecture et correction des différentes versions du rapport, création du prototype |
| Benjamin MARTEL | Modélisations A1, A2 et A3, et coup de main sur le prototype |
| Frederyke Robitaille | Aide sur différentes tâches (à préciser) |

En commun : l'analyse et la critique du prototype *Mon cheminement*, la rédaction du rapport et la définition des exigences.

## Où sont les règles

Dans `src/data/program_rules.json`, une ligne par règle (`cle`, `valeur`, `explication`, `a_valider`). L'équivalent SQL arrivera dans `supabase/seed.sql`.

**Les 15 valeurs sont marquées « à valider »** : on ne les a pas encore confirmées avec une source de l'UdeM. On ne passe `a_valider` à `false` qu'après vérification.

## Comment la logique répond (`src/logic/`)

Chaque contrôle retourne `{ ok, niveau, etat, code, message, raison }`, plus quelques champs utiles selon le cas (`cible`, `demande`, `compteur`, `alertes`, `paire`).

- `niveau` : `ok`, `avertissement` ou `bloquant`.
- `etat` : `vert`, `orange` ou `rouge`. À l'écran, ce n'est jamais la couleur seule : il y a toujours le texte et une icône.
- `ok` : indique si la suite est bloquée. Un avertissement ne bloque pas, une règle dure oui.
- Quand une fonction peut trouver plusieurs problèmes, elle retourne une liste (`validateProfile`, `detectOverlaps`, `checkConstraints`).

Quelques écarts avec les signatures du cahier des charges :
- `handleExpiration(request, supervisor, now, regles)` : `regles` fournit `delai_relance_heures`.
- `checkConstraints(plan, regles, etudiant, catalogue)` : `catalogue` fournit les cours obligatoires.
- Pour une relance, on suppose que `request.precedente_expiree_le` est rempli par le store à partir de la demande expirée précédente.

## Lien avec nos observations

| Obs. | Ce que le système fait | Logique | Écran |
|---|---|---|---|
| 1 | Règles en lecture seule, cible dans les bornes | `computeCreditTarget`, `validateProfile` | Profil |
| 3 | Charge intenable expliquée avant l'engagement | `validateProfile`, `checkConstraints` (`CHARGE_HEBDO`) | Profil, Plan |
| 4 | Historique des demandes conservé | `handleExpiration` : statut `expiree`, jamais supprimée | Demandes (à venir) |
| 5 | Statut « reporté » et mise en garde | `canSubmitRequest` ne compte pas les demandes reportées | Demandes (à venir) |
| 6 | Alertes limitées aux activités suivies | `filterAlerts` | Catalogue (à venir) |
| 7 | Chevauchements d'horaire | `detectOverlaps` | Plan |
| 8 | Délai propre à chaque encadrant, relance | `handleExpiration`, `canSubmitRequest` | Demandes (à venir) |
| — | Cours non reconnus par le DIRO | `checkConstraints` (`NON_RECONNU_DIRO`) | Plan |
| — | Étudiant d'échange (12 à 15 crédits, approbation du plan) | `computeCreditTarget`, `validateProfile`, `checkConstraints` (`ECHANGE_APPROBATION`) | Profil, Plan |

## Données fictives ou à valider

- Les 15 règles de `program_rules.json`.
- Dans `src/data/activities.json` : les préalables, les horaires et les charges hebdomadaires sont des valeurs de démo. Les résumés de cours ne sont pas encore écrits.
- `HORS-001` est un cours fictif, non reconnu par le DIRO, qui sert à tester cette règle.
- À venir : des activités et encadrants fictifs, et des échéances « à valider sur le calendrier du registraire ».

## Lien des tableaux
https://app.diagrams.net/#G18kRolLRTgmN4VMNjbJK3OTy0zO4rFrtF#%7B%22pageId%22%3A%229Rir4zVyAO7QaP5zqvP0%22%7D

