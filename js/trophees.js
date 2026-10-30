// Les trophées (Trophees.kt, 11/10, à niveaux depuis le 12/10) : neuf
// familles qui montent par niveaux, la médaille passant du bronze à
// l'argent, à l'or puis au platine. Mêmes règles que l'application Android.

// L'icône : clé de ICONES (trophees-formes.js), au trait, variante B choisie le 16/10.
// L'objet (12/10) : coupe, écusson, étoile, rosette, médaille, pièces, cristal, gemme (tools/trophees_formes.py).
export const FAMILLES = [
  ['premier_pas', 'premier_pas', [1, 2, 3, 4, 5], 'rosette'],
  ['seance_longue', 'seance_longue', [10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180], 'coupe'],
  ['jours', 'jours', [7, 10, 15, 18, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 120, 150, 180, 200, 250, 300, 365, 400, 500, 613], 'medaille'],
  ['serie', 'serie', [3, 5, 7, 10, 15, 18, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100], 'etoile'],
  ['heures', 'heures', [1, 2, 5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 100, 150, 200, 250, 300], 'pieces'],
  ['semaines', 'semaines', [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 26, 30, 40, 45, 52], 'ecusson'],
  ['erev_chabbat', 'erev_chabbat', [1, 4, 12, 26, 52], 'cristal'],
  ['retour', 'retour', [1, 3, 5, 10], 'gemme'],
  ['plume', 'plume', [1, 10, 25, 50, 100, 150], 'coupe'],
].map(([cle, icone, seuils, forme]) => ({ cle, icone, seuils, forme }));

export const METAUX = ['bronze', 'argent', 'or', 'platine'];

/** Le métal d'un rang : un quart de la famille par métal ; une famille d'un seul niveau est de bronze. */
export function metal(f, rang) {
  if (f.seuils.length === 1) return 'bronze';
  return METAUX[Math.min(3, Math.max(0, Math.floor(((rang - 1) * 4) / f.seuils.length)))];
}

const jourDe = (iso) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 86400000);
const semaineDe = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 dimanche … 6 samedi

/** Les semaines pleines : six jours faits, du dimanche au vendredi. */
export function semainesPleines(jours) {
  const n = new Set([...jours].map(jourDe));
  return [...jours].filter((iso) => semaineDe(iso) === 0 && [0, 1, 2, 3, 4, 5].every((k) => n.has(jourDe(iso) + k))).length;
}

/** Les retours : un jour de pratique après au moins sept jours sans. */
export function retours(jours) {
  const n = [...jours].map(jourDe).sort((a, b) => a - b);
  return n.filter((v, i) => i > 0 && v - n[i - 1] > 7).length;
}

/** La valeur que compte une famille. pratique = { minutes: { iso: min }, notes, meilleureSerie }. */
export function valeur({ minutes, notes, meilleureSerie }, cle) {
  // Un jour validé compte, même à 0 min (Trophees.valeur) : comme la série.
  const jours = Object.keys(minutes);
  const valeurs = Object.values(minutes);
  switch (cle) {
    case 'premier_pas': return Math.min(jours.length, 5);
    case 'seance_longue': return valeurs.length ? Math.max(...valeurs) : 0;
    case 'jours': return jours.length;
    case 'serie': return meilleureSerie;
    case 'heures': return Math.floor(valeurs.reduce((s, v) => s + v, 0) / 60);
    case 'semaines': return semainesPleines(jours);
    case 'erev_chabbat': return jours.filter((iso) => semaineDe(iso) === 5).length;
    case 'retour': return retours(jours);
    case 'plume': return notes;
    default: return 0;
  }
}

export const rang = (p, f) => { const v = valeur(p, f.cle); return f.seuils.filter((s) => v >= s).length; };

/** Tous les niveaux atteints, en clés « famille:rang ». */
export function gagnes(p) {
  const g = new Set();
  for (const f of FAMILLES) for (let r = 1; r <= rang(p, f); r++) g.add(`${f.cle}:${r}`);
  return g;
}

