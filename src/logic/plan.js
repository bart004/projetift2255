import {
  valide, avertissement, bloquant, MENTION_ECHANGE,
  bornesCredits, erreurEntrees, phraseCharge, somme,
} from './common.js';

const heureValide = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
const enMinutes = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const creneauValide = (c) => heureValide(c.debut) && heureValide(c.fin) && enMinutes(c.debut) < enMinutes(c.fin);
const croisent = (a, b) => a.jour === b.jour && enMinutes(a.debut) < enMinutes(b.fin) && enMinutes(b.debut) < enMinutes(a.fin);
const enConflit = (a, b) => a.horaire.some((x) => b.horaire.some((y) => croisent(x, y)));

/**
 * Obs. 7 — conflits d'horaire.
 * Deux cours : bloquant (ajout refusé). Activité sans horaire fixe, ou conflit impliquant
 * une activité qui n'est pas un cours : signalé seulement.
 * Un plan item : { id, sigle, type, horaire: [{ jour, debut: 'HH:MM', fin: 'HH:MM' }] | null }
 */
export function detectOverlaps(planItems) {
  if (!Array.isArray(planItems)) {
    return [bloquant('ENTREE_INVALIDE', 'Plan invalide.', `Une liste d'activités est attendue.`)];
  }
  const resultats = [];
  const fixes = [];
  for (const i of planItems) {
    if (!i.horaire?.length) {
      resultats.push(avertissement('SANS_HORAIRE_FIXE', `${i.sigle} n'a pas d'horaire fixe.`,
        `Un chevauchement ne peut pas être vérifié : à confirmer avec l'encadrant.`, { paire: [i.id] }));
    } else if (!i.horaire.every(creneauValide)) {
      resultats.push(bloquant('HORAIRE_INVALIDE', `L'horaire de ${i.sigle} est invalide.`,
        'Format attendu : jour, début et fin en HH:MM, avec le début avant la fin.', { paire: [i.id] }));
    } else {
      fixes.push(i);
    }
  }
  fixes.forEach((a, idx) => fixes.slice(idx + 1).filter((b) => enConflit(a, b)).forEach((b) => {
    const dur = a.type === 'cours' && b.type === 'cours';
    resultats.push((dur ? bloquant : avertissement)('CHEVAUCHEMENT', `${a.sigle} et ${b.sigle} se chevauchent.`,
      dur ? 'Deux cours ne peuvent pas avoir lieu en même temps : ajout bloqué.'
        : `Au moins une des deux activités n'est pas un cours : signalé seulement.`,
      { paire: [a.id, b.id] }));
  }));
  return resultats;
}

const verdict = (niveau, code, problemes, ko, bon, raison) =>
  problemes.length ? niveau(code, ko(problemes.join(' ; ')), raison) : valide(code, bon);

/**
 * Obs. 1, 3 et règles ajoutées (cours non reconnus, étudiant d'échange) — état de chaque contrainte.
 * plan : activités du trimestre { id, sigle, type, credits, bloc, obligatoire, reconnu_diro, prerequis, charge_hebdo_h }
 * etudiant : { statut, credits_cumules, reussis: [sigles] }
 * catalogue : toutes les activités (sert à repérer les cours obligatoires restants).
 * @returns {import('./common.js').Resultat[]}
 */
