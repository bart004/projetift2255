import { valide, avertissement, bloquant, bornesCredits, erreurEntrees, phraseCharge } from './common.js';

/**
 * Obs. 1 et 3 — valide le profil avant « Continuer ».
 * @returns {import('./common.js').Resultat[]} `.every((r) => r.ok)` autorise la suite.
 */
export function validateProfile(params, regles) {
  const { statut, credits_cumules: cumul, cible_credits: cible } = params ?? {};
  const erreur = erreurEntrees(statut, cumul, regles);
  if (erreur) return [erreur];

  const resultats = [];
  const restants = regles.credits_total_diplome - cumul;
  const [bMin, bMax] = bornesCredits(statut, regles);
  const [min, max] = [bMin, bMax].map((b) => Math.min(b, restants));

  if (!Number.isInteger(cible) || cible < min || cible > max) {
    const limite = restants < bMax ? ` Il ne reste que ${restants} crédits à compléter.` : '';
    resultats.push(bloquant('CIBLE_HORS_BORNES',
      `Une cible de ${cible} crédits est hors des bornes permises (${min} à ${max}).`,
      `Bornes du statut ${statut}.${limite}`));
  }
  if (Number.isInteger(cible) && cible * regles.heures_par_credit_semaine > regles.plafond_heures_cours_semaine) {
    const parCours = regles.credits_par_cours_typique;
    const credits = cible % parCours === 0 ? Array(cible / parCours).fill(parCours) : [cible];
    resultats.push(avertissement('CHARGE_COURS_ELEVEE', 'Charge de cours élevée.',
      `${phraseCharge(credits, regles.heures_par_credit_semaine)}, ce qui dépasse déjà votre plafond de ${regles.plafond_heures_cours_semaine} h.`));
  }
  return resultats.length ? resultats : [valide('PROFIL_VALIDE', 'Profil cohérent.')];
}

/**
 * Obs. 1 — cible par défaut : plafond d'heures de cours, bornée par le statut
 * et jamais au-delà des crédits restants.
 * @returns {import('./common.js').Resultat & {cible: number|null}}
 */
export function computeCreditTarget(cumul, statut, regles) {
  const erreur = erreurEntrees(statut, cumul, regles);
  if (erreur) return { ...erreur, cible: null };

  const restants = regles.credits_total_diplome - cumul;
  const [min, max] = bornesCredits(statut, regles);
  const souhaitee = Math.floor(regles.plafond_heures_cours_semaine / regles.heures_par_credit_semaine);
  const cible = Math.min(Math.max(souhaitee, min), max, restants);

  if (cible < min) {
    return avertissement('CIBLE_SOUS_SEUIL', `Cible de ${cible} crédits : il ne reste que ${restants} crédits.`,
      `Sous le minimum de ${min} crédits, mais la cible ne dépasse jamais les crédits restants.`, { cible });
  }
  return valide('CIBLE_PAR_DEFAUT', `Cible par défaut : ${cible} crédits.`,
    `Plafond de ${souhaitee} crédits selon les heures de cours, borné à ${min}–${max} crédits et à ${restants} crédits restants.`, { cible });
}
