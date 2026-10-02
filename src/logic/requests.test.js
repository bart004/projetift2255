import { describe, it, expect } from 'vitest';
import rows from '../data/program_rules.json';
import { rulesToMap } from './common.js';
import { canSubmitRequest, handleExpiration } from './requests.js';

const R = rulesToMap(rows);
const enc = (delai = 72) => ({ id: 'enc1', delai_annonce_heures: delai });
const dem = (extra = {}) => ({
  id: 'd1', etudiant_id: 'A', activite_id: 'x', statut: 'en_attente', date_soumission: '2026-09-28T09:00:00Z', ...extra,
});

describe('handleExpiration (obs. 4 et 8)', () => {
  it("nominal : au-delà du délai de l'encadrant, la demande expire et reste dans l'historique", () => {
    const r = handleExpiration(dem(), enc(72), '2026-10-02T09:00:00Z', R);
    expect(r).toMatchObject({ code: 'DEMANDE_EXPIREE', niveau: 'avertissement', ok: true });
    expect(r.demande).toMatchObject({ statut: 'expiree', date_expiration: '2026-10-01T09:00:00.000Z' });
  });

  it('délai propre à chaque encadrant : avec 120 h, la même demande est toujours en attente', () => {
    const r = handleExpiration(dem(), enc(120), '2026-10-02T09:00:00Z', R);
    expect(r.code).toBe('EN_ATTENTE');
    expect(r.message).toBe('En attente : 24 h avant expiration.');
  });

  it("limite : expire pile à l'échéance ; une demande déjà traitée ne bouge pas", () => {
    expect(handleExpiration(dem(), enc(72), '2026-10-01T09:00:00Z', R).demande.statut).toBe('expiree');
    const r = handleExpiration(dem({ statut: 'refusee' }), enc(72), '2026-12-01T00:00:00Z', R);
    expect(r).toMatchObject({ code: 'DEJA_TRAITEE', demande: { statut: 'refusee' } });
  });

  it('relance : redemande dans les 48 h suivant une expiration, pas au-delà', () => {
    const relance = (precedente) => handleExpiration(
      dem({ date_soumission: '2026-10-01T09:00:00Z', precedente_expiree_le: precedente }),
      enc(72), '2026-10-01T10:00:00Z', R,
    ).demande.is_relance;
    expect(relance('2026-09-30T09:00:00Z')).toBe(true); // 24 h
    expect(relance('2026-09-29T09:00:00Z')).toBe(true); // 48 h pile
    expect(relance('2026-09-29T08:00:00Z')).toBe(false); // 49 h
    expect(relance(undefined)).toBe(false);
  });

  it('erreur : délai, dates ou règle invalides -> bloquant', () => {
    expect(handleExpiration(dem(), enc(0), '2026-10-02T09:00:00Z', R)).toMatchObject({ code: 'DONNEES_INVALIDES', ok: false });
    expect(handleExpiration(dem({ date_soumission: 'hier' }), enc(), '2026-10-02T09:00:00Z', R).ok).toBe(false);
    expect(handleExpiration(null, enc(), 'maintenant', R).ok).toBe(false);
    expect(handleExpiration(dem(), enc(), '2026-10-02T09:00:00Z', {}).ok).toBe(false);
  });
});

describe('canSubmitRequest (obs. 8)', () => {
  const etu = { id: 'A' };
  const req = (id, statut, extra = {}) => ({ id, etudiant_id: 'A', statut, ...extra });

  it('nominal : 2 demandes en attente sur 3 -> permis', () => {
    const r = canSubmitRequest(etu, [req(1, 'en_attente'), req(2, 'en_attente')], R);
    expect(r).toMatchObject({ ok: true, compteur: { n: 2, plafond: 3 } });
  });

  it("limite : une relance compte ; expirées, refusées et demandes d'autres étudiants ne comptent pas", () => {
    const base = [req(1, 'expiree'), req(2, 'refusee'), { ...req(3, 'en_attente'), etudiant_id: 'B' }];
    expect(canSubmitRequest(etu, [...base, req(4, 'en_attente'), req(5, 'en_attente')], R).ok).toBe(true);
    const r = canSubmitRequest(etu, [...base, req(4, 'en_attente'), req(5, 'en_attente'), req(6, 'en_attente', { is_relance: true })], R);
    expect(r).toMatchObject({ code: 'PLAFOND_ATTEINT', ok: false, compteur: { n: 3, plafond: 3 } });
  });

  it('erreur : étudiant ou liste manquants -> bloquant', () => {
    expect(canSubmitRequest(null, [], R).ok).toBe(false);
    expect(canSubmitRequest(etu, undefined, R).ok).toBe(false);
  });
});
