# Planification des études — DIRO (prototype)

## À quoi sert le projet

Outil d'aide à la décision pour les étudiants du baccalauréat en informatique (DIRO, UdeM), y compris les étudiants d'échange. Il rassemble l'offre éclatée (cours, projets supervisés, stages, séminaires), rend visibles les contraintes du programme avant la décision (crédits, temps plein, charge hebdomadaire, préalables, chevauchements d'horaire) et aide à suivre ses démarches dans le temps.

**Il ne remplace ni le conseil académique ni l'inscription officielle (registrariat).**

Ce projet part du prototype *Mon cheminement*, que nous avons d'abord manipulé et critiqué, puis dépassé en concevant notre propre système.

### Objectifs

- **O1** Rassembler l'offre : cours, projets supervisés, stages, séminaires.
- **O2** Relier l'offre à la personne : profil, statut, intérêts.
- **O3** Rendre les contraintes visibles avant la décision.
- **O4** Tenir compte du temps : demandes, délais, dates limites.
- **O5** Dépasser la session en cours : projection sur plusieurs trimestres.
- **O6** Réduire la dépendance à la connaissance tacite : indicateurs vérifiables.

## État d'avancement

### Ce qui fonctionne

- Règles de programme (`src/data/program_rules.json`) et logique métier pure, couverte par des tests (Vitest).
- Écran **Profil** : règles affichées avec leur explication, cible de crédits dans les bornes autorisées, validation de la cohérence des paramètres.
- Écran **Plan** : catalogue, ajout d'activités avec détection des chevauchements, panneau de contraintes (vert, orange, rouge, toujours avec texte et icône).
- Sélecteurs de rôle et d'étudiant.
- État conservé dans `localStorage`.

### Ce qui est simulé

- Les données : 16 cours réels, 1 cours fictif (`HORS-001`, non reconnu par le DIRO, pour tester cette règle) et 3 étudiants de démonstration.
- Les préalables, horaires et charges hebdomadaires des cours (7 h par cours, 9 h pour le projet) sont des valeurs de démo, à valider.
- Les 15 règles de programme sont marquées « à valider » : aucune n'est encore confirmée par une source UdeM.
- Le rôle choisi par le sélecteur : il n'y a pas d'authentification réelle.
- La persistance : `localStorage` remplace pour l'instant Supabase.

### Ce qui reste à faire

Dans cet ordre : filtres et score de pertinence, grille horaire, demandes, projection sur plusieurs trimestres, informations d'appoint, vues des autres rôles, activités et encadrants fictifs, échéances et date simulée, `supabase/schema.sql` et `seed.sql`, page « À propos des limites », checklist d'accessibilité.

## Installation et lancement

Juste lancer le document html ou sinon :

Prérequis : Node 22.12 ou plus (la logique utilise `Object.groupBy`) et un navigateur récent (Safari 17.4+, Chrome 117+, Firefox 119+).

```
npm install
npm test       # logique pure, Vitest
npm run dev    # serveur de développement (Vite)
npm run build  # génère dist/planification.html : un seul fichier, ouvrable par double-clic
```

Le fichier généré est produit à partir de `src/` : on ne le modifie pas à la main. Aucune dépendance d'exécution : Vite et Vitest sont des dépendances de développement.

## Équipe et répartition du travail

Le projet a été réalisé par une équipe de trois personnes :

| Membre | Rôle et contributions |
|---|---|
| Artur BARTHE | Correction des différentes version du rapport, et création du prototype |
| Benjamin MARTEL | Création des modélisation A1, A2, A3 et aide dans la création du prototype |
| frederyke Robitaille | différente aide |

Travail réalisé en commun : analyse et critique du prototype *Mon cheminement*, rédaction du rapport, définition des exigences.

## Où sont les règles

`src/data/program_rules.json` : une ligne par règle (`cle`, `valeur`, `explication`, `a_valider`). Équivalent SQL à venir dans `supabase/seed.sql`.

**Les 15 valeurs sont marquées « à valider »** : aucune n'est confirmée par une source UdeM. Passer `a_valider` à `false` seulement après vérification.

## Contrat de la logique (`src/logic/`)

Chaque contrôle retourne `{ ok, niveau, etat, code, message, raison }`, plus des champs utiles (`cible`, `demande`, `compteur`, `alertes`, `paire`).

- `niveau` : `ok`, `avertissement` ou `bloquant`.
- `etat` : `vert`, `orange` ou `rouge` (jamais la couleur seule à l'écran : toujours le texte et une icône).
- `ok` : la suite n'est pas bloquée. Un avertissement ne bloque pas, une règle dure oui.
- Une fonction qui peut détecter plusieurs problèmes retourne une liste (`validateProfile`, `detectOverlaps`, `checkConstraints`).

Écarts par rapport aux signatures du cahier des charges :
- `handleExpiration(request, supervisor, now, regles)` : `regles` fournit `delai_relance_heures`.
- `checkConstraints(plan, regles, etudiant, catalogue)` : `catalogue` fournit les cours obligatoires.
- La relance suppose `request.precedente_expiree_le`, rempli par le store à partir de la demande expirée précédente.

## Traçabilité


| Obs. | Comportement | Logique | Écran |
|---|---|---|---|
| 1 | Règles en lecture seule, cible dans les bornes | `computeCreditTarget`, `validateProfile` | Profil |
| 3 | Charge intenable expliquée avant l'engagement | `validateProfile`, `checkConstraints` (`CHARGE_HEBDO`) | Profil, Plan |
| 4 | Historique persistant des demandes | `handleExpiration` : statut `expiree`, jamais supprimée | Demandes (à venir) |
| 5 | Statut « reporté » et mise en garde | `canSubmitRequest` ne compte pas les demandes reportées | Demandes (à venir) |
| 6 | Alertes limitées aux activités suivies | `filterAlerts` | Catalogue (à venir) |
| 7 | Chevauchements d'horaire | `detectOverlaps` | Plan |
| 8 | Délai par encadrant, relance | `handleExpiration`, `canSubmitRequest` | Demandes (à venir) |
| — | Cours non reconnus par le DIRO | `checkConstraints` (`NON_RECONNU_DIRO`) | Plan |
| — | Étudiant d'échange (12 à 15 crédits, approbation du plan) | `computeCreditTarget`, `validateProfile`, `checkConstraints` (`ECHANGE_APPROBATION`) | Profil, Plan |

## Données fictives ou à valider

- Les 15 règles de `program_rules.json` : à valider.
- Dans `src/data/activities.json` : les préalables, les horaires et les charges hebdomadaires sont des valeurs de démo, à valider. Les résumés de cours ne sont pas encore écrits.
- `HORS-001` est un cours fictif, non reconnu par le DIRO, qui sert à tester cette règle.
- À venir : activités et encadrants fictifs, échéances « à valider sur le calendrier du registraire ».
