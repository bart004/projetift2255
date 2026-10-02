import { expect, it } from 'vitest';
import rows from './program_rules.json';

const ATTENDUES = [
  'credits_total_diplome', 'credits_min_regulier', 'credits_max_regulier', 'credits_min_echange',
  'credits_max_echange', 'credits_par_cours_typique', 'heures_par_credit_semaine',
  'plafond_heures_cours_semaine', 'plafond_charge_totale_semaine', 'tronc_commun',
  'orientation_generale', 'quota_projets', 'quota_seminaires', 'plafond_demandes_simultanees',
  'delai_relance_heures',
];

it('program_rules : 15 règles, chacune expliquée et marquée à valider ou non', () => {
  expect(rows.map((r) => r.cle).sort()).toEqual([...ATTENDUES].sort());
  expect(rows.every((r) => r.explication && typeof r.a_valider === 'boolean')).toBe(true);
});
