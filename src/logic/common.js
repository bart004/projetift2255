// Socle commun de la logique métier : fonctions pures, sans DOM ni localStorage.
// Chaque contrôle retourne { ok, niveau, etat, code, message, raison } (+ champs utiles).
// `ok` = « la suite n'est pas bloquée » : un avertissement ne bloque pas, une règle dure oui.

/** @typedef {{ok: boolean, niveau: 'ok'|'avertissement'|'bloquant', etat: 'vert'|'orange'|'rouge', code: string, message: string, raison: string}} Resultat */

const ETATS = { ok: 'vert', avertissement: 'orange', bloquant: 'rouge' };

const creer = (niveau) => (code, message, raison = '', extra = {}) => ({
  ok: niveau !== 'bloquant',
  niveau,
  etat: ETATS[niveau],
  code,
  message,
  raison,
  ...extra,
});

export const valide = creer('ok');
export const avertissement = creer('avertissement');
export const bloquant = creer('bloquant');

export const STATUTS = ['regulier', 'echange'];
export const MENTION_ECHANGE = `Plan à faire approuver par le responsable des échanges du département.`;

/** Lignes de program_rules.json -> { cle: valeur }. */
export const rulesToMap = (rows) => Object.fromEntries(rows.map(({ cle, valeur }) => [cle, valeur]));

export const somme = (xs) => xs.reduce((a, b) => a + b, 0);

/** Bornes de crédits [min, max] du statut. */
export const bornesCredits = (statut, r) =>
  statut === 'echange'
    ? [r.credits_min_echange, r.credits_max_echange]
    : [r.credits_min_regulier, r.credits_max_regulier];

/** Résultat bloquant si le statut ou le cumul est invalide, sinon null. */
export const erreurEntrees = (statut, cumul, r) => {
  if (!STATUTS.includes(statut)) {
    return bloquant('STATUT_INVALIDE', 'Statut inconnu.', `Statuts permis : ${STATUTS.join(', ')}.`);
  }
  if (!Number.isInteger(cumul) || cumul < 0 || cumul > r.credits_total_diplome) {
    return bloquant('CUMUL_INCOHERENT', 'Crédits cumulés incohérents.',
      `Le cumul doit être un entier entre 0 et ${r.credits_total_diplome}.`);
  }
  return null;
};

/** Ex. « 6 cours × 3 h = 18 h de cours par semaine ». */
export const phraseCharge = (credits, heuresParCredit) => {
  const h = credits.map((c) => c * heuresParCredit);
  return h.length > 1 && h.every((x) => x === h[0])
    ? `${h.length} cours × ${h[0]} h = ${somme(h)} h de cours par semaine`
    : `${somme(h)} h de cours par semaine`;
};
