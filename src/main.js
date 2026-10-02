// Écrans de l'étudiant : profil et plan. Affichage seulement ; la logique métier vit dans src/logic/.
import rows from './data/program_rules.json';
import activitesBrutes from './data/activities.json';
import etudiants from './data/students.json';
import { rulesToMap, MENTION_ECHANGE, bornesCredits } from './logic/common.js';
import { validateProfile, computeCreditTarget } from './logic/profile.js';
import { detectOverlaps, checkConstraints } from './logic/plan.js';

const R = rulesToMap(rows);
// Valeurs par défaut des données de démo : le JSON ne liste que ce qui diffère.
const ACTIVITES = activitesBrutes.map((a) => ({
  type: 'cours', credits: 3, bloc: null, obligatoire: false, reconnu_diro: true,
  prerequis: [], horaire: null, charge_hebdo_h: 7, ...a,
}));
const ROLES = [['etudiant', 'Étudiant'], ['encadrant', 'Encadrant'], ['conseil', 'Conseil de programme'],
  ['labo', 'Laboratoire/organisation'], ['registrariat', 'Registrariat']];
const APPRENTISSAGES = [['théorique', 'Théorique'], ['pratique', 'Pratique'], ['projet', 'Par projet'], ['en groupe', 'En groupe']];
const ICONES = { vert: '✔', orange: '▲', rouge: '✖' };
const LIBELLES = { vert: 'Conforme', orange: 'Avertissement', rouge: 'Bloquant' };

// --- État (persisté dans localStorage ; bouton « Réinitialiser » pour la démo) ---
const CLE = 'diro-plan-v1';
const initial = () => ({
  role: 'etudiant', vue: 'profil', etudiant: 'A', message: null,
  profils: Object.fromEntries(etudiants.map((e) => [e.id,
    { ...e, cible_credits: computeCreditTarget(e.credits_cumules, e.statut, R).cible }])),
  plans: Object.fromEntries(etudiants.map((e) => [e.id, []])),
});
const charger = () => {
  try { return { ...initial(), ...JSON.parse(localStorage.getItem(CLE)), message: null }; } catch { return initial(); }
};
const sauver = () => {
  try { localStorage.setItem(CLE, JSON.stringify({ ...etat, message: null })); } catch { /* stockage indisponible : l'état reste en mémoire */ }
};
let etat = charger();

// --- Outils d'affichage ---
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const opts = (liste, courant) => liste.map(([v, n]) => `<option value="${esc(v)}"${v === courant ? ' selected' : ''}>${esc(n)}</option>`).join('');
const trouver = (id) => ACTIVITES.find((a) => a.id === id);
const horaireTexte = (a) => (a.horaire ? a.horaire.map((c) => `${c.jour}. ${c.debut}–${c.fin}`).join(', ') : 'sans horaire fixe');
const fmt = (v) => (typeof v === 'object' ? Object.entries(v).map(([k, n]) => `${n} ${k}`).join(' + ') : v);
const typeLibelle = (a) => (a.type === 'projet' ? 'Projet supervisé' : !a.reconnu_diro ? 'Hors DIRO' : a.obligatoire ? 'Obligatoire' : 'À option');

// Jamais la couleur seule : icône + libellé + texte.
const resultat = (r) => `<li class="res ${r.etat}"><span class="ico" aria-hidden="true">${ICONES[r.etat]}</span><div><span class="etat">${LIBELLES[r.etat]}.</span>${esc(r.message)}${r.raison ? `<p>${esc(r.raison)}</p>` : ''}</div></li>`;

const legende = () => `<aside class="legende" aria-label="Légende"><strong>Intention</strong> : aucune place n'est retenue. <strong>Place réservée</strong> : confirmée par l'encadrant ou l'inscription officielle. Rien de ce plan n'est réservé.</aside>`;

const entete = () => `<header>
  <h1>Planification des études — DIRO</h1>
  <div class="barre">
    <label>Rôle (démo)<select data-champ="role" data-f="role">${opts(ROLES, etat.role)}</select></label>
    <label>Étudiant (démo)<select data-champ="etudiant" data-f="etudiant">${opts(etudiants.map((e) => [e.id, e.nom]), etat.etudiant)}</select></label>
    <button type="button" data-act="reinit" data-f="reinit">Réinitialiser les données de démo</button>
  </div>
  <nav aria-label="Écrans">${[['profil', 'Profil'], ['plan', 'Plan du trimestre']].map(([v, n]) =>
    `<button type="button" data-act="vue" data-id="${v}" data-f="vue-${v}"${etat.vue === v ? ' aria-current="page"' : ''}>${n}</button>`).join('')}</nav>
</header>`;

