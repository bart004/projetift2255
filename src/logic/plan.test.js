import { describe, it, expect } from 'vitest';
import rows from '../data/program_rules.json';
import { MENTION_ECHANGE, rulesToMap } from './common.js';
import { checkConstraints, detectOverlaps } from './plan.js';

const R = rulesToMap(rows);
const item = (id, sigle, extra = {}) => ({
  id, sigle, type: 'cours', credits: 3, horaire: null, bloc: null, obligatoire: false,
  reconnu_diro: true, prerequis: [], charge_hebdo_h: 7, ...extra,
});
const lun = (debut, fin) => [{ jour: 'lun', debut, fin }];
const un = (rs, code) => rs.find((r) => r.code === code);

describe('detectOverlaps (obs. 7)', () => {
  it('nominal : deux cours qui se chevauchent sont bloquants', () => {
    const rs = detectOverlaps([
      item('a', 'IFT 1015', { horaire: lun('09:00', '12:00') }),
      item('b', 'IFT 1065', { horaire: lun('11:00', '14:00') }),
    ]);
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ code: 'CHEVAUCHEMENT', niveau: 'bloquant', ok: false, paire: ['a', 'b'] });
  });

  it('limite : cours consécutifs sans conflit ; projet sans horaire fixe signalé seulement', () => {
    const rs = detectOverlaps([
      item('a', 'IFT 1015', { horaire: lun('09:00', '12:00') }),
      item('b', 'IFT 1065', { horaire: lun('12:00', '15:00') }),
      item('p', 'Projet ML', { type: 'projet' }),
    ]);
    expect(rs.map((r) => r.code)).toEqual(['SANS_HORAIRE_FIXE']);
    expect(rs[0]).toMatchObject({ niveau: 'avertissement', ok: true });
  });

  it('limite : un projet à horaire fixe qui chevauche un cours est signalé, pas bloquant', () => {
    const rs = detectOverlaps([
      item('a', 'IFT 1015', { horaire: lun('09:00', '12:00') }),
      item('p', 'Projet ML', { type: 'projet', horaire: lun('10:00', '11:00') }),
    ]);
    expect(rs).toHaveLength(1);
    expect(rs[0]).toMatchObject({ code: 'CHEVAUCHEMENT', niveau: 'avertissement', ok: true });
  });

  it('erreur : entrée non liste, horaire invalide', () => {
    expect(detectOverlaps(null)[0]).toMatchObject({ code: 'ENTREE_INVALIDE', ok: false });
    expect(detectOverlaps([item('a', 'X', { horaire: lun('25:00', '26:00') })])[0])
      .toMatchObject({ code: 'HORAIRE_INVALIDE', ok: false });
    expect(detectOverlaps([item('a', 'X', { horaire: lun('10:00', '09:00') })])[0].code).toBe('HORAIRE_INVALIDE');
  });
});