/** Vers le niveau suivant ; au sommet, le dernier seuil. */
export function progres(p, f) {
  const r = rang(p, f);
  const v = valeur(p, f.cle);
  const cible = f.seuils[Math.min(r, f.seuils.length - 1)];
  return { valeur: v, cible, fraction: cible > 0 ? Math.min(v, cible) / cible : 1 };
}

/**
 * Les niveaux gagnés depuis la dernière fois, le plus haut de chaque famille ;
 * rien la première fois (vus null) ni depuis l'ancien format (clés sans « : »).
 */
export function nouveaux(g, vus) {
  if (!vus || (vus.size && ![...vus].some((k) => k.includes(':')))) return [];
  const parFamille = new Map();
  for (const k of g) {
    if (vus.has(k)) continue;
    const [cle, r] = k.split(':');
    if (!parFamille.has(cle) || parFamille.get(cle) < Number(r)) parFamille.set(cle, Number(r));
  }
  return [...parFamille].map(([cle, r]) => { const famille = FAMILLES.find((f) => f.cle === cle); return { famille, rang: r, metal: metal(famille, r) }; })
    .sort((a, b) => METAUX.indexOf(b.metal) * 100 + b.rang - (METAUX.indexOf(a.metal) * 100 + a.rang));
}

/** Le chemin (15/10, Trophees.chemin) : tous les niveaux en une liste, du plus facile au plus dur. */
const COUTS = { premier_pas: (s) => s, jours: (s) => s, seance_longue: (s) => s / 2, serie: (s) => s * 1.5, heures: (s) => s * 4,
  semaines: (s) => s * 8, erev_chabbat: (s) => s * 7, retour: (s) => s * 30 + 10, plume: (s) => s * 1.3 };
export const cout = (f, seuil) => COUTS[f.cle](seuil);
export const chemin = FAMILLES.flatMap((f, ordre) => f.seuils.map((seuil, i) => ({ f, rang: i + 1, seuil, ordre, cle: `${f.cle}:${i + 1}` })))
  .sort((a, b) => cout(a.f, a.seuil) - cout(b.f, b.seuil) || a.ordre - b.ordre);
export const gagne = (p, e) => valeur(p, e.f.cle) >= e.seuil;
export const fraction = (p, e) => Math.min(valeur(p, e.f.cle), e.seuil) / e.seuil;
/** Le prochain : parmi ceux à gagner, le plus près d'être atteint ; à égalité, le plus facile. */
export function prochain(p) {
  let m = null;
  for (const e of chemin) if (!gagne(p, e) && (!m || fraction(p, e) > fraction(p, m))) m = e;
  return m;
}

/** Le grade (15/10, Trophees.grade) selon le nombre de trophées gagnés : bronze, argent dès 10, or dès 25, platine dès 50. */
export const SEUILS_GRADES = [0, 10, 25, 50];
export const grade = (compte) => METAUX[SEUILS_GRADES.filter((s) => compte >= s).length - 1];

/** Les plus proches (16/10, Trophees.plusProches) : les k trophées à gagner les plus avancés ; à égalité, les plus faciles. */
export function plusProches(p, k = 3) {
  return chemin.filter((e) => !gagne(p, e))
    .sort((a, b) => fraction(p, b) - fraction(p, a) || cout(a.f, a.seuil) - cout(b.f, b.seuil))
    .slice(0, k);
}

/** Le prochain, s'il est tout proche (Trophees.proche) : à un dixième du seuil, ou à une unité pour les petits seuils. */
export function proche(p) {
  const e = prochain(p);
  if (!e) return null;
  const reste = e.seuil - valeur(p, e.f.cle);
  return reste >= 1 && reste <= Math.max(1, Math.floor(e.seuil / 10)) ? e : null;
}

