import { describe, it, expect } from 'vitest';
import { filterAlerts } from './alerts.js';

const notifs = [
  { id: 'n1', activite_id: 'act1', message: 'Place libérée' },
  { id: 'n2', activite_id: 'act2', message: 'Ouverture le 12 octobre' },
  { id: 'n3', activite_id: 'act3', message: 'Date limite' },
];

describe('filterAlerts (obs. 6)', () => {
  it('nominal : ne garde que les alertes des activités suivies', () => {
    const r = filterAlerts(notifs, ['act1', 'act3']);
    expect(r.alertes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(r).toMatchObject({ ok: true, masquees: 1 });
  });

  it('limite : rien de suivi -> aucune alerte ; aucune notification -> rien de masqué', () => {
    const r = filterAlerts(notifs, []);
    expect(r.alertes).toEqual([]);
    expect(r.masquees).toBe(3);
    expect(filterAlerts([], ['act1']).masquees).toBe(0);
  });

  it('erreur : entrées invalides -> bloquant', () => {
    expect(filterAlerts(null, [])).toMatchObject({ ok: false, niveau: 'bloquant', alertes: [] });
    expect(filterAlerts(notifs, undefined).ok).toBe(false);
  });
});