export function checkConstraints(plan, regles, etudiant, catalogue = []) {
  const erreur = Array.isArray(plan)
    ? erreurEntrees(etudiant?.statut, etudiant?.credits_cumules, regles)
    : bloquant('ENTREE_INVALIDE', 'Plan invalide.', `Une liste d'activités est attendue.`);
  if (erreur) return [erreur];

  const { statut, credits_cumules: cumul } = etudiant;
  const reussis = new Set(etudiant.reussis ?? []);
  const planifies = new Set(plan.map((i) => i.sigle));
  const cours = plan.filter((i) => i.type === 'cours');
  const total = somme(plan.map((i) => i.credits));
  const restants = regles.credits_total_diplome - cumul;
  const [bMin, bMax] = bornesCredits(statut, regles);
  const [min, max] = [bMin, bMax].map((b) => Math.min(b, restants));
  const strict = statut === 'echange';
  const r = [];

  // Obs. 1 — crédits vs fourchette du statut
  if (total > max) {
    r.push(bloquant('CREDITS_FOURCHETTE', `${total} crédits au plan : au-dessus du maximum de ${max}.`,
      `Bornes du statut ${statut} : ${min} à ${max} crédits.`));
  } else if (total < min) {
    r.push((strict ? bloquant : avertissement)('CREDITS_FOURCHETTE', `${total} crédits au plan : sous le minimum de ${min}.`,
      strict ? `Limite stricte pour un étudiant d'échange : ${min} à ${max} crédits.` : 'Plan incomplet : ajoutez des activités.'));
  } else {
    r.push(valide('CREDITS_FOURCHETTE', `${total} crédits au plan, dans les bornes (${min} à ${max}).`));
  }

  // Obs. 1 — seuil de temps plein
  r.push(total >= bMin
    ? valide('TEMPS_PLEIN', `Temps plein atteint (${total} crédits, seuil de ${bMin}).`)
    : avertissement('TEMPS_PLEIN', `${total} crédits au plan : sous le seuil de temps plein (${bMin}).`,
      total >= restants
        ? `Il ne reste que ${restants} crédits à compléter.`
        : 'Impact possible sur les prêts et bourses : à valider auprès du registrariat.'));

  // Obs. 3 — charge hebdomadaire expliquée avant l'engagement
  const hpc = regles.heures_par_credit_semaine;
  const hCours = somme(cours.map((c) => c.credits * hpc));
  const hTotal = somme(plan.map((i) => i.charge_hebdo_h ?? 0));
  const surcharges = [];
  if (hCours > regles.plafond_heures_cours_semaine) {
    surcharges.push(`${phraseCharge(cours.map((c) => c.credits), hpc)}, ce qui dépasse déjà votre plafond de ${regles.plafond_heures_cours_semaine} h`);
  }
  if (hTotal > regles.plafond_charge_totale_semaine) {
    surcharges.push(`charge totale estimée de ${hTotal} h par semaine, au-dessus du plafond de ${regles.plafond_charge_totale_semaine} h`);
  }
  r.push(surcharges.length
    ? avertissement('CHARGE_HEBDO', 'Charge hebdomadaire élevée.', `${surcharges.join(' ; ')}.`)
    : valide('CHARGE_HEBDO', `Charge estimée : ${hCours} h de cours, ${hTotal} h au total par semaine.`));

  // Préalables (données de démo à valider)
  const manquants = plan
    .map((i) => [i, (i.prerequis ?? []).filter((p) => !reussis.has(p))])
    .filter(([, m]) => m.length)
    .map(([i, m]) => `${i.sigle} (${m.join(', ')})`);
  r.push(verdict(bloquant, 'PREREQUIS', manquants, (l) => `Préalables manquants : ${l}.`,
    'Tous les préalables sont satisfaits.', 'Préalables de démo : à valider dans le répertoire officiel des cours.'));

  // Blocs obligatoires et cours requis pour le diplôme
  const aPlanifier = catalogue.filter((a) => a.type === 'cours' && a.obligatoire && a.reconnu_diro !== false
    && !reussis.has(a.sigle) && !planifies.has(a.sigle));
  const parBloc = Object.entries(Object.groupBy(aPlanifier.filter((a) => a.bloc), (a) => a.bloc))
    .map(([bloc, acts]) => `${bloc} : ${acts.map((a) => a.sigle).join(', ')}`);
  r.push(verdict(avertissement, 'BLOCS_OBLIGATOIRES', parBloc, (l) => `Cours obligatoires à planifier — ${l}.`,
    'Les blocs obligatoires sont couverts.', 'Avertissement seulement : ces cours peuvent venir dans un trimestre ultérieur.'));
  r.push(verdict(avertissement, 'COURS_REQUIS_DIPLOME', aPlanifier.filter((a) => !a.bloc).map((a) => a.sigle),
    (l) => `Cours requis pour le diplôme à planifier : ${l}.`, 'Les cours requis pour le diplôme sont couverts.',
    'Catalogue de démo partiel : la liste officielle du programme fait foi.'));

  // Règle ajoutée — cours non reconnus par le DIRO
  r.push(verdict(avertissement, 'NON_RECONNU_DIRO',
    plan.filter((i) => i.reconnu_diro === false).map((i) => `${i.sigle} (${i.credits} crédits)`),
    (l) => `${l} : ne compte pas pour le diplôme.`, 'Toutes les activités comptent pour le diplôme.',
    'Activité non reconnue par le DIRO.'));

  // Quotas de projets et de séminaires (valeurs de démo)
  [['projet', 'QUOTA_PROJETS', 'quota_projets', 'projets supervisés'],
    ['seminaire', 'QUOTA_SEMINAIRES', 'quota_seminaires', 'séminaires']].forEach(([type, code, cle, nom]) => {
    const n = plan.filter((i) => i.type === type).length;
    r.push(n > regles[cle]
      ? bloquant(code, `${n} ${nom} au plan : maximum ${regles[cle]} par trimestre.`, 'Quota de démo : à valider.')
      : valide(code, `${n} / ${regles[cle]} ${nom}.`));
  });

  // Règle ajoutée — étudiant d'échange
  if (strict) {
    r.push(avertissement('ECHANGE_APPROBATION', MENTION_ECHANGE, `Limite stricte de ${bMin} à ${bMax} crédits par trimestre.`));
  }
  return r;
}