/**
 * Le jour où chaque niveau a été gagné (Trophees.datesGain) : l'historique rejoué jour
 * après jour. minutes : { iso: min } ; notes : Set d'iso ; serie(faits) : la meilleure série.
 */
export function datesGain(minutes, notes, exempt) {
  // Rejeu incrémental (16/10, comme Trophees.datesGain) : chaque valeur avance jour après jour.
  // exempt(iso) : un jour exempté ne compte pas et ne casse pas la série.
  const res = {};
  const restants = new Map(FAMILLES.map((f) => [f.cle, chemin.filter((e) => e.f === f).sort((a, b) => a.seuil - b.seuil)]));
  const faits = new Set();
  const pleines = new Set();
  let jours = 0; let plusLongue = 0; let total = 0; let vendredis = 0; let nbRetours = 0;
  let semaines = 0; let notesVues = 0; let courante = 0; let meilleure = 0; let precedent = null;
  const notesSet = new Set(notes);
  for (const d of [...new Set([...Object.keys(minutes), ...notesSet])].sort()) {
    if (notesSet.has(d)) notesVues++;
    const m = minutes[d] ?? 0;
    if (d in minutes) {
      faits.add(d);
      jours++; total += m; plusLongue = Math.max(plusLongue, m);
      if (semaineDe(d) === 5) vendredis++;
      if (precedent && jourDe(d) - jourDe(precedent) > 7) nbRetours++;
      let suite = !!precedent;
      for (let x = precedent && ajoute(precedent, 1); suite && x < d; x = ajoute(x, 1)) if (!exempt(x)) suite = false;
      courante = suite ? courante + 1 : 1;
      meilleure = Math.max(meilleure, courante);
      precedent = d;
      const dimanche = ajoute(d, -semaineDe(d));
      if (!pleines.has(dimanche) && [0, 1, 2, 3, 4, 5].every((k) => faits.has(ajoute(dimanche, k)))) { pleines.add(dimanche); semaines++; }
    }
    const v = { premier_pas: Math.min(jours, 5), seance_longue: plusLongue, jours, serie: meilleure, heures: Math.floor(total / 60),
      semaines, erev_chabbat: vendredis, retour: nbRetours, plume: notesVues };
    for (const [cle, niveaux] of restants) {
      while (niveaux.length && niveaux[0].seuil <= v[cle]) res[niveaux.shift().cle] = d;
      if (!niveaux.length) restants.delete(cle);
    }
    if (!restants.size) break;
  }
  return res;
}

// --- Le bilan de la semaine (BilanSemaine.kt, 16/10) --------------------------------------
const ajoute = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const debutSemaine = (iso) => ajoute(iso, -semaineDe(iso));

/** Le bilan de la semaine écoulée (dimanche → samedi) vue depuis aujourdhui ; null si elle n'a rien compté. */
export function bilanSemaine(aujourdhui, minutes, dates) {
  const debut = ajoute(debutSemaine(aujourdhui), -7);
  const fin = ajoute(debut, 6);
  const somme = (a, b) => Object.entries(minutes).filter(([k]) => k >= a && k <= b).reduce((s, [, v]) => s + v, 0);
  const total = somme(debut, fin);
  if (total <= 0) return null;
  const avant = {};
  for (const [k, v] of Object.entries(minutes)) if (k < debut) avant[debutSemaine(k)] = (avant[debutSemaine(k)] ?? 0) + v;
  const meilleureAvant = Math.max(0, ...Object.values(avant));
  const precedente = somme(ajoute(debut, -7), ajoute(debut, -1));
  return {
    debut, minutes: total, precedente, ecart: total - precedente,
    jours: Object.entries(minutes).filter(([k]) => k >= debut && k <= fin).length,
    record: meilleureAvant > 0 && total > meilleureAvant,
    trophees: chemin.filter((e) => dates[e.cle] && dates[e.cle] >= debut && dates[e.cle] <= fin),
  };
}