describe('checkConstraints (obs. 1, 3 + règles ajoutées)', () => {
  const A = { statut: 'regulier', credits_cumules: 15, reussis: ['IFT 1015'] };
  const cinq = [1, 2, 3, 4, 5].map((n) => item(n, `IFT ${n}`, n === 1 ? { prerequis: ['IFT 1015'] } : {}));

  it('nominal : 5 cours, 15 crédits -> tout est vert', () => {
    const rs = checkConstraints(cinq, R, A);
    const codes = ['CREDITS_FOURCHETTE', 'TEMPS_PLEIN', 'CHARGE_HEBDO', 'PREREQUIS', 'QUOTA_PROJETS', 'QUOTA_SEMINAIRES'];
    expect(codes.map((c) => un(rs, c).etat)).toEqual(Array(6).fill('vert'));
  });

  it('obs. 3 : 6 cours × 3 h = 18 h dépasse le plafond de 15 h, même à 18 crédits permis', () => {
    const six = [1, 2, 3, 4, 5, 6].map((n) => item(n, `IFT ${n}`));
    const rs = checkConstraints(six, R, A);
    expect(un(rs, 'CREDITS_FOURCHETTE').etat).toBe('vert');
    expect(un(rs, 'CHARGE_HEBDO')).toMatchObject({ etat: 'orange', ok: true });
    expect(un(rs, 'CHARGE_HEBDO').raison)
      .toBe('6 cours × 3 h = 18 h de cours par semaine, ce qui dépasse déjà votre plafond de 15 h.');
  });

  it('limite : charge totale estimée au-dessus de 45 h', () => {
    const lourd = cinq.map((i) => ({ ...i, charge_hebdo_h: 10 }));
    expect(un(checkConstraints(lourd, R, A), 'CHARGE_HEBDO').raison)
      .toBe('charge totale estimée de 50 h par semaine, au-dessus du plafond de 45 h.');
  });

  it('limite : sous 12 crédits, avertissement pour le régulier, bloquant pour l\'échange', () => {
    const trois = cinq.slice(0, 3);
    expect(un(checkConstraints(trois, R, A), 'CREDITS_FOURCHETTE').etat).toBe('orange');
    expect(un(checkConstraints(trois, R, A), 'TEMPS_PLEIN').etat).toBe('orange');
    const C = { statut: 'echange', credits_cumules: 24, reussis: [] };
    expect(un(checkConstraints(trois, R, C), 'CREDITS_FOURCHETTE')).toMatchObject({ etat: 'rouge', ok: false });
  });

  it('échange : plafond de 15 crédits et mention d\'approbation du plan', () => {
    const C = { statut: 'echange', credits_cumules: 24, reussis: [] };
    const six = [1, 2, 3, 4, 5, 6].map((n) => item(n, `IFT ${n}`));
    const rs = checkConstraints(six, R, C);
    expect(un(rs, 'CREDITS_FOURCHETTE')).toMatchObject({ etat: 'rouge', ok: false });
    expect(un(rs, 'ECHANGE_APPROBATION').message).toBe(MENTION_ECHANGE);
    expect(un(checkConstraints(cinq, R, A), 'ECHANGE_APPROBATION')).toBeUndefined();
  });

  it('limite : dernier trimestre, le seuil de temps plein est expliqué par les crédits restants', () => {
    const rs = checkConstraints([item(1, 'IFT 1')], R, { statut: 'regulier', credits_cumules: 87, reussis: [] });
    expect(un(rs, 'CREDITS_FOURCHETTE').etat).toBe('vert');
    expect(un(rs, 'TEMPS_PLEIN')).toMatchObject({ etat: 'orange', raison: 'Il ne reste que 3 crédits à compléter.' });
  });

  it('préalables manquants : rouge, avec le cours et le préalable', () => {
    const rs = checkConstraints([item(1, 'IFT 2015', { prerequis: ['IFT 1025'] })], R, A);
    expect(un(rs, 'PREREQUIS')).toMatchObject({ etat: 'rouge', ok: false, message: 'Préalables manquants : IFT 2015 (IFT 1025).' });
  });

  it('cours non reconnu : « ne compte pas pour le diplôme »', () => {
    const rs = checkConstraints([item(1, 'HORS-001', { reconnu_diro: false })], R, A);
    expect(un(rs, 'NON_RECONNU_DIRO')).toMatchObject({
      etat: 'orange', ok: true, message: 'HORS-001 (3 crédits) : ne compte pas pour le diplôme.',
    });
  });

  it('quota : deux projets supervisés dépassent le maximum de 1', () => {
    const rs = checkConstraints([item(1, 'P1', { type: 'projet' }), item(2, 'P2', { type: 'projet' })], R, A);
    expect(un(rs, 'QUOTA_PROJETS')).toMatchObject({ etat: 'rouge', ok: false });
    expect(un(rs, 'QUOTA_SEMINAIRES').etat).toBe('vert');
  });

  it('blocs et cours requis : liste ce qui reste à planifier, ignore le réussi et le planifié', () => {
    const catalogue = [
      item('c1', 'IFT 1005', { obligatoire: true, bloc: 'Programmation' }),
      item('c2', 'IFT 1015', { obligatoire: true, bloc: 'Programmation' }),
      item('c3', 'IFT 2255', { obligatoire: true }),
      item('c4', 'IFT 2245', { obligatoire: true }),
    ];
    const rs = checkConstraints([item('c4', 'IFT 2245')], R, A, catalogue);
    expect(un(rs, 'BLOCS_OBLIGATOIRES').message).toBe('Cours obligatoires à planifier — Programmation : IFT 1005.');
    expect(un(rs, 'COURS_REQUIS_DIPLOME').message).toBe('Cours requis pour le diplôme à planifier : IFT 2255.');
  });

  it('erreur : plan non liste, statut inconnu', () => {
    expect(checkConstraints('plan', R, A)[0]).toMatchObject({ code: 'ENTREE_INVALIDE', ok: false });
    expect(checkConstraints([], R, { statut: 'x', credits_cumules: 0 })[0]).toMatchObject({ code: 'STATUT_INVALIDE', ok: false });
  });
});
