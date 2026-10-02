import { valide, avertissement, bloquant } from './common.js';

const heuresEntre = (debut, fin) => (new Date(fin) - new Date(debut)) / 36e5;
const dateValide = (d) => d != null && !Number.isNaN(new Date(d).getTime());

/**
 * Obs. 4 et 8 — évalue une demande à l'instant `now` ; ne mute rien (la demande à jour est dans `demande`).
 * - Expiration selon le délai propre à l'encadrant (`delai_annonce_heures`) ; la demande passe à « expiree »,
 *   elle n'est jamais supprimée.
 * - `precedente_expiree_le` : date d'expiration d'une demande antérieure pour la même activité (fournie par le store).
 *   Une redemande dans `delai_relance_heures` est marquée `is_relance` : visible par l'encadrant, comptée dans le plafond.
 */
export function handleExpiration(request, supervisor, now, regles) {
  const delai = supervisor?.delai_annonce_heures;
  if (!dateValide(request?.date_soumission) || !dateValide(now) || !(delai > 0)
    || !Number.isFinite(regles?.delai_relance_heures)) {
    return bloquant('DONNEES_INVALIDES', `Impossible d'évaluer la demande.`,
      `Date de soumission, date courante, délai de l'encadrant ou règle de relance invalide.`, { demande: request ?? null });
  }
  const echeance = new Date(new Date(request.date_soumission).getTime() + delai * 36e5);
  const ecart = dateValide(request.precedente_expiree_le)
    ? heuresEntre(request.precedente_expiree_le, request.date_soumission) : null;
  const is_relance = ecart !== null && ecart >= 0 && ecart <= regles.delai_relance_heures;
  const demande = { ...request, is_relance, date_echeance: echeance.toISOString() };
  const suite = is_relance
    ? ` Relance : redemande dans les ${regles.delai_relance_heures} h suivant une expiration.` : '';

  if (request.statut !== 'en_attente') {
    return valide('DEJA_TRAITEE', 'Demande déjà traitée : aucune action.', suite.trim(), { demande });
  }
  if (new Date(now) >= echeance) {
    return avertissement('DEMANDE_EXPIREE', 'Demande expirée.',
      `Pas de réponse dans le délai de ${delai} h de l'encadrant. Elle reste dans l'historique.${suite}`,
      { demande: { ...demande, statut: 'expiree', date_expiration: echeance.toISOString() } });
  }
  return valide('EN_ATTENTE', `En attente : ${Math.ceil(heuresEntre(now, echeance))} h avant expiration.`,
    suite.trim(), { demande });
}

/**
 * Obs. 8 — plafond de demandes simultanées. Une relance est une demande en attente comme une autre : elle compte.
 * Les demandes expirées, refusées, acceptées ou reportées ne comptent pas.
 */
export function canSubmitRequest(student, requests, regles) {
  if (!student?.id || !Array.isArray(requests)) {
    return bloquant('ENTREE_INVALIDE', 'Vérification impossible.', 'Un étudiant et une liste de demandes sont attendus.');
  }
  const n = requests.filter((r) => r.etudiant_id === student.id && r.statut === 'en_attente').length;
  const compteur = { n, plafond: regles.plafond_demandes_simultanees };
  return n >= compteur.plafond
    ? bloquant('PLAFOND_ATTEINT', `${n} / ${compteur.plafond} demandes en attente : plafond atteint.`,
      `Attendez une réponse ou l'expiration d'une demande avant d'en soumettre une autre. Une relance occupe aussi une place.`, { compteur })
    : valide('SOUMISSION_PERMISE', `${n} / ${compteur.plafond} demandes en attente.`, '', { compteur });
}