// --- Écran Profil (obs. 1 : règles en lecture seule, cible limitée aux bornes) ---
function vueProfil() {
  const p = etat.profils[etat.etudiant];
  const restants = Math.max(0, R.credits_total_diplome - p.credits_cumules);
  const [min, max] = bornesCredits(p.statut, R).map((b) => Math.min(b, restants));
  const res = validateProfile(p, R);
  const bloque = res.some((r) => !r.ok);
  return `<main id="contenu" tabindex="-1">
  <h2>Profil</h2>
  <div class="champs">
    <p>Programme : <strong>Baccalauréat en informatique</strong></p>
    <label>Statut<select data-champ="statut" data-f="statut">${opts([['regulier', 'Régulier'], ['echange', 'Échange']], p.statut)}</select></label>
    <label>Crédits cumulés<input type="number" min="0" max="${R.credits_total_diplome}" value="${p.credits_cumules}" data-champ="credits_cumules" data-f="cumul"></label>
    <label>Trimestre courant<input value="${esc(p.trimestre)}" data-champ="trimestre" data-f="trimestre"></label>
    <label>Intérêts (séparés par des virgules)<input value="${esc(p.interets.join(', '))}" data-champ="interets" data-f="interets"></label>
    <label>Façon d'apprendre<select data-champ="apprentissage" data-f="appr">${opts(APPRENTISSAGES, p.apprentissage)}</select></label>
    <label>Cible de crédits : <output>${p.cible_credits}</output> (de ${min} à ${max})<input type="range" min="${min}" max="${max}" value="${p.cible_credits}" data-champ="cible_credits" data-f="cible"></label>
  </div>
  ${p.statut === 'echange' ? `<p class="note">${esc(MENTION_ECHANGE)}</p>` : ''}
  <h3>Validation</h3>
  <ul>${res.map(resultat).join('')}</ul>
  <button type="button" data-act="vue" data-id="plan" data-f="continuer"${bloque ? ' disabled' : ''}>Continuer vers le plan</button>
  ${bloque ? '<p>Corrigez les points bloquants pour continuer.</p>' : ''}
  <h3>Règles du programme (lecture seule)</h3>
  <table><caption class="sr">Règles du programme</caption>
  <thead><tr><th scope="col">Règle</th><th scope="col">Valeur</th><th scope="col">Explication</th></tr></thead>
  <tbody>${rows.map((r) => `<tr><th scope="row"><code>${r.cle}</code></th><td>${esc(fmt(r.valeur))}</td><td>${esc(r.explication)} ${r.a_valider ? '<span class="badge">à valider</span>' : ''}</td></tr>`).join('')}</tbody></table>
</main>`;
}

// --- Écran Plan (obs. 3 : contraintes visibles ; obs. 7 : chevauchements) ---
const carte = (a, auPlan, p) => {
  const manquants = a.prerequis.filter((s) => !p.reussis.includes(s));
  return `<li><strong>${esc(a.sigle)}</strong> ${esc(a.titre)} <span class="badge">${typeLibelle(a)}</span>${a.fictif ? ' <span class="badge">fictif</span>' : ''}
  <p>${a.credits} crédits, ${esc(horaireTexte(a))}${a.bloc ? `, bloc ${esc(a.bloc)}` : ''}. <span class="badge">horaire de démo</span></p>
  ${a.prerequis.length ? `<p>Préalables (démo, à valider) : ${esc(a.prerequis.join(', '))}${manquants.length ? `. Manquants : ${esc(manquants.join(', '))}` : ''}.</p>` : ''}
  ${a.reconnu_diro ? '' : '<p class="note">Ne compte pas pour le diplôme.</p>'}
  ${auPlan ? '<span class="badge">Au plan</span>' : `<button type="button" data-act="ajouter" data-id="${a.id}" data-f="a-${a.id}">Ajouter ${esc(a.sigle)}</button>`}</li>`;
};

