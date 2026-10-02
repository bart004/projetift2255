import { valide, bloquant } from './common.js';

/**
 * Obs. 6 — ne garde que les alertes sur les activités suivies.
 * Le catalogue conserve l'information sur toutes les activités ; seules les alertes sont filtrées.
 * @param {{id: string, activite_id: string}[]} notifications
 * @param {string[]} followedActivities identifiants des activités suivies
 */
export function filterAlerts(notifications, followedActivities) {
  if (!Array.isArray(notifications) || !Array.isArray(followedActivities)) {
    return bloquant('ENTREE_INVALIDE', 'Filtrage impossible.', 'Deux listes sont attendues.', { alertes: [], masquees: 0 });
  }
  const suivies = new Set(followedActivities);
  const alertes = notifications.filter((n) => suivies.has(n.activite_id));
  const masquees = notifications.length - alertes.length;
  return valide('ALERTES_FILTREES', `${alertes.length} alerte(s) sur vos activités suivies.`,
    masquees ? `${masquees} alerte(s) masquée(s) : activité non suivie. L'information reste dans le catalogue.` : '',
    { alertes, masquees });
}
