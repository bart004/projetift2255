import { describe, it, expect } from 'vitest';
import rows from '../data/program_rules.json';
import { rulesToMap } from './common.js';
import { computeCreditTarget, validateProfile } from './profile.js';

const R = rulesToMap(rows);
const codes = (rs) => rs.map((r) => r.code);

describe('validateProfile (obs. 1 et 3)', () => {
  it('nominal : profil cohérent', () => {
    const rs = validateProfile({ statut: 'regulier', credits_cumules: 15, cible_credits: 15 }, R);
    expect(codes(rs)).toEqual(['PROFIL_VALIDE']);
    expect(rs.every((r) => r.ok)).toBe(true);
  });

  it('limite : 6 cours × 3 h = 18 h avertit sans bloquer', () => {
    const [r, ...reste] = validateProfile({ statut: 'regulier', credits_cumules: 15, cible_credits: 18 }, R);
    expect(reste).toHaveLength(0);
    expect(r).toMatchObject({ code: 'CHARGE_COURS_ELEVEE', niveau: 'avertissement', etat: 'orange', ok: true });
    expect(r.raison).toBe('6 cours × 3 h = 18 h de cours par semaine, ce qui dépasse déjà votre plafond de 15 h.');
  });

  it('limite : échange, 15 crédits passent et 16 sont bloqués (bornes strictes)', () => {
    const echange = (cible) => validateProfile({ statut: 'echange', credits_cumules: 24, cible_credits: cible }, R);
    expect(echange(15).every((r) => r.ok)).toBe(true);
    const rs = echange(16);
    expect(rs[0]).toMatchObject({ code: 'CIBLE_HORS_BORNES', niveau: 'bloquant', ok: false });
    expect(rs.every((r) => r.ok)).toBe(false);
  });

  it('limite : la cible ne dépasse pas les crédits restants', () => {
    const rs = validateProfile({ statut: 'regulier', credits_cumules: 87, cible_credits: 12 }, R);
    expect(rs[0].code).toBe('CIBLE_HORS_BORNES');
    expect(rs[0].raison).toContain('Il ne reste que 3 crédits');
  });

  it('erreur : statut inconnu, cumul incohérent, paramètres absents', () => {
    expect(codes(validateProfile({ statut: 'visiteur', credits_cumules: 0, cible_credits: 12 }, R))).toEqual(['STATUT_INVALIDE']);
    expect(codes(validateProfile({ statut: 'regulier', credits_cumules: 91, cible_credits: 12 }, R))).toEqual(['CUMUL_INCOHERENT']);
    expect(codes(validateProfile({ statut: 'regulier', credits_cumules: -5, cible_credits: 12 }, R))).toEqual(['CUMUL_INCOHERENT']);
    expect(validateProfile(undefined, R)[0].ok).toBe(false);
  });
});

describe('computeCreditTarget (obs. 1)', () => {
  it('nominal : début de parcours régulier -> 15', () => {
    expect(computeCreditTarget(15, 'regulier', R)).toMatchObject({ code: 'CIBLE_PAR_DEFAUT', cible: 15, ok: true });
  });

  it('limite : échange borné à 15, fin de parcours limitée aux crédits restants', () => {
    expect(computeCreditTarget(24, 'echange', R).cible).toBe(15);
    expect(computeCreditTarget(60, 'regulier', R).cible).toBe(15);
    expect(computeCreditTarget(80, 'regulier', R))
      .toMatchObject({ code: 'CIBLE_SOUS_SEUIL', cible: 10, niveau: 'avertissement', ok: true });
    expect(computeCreditTarget(90, 'regulier', R).cible).toBe(0);
  });

  it('erreur : statut inconnu ou cumul impossible -> bloquant, sans cible', () => {
    expect(computeCreditTarget(10, 'inconnu', R)).toMatchObject({ code: 'STATUT_INVALIDE', ok: false, cible: null });
    expect(computeCreditTarget(95, 'regulier', R)).toMatchObject({ code: 'CUMUL_INCOHERENT', ok: false, cible: null });
    expect(computeCreditTarget(1.5, 'regulier', R).ok).toBe(false);
  });
});