function vuePlan() {
  const p = etat.profils[etat.etudiant];
  const plan = etat.plans[etat.etudiant].map(trouver);
  const dansPlan = new Set(plan.map((a) => a.id));
  const total = plan.reduce((s, a) => s + a.credits, 0);
  return `<main id="contenu" tabindex="-1">
  <h2>Plan du trimestre : ${esc(p.trimestre)}</h2>
  ${etat.message ? `<ul>${resultat(etat.message)}</ul>` : ''}
  ${legende()}
  <div class="deux">
    <section aria-labelledby="t-cat"><h3 id="t-cat">Catalogue</h3><ul>${ACTIVITES.map((a) => carte(a, dansPlan.has(a.id), p)).join('')}</ul></section>
    <section aria-labelledby="t-plan"><h3 id="t-plan">Mon plan (intention) : ${total} crédits</h3>
      ${plan.length ? `<ul>${plan.map((a) => `<li>${esc(a.sigle)} ${esc(a.titre)}, ${esc(horaireTexte(a))}
        <button type="button" data-act="retirer" data-id="${a.id}" data-f="r-${a.id}">Retirer ${esc(a.sigle)}</button></li>`).join('')}</ul>` : '<p>Aucune activité. Ajoutez-en depuis le catalogue.</p>'}
      <h3>Contraintes</h3>
      <ul>${checkConstraints(plan, R, p, ACTIVITES).map(resultat).join('')}</ul>
    </section>
  </div>
</main>`;
}

const avisRole = () => `<main id="contenu" tabindex="-1"><h2>${esc(ROLES.find(([v]) => v === etat.role)[1])}</h2>
  <p class="note">Cette vue n'est pas encore construite. Choisissez le rôle « Étudiant » pour voir les écrans disponibles.</p></main>`;

// --- Actions ---
function ajouter(a, ids) {
  // Obs. 7 : deux cours qui se chevauchent bloquent l'ajout ; le reste est seulement signalé.
  const concernes = detectOverlaps([...ids.map(trouver), a]).filter((r) => r.paire?.includes(a.id));
  const dur = concernes.find((r) => !r.ok);
  if (dur) { etat.message = { ...dur, message: `${a.sigle} non ajouté. ${dur.message}` }; return; }
  ids.push(a.id);
  etat.message = concernes[0]
    ? { ...concernes[0], message: `${a.sigle} ajouté au plan. ${concernes[0].message}` }
    : { etat: 'vert', message: `${a.sigle} ajouté au plan (intention).`, raison: '' };
}

function modifier(c) {
  const p = etat.profils[etat.etudiant];
  const { champ } = c.dataset;
  if (champ === 'etudiant' || champ === 'role') etat[champ] = c.value;
  else {
    p[champ] = champ === 'interets' ? c.value.split(',').map((s) => s.trim()).filter(Boolean)
      : ['credits_cumules', 'cible_credits'].includes(champ) ? Number(c.value) : c.value;
    if (champ === 'statut' || champ === 'credits_cumules') {
      p.cible_credits = computeCreditTarget(p.credits_cumules, p.statut, R).cible ?? p.cible_credits;
    }
  }
  etat.message = null;
  suite();
}

function agir(act, id) {
  const ids = etat.plans[etat.etudiant];
  if (act === 'vue') { etat.vue = id; etat.message = null; }
  else if (act === 'reinit') etat = initial();
  else if (act === 'retirer') { ids.splice(ids.indexOf(id), 1); etat.message = null; }
  else if (act === 'ajouter') ajouter(trouver(id), ids);
  suite();
}

const suite = () => { sauver(); annoncer(); render(); };

// aria-live : résumé des changements d'état importants (le message détaillé reste affiché dans la page).
function annoncer() {
  const cs = checkConstraints(etat.plans[etat.etudiant].map(trouver), R, etat.profils[etat.etudiant], ACTIVITES);
  const n = (e) => cs.filter((r) => r.etat === e).length;
  $('#annonce').textContent = `${etat.message ? `${etat.message.message} ` : ''}Plan : ${n('rouge')} contrainte(s) bloquante(s), ${n('orange')} avertissement(s).`;
}

function render() {
  const f = document.activeElement?.dataset?.f;
  const corps = etat.role !== 'etudiant' ? avisRole() : etat.vue === 'plan' ? vuePlan() : vueProfil();
  $('#app').innerHTML = entete() + corps;
  if (f) ($(`[data-f="${f}"]`) ?? $('#contenu'))?.focus();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b) agir(b.dataset.act, b.dataset.id);
});
document.addEventListener('change', (e) => {
  const c = e.target.closest('[data-champ]');
  if (c) modifier(c);
});
render();
