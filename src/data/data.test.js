import { expect, it } from 'vitest';
import activites from './activities.json';
import etudiants from './students.json';

const sigles = new Set(activites.map((a) => a.sigle));

it('activities : 16 cours réels, identifiants uniques, préalables et réussis connus', () => {
  expect(activites.filter((a) => !a.fictif)).toHaveLength(16);
  expect(new Set(activites.map((a) => a.id)).size).toBe(activites.length);
  activites.forEach((a) => (a.prerequis ?? []).forEach((s) => expect(sigles.has(s), `${a.id} -> ${s}`).toBe(true)));
  etudiants.forEach((e) => e.reussis.forEach((s) => expect(sigles.has(s), `${e.id} -> ${s}`).toBe(true)));
});
