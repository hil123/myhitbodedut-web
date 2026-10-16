// Ce que l'onglet Zmanim et le calendrier montrent d'un jour (JourAffiche.kt,
// 10/10) : les ajouts à nommer, les horaires avec l'entrée et la sortie de
// Chabbat ou de fête, la grille d'un mois. Mêmes règles, mêmes cas de test.

import { C, jour } from './calendrier-juif.js';
import { conditionsPour, libelleHallel } from './siddur-jour.js';
import * as Z from './zmanim.js';
import { SiddurMoment } from './regles.js';

/**
 * Les ajouts du jour, dans l'ordre de l'Amida : des clés de libellé. Le nusah
 * change Morid hatal hors d'Israël, la bénédiction du Hallel partiel et
 * l'Anénou du particulier (JourAffiche.ajouts, ZMANIM.md).
 */
export function ajouts(c0, nusah = 'edot', enIsrael = false, sansTahanounFinTichri = nusah === 'edot', sud = false) {
  const c = conditionsPour(nusah, enIsrael, c0, sansTahanounFinTichri, sud);
  const l = [];
  if (c.has(C.ASSERET_YEMEI_TECHOUVA)) l.push('ajout_asseret_yemei_techouva');
  // Les jours de bascule, les deux formules (bascule_pluie) ; sinon l'une ou l'autre.
  if (c.has(C.MACHIV_HAROUAH)) l.push('ajout_machiv_harouah');
  if (c.has(C.MORID_HATAL) && (!c.has(C.MACHIV_HAROUAH) || c.has('bascule_pluie'))) l.push('ajout_morid_hatal');
  // La 9ᵉ bénédiction (JourAffiche.ajouts) : texte des Edot ; rien le Chabbat.
  if (!c.has(C.CHABBAT)) {
    if (nusah === 'edot') l.push(c.has(C.TAL_OUMATAR) ? 'ajout_barekh_alenou' : 'ajout_barkhenou');
    else l.push(c.has(C.TAL_OUMATAR) ? 'ajout_tal_oumatar' : 'ajout_berakha');
  }
  if (c.has(C.JEUNE)) {
    l.push('ajout_anenou_officiant');
    // Edot : à Tich'a bèAv, le jeûne commence la veille au soir, et Arvit en est.
    if (nusah !== 'edot') l.push('ajout_anenou_particulier_minha');
    else l.push(c.has(C.TICHA_BEAV) ? 'ajout_anenou_particulier_trois' : 'ajout_anenou_particulier_matin_minha');
  }
  if (c.has(C.TICHA_BEAV)) l.push('ajout_ticha_beav');
  if (c.has(C.YAALE_VEYAVO)) l.push('ajout_yaale_veyavo');
  if (c.has(C.AL_HANISSIM)) l.push('ajout_al_hanissim');
  const hallel = libelleHallel(nusah, c);
  if (hallel) l.push(hallel);
  // Le Chabbat, il n'y a pas d'Amida de semaine où dire ou taire Ta'hanoun.
  if (!c.has(C.CHABBAT)) l.push(c.has(C.TAHANOUN_CHAHARIT) ? 'ajout_tahanoun' : 'ajout_sans_tahanoun');
  return l;
}

const lendemain = (iso) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + 1, 12)).toISOString().slice(0, 10);
};

/** Les horaires du jour, avec l'allumage et la sortie (règles de JourAffiche.horaires). */
export function horaires(lieu, iso, enIsrael, minutes) {
  const aujourdhui = jour(iso, enIsrael).chome;
  const demain = jour(lendemain(iso), enIsrael).chome;
  const base = Z.jour(lieu, iso);
  const tset = base.find((z) => z.cle === 'tset');
  const sortie = [];
  for (const z of base) {
    if (z.cle === 'chkia' && demain && !aujourdhui) sortie.push(Z.allumage(lieu, iso, minutes));
    sortie.push(z);
    if (z.cle === 'tset') {
      if (aujourdhui && !demain) sortie.push({ ...tset, cle: 'sortie' });
      if (aujourdhui && demain) sortie.push({ ...tset, cle: 'allumage', methode: 'apres_tset', parametres: '' });
    }
  }
  return sortie;
}

/**
 * Le texte du siddour que suggère l'instant [maintenant] (Date) d'après les
 * zmanim du [lieu] : mêmes bornes que JourAffiche.momentDuSiddour ; null
 * dans les creux ('hatsot – min'ha guedola, chki'a – tsét) ; sans zmanim,
 * les heures fixes de SiddurMoment.
 */
export function momentDuSiddour(lieu, maintenant) {
  const parties = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: lieu.fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(maintenant).map((p) => [p.type, p.value]));
  const iso = `${parties.year}-${parties.month}-${parties.day}`;
  const minutes = Number(parties.hour) * 60 + Number(parties.minute);
  const instants = (d) => Object.fromEntries(Z.jour(lieu, d).map((x) => [x.cle, x.instant]));
  const z = instants(iso);
  const [a, m, j] = iso.split('-').map(Number);
  const hier = instants(new Date(Date.UTC(a, m - 1, j - 1, 12)).toISOString().slice(0, 10));
  const cles = ['alot', 'misheyakir', 'chatsot', 'minha_gedola', 'chkia', 'tset', 'chatsot_layla'];
  if (cles.some((c) => !z[c]) || !hier.chatsot_layla) return SiddurMoment.suggestion(Math.floor(minutes / 60), minutes % 60);
  const t = +maintenant;
  const avant = (c) => t < +z[c];
  if (avant('alot')) return t >= +hier.chatsot_layla ? 'tikoun_hatsot' : 'chema_coucher';
  if (avant('misheyakir')) return 'birkot_hachahar';
  if (avant('chatsot')) return 'chaharit';
  if (avant('minha_gedola')) return null;
  if (avant('chkia')) return 'minha';
  if (avant('tset')) return null;
  if (avant('chatsot_layla')) return minutes > 12 * 60 && minutes < 22 * 60 + 30 ? 'arvit' : 'chema_coucher';
  return 'tikoun_hatsot';
}

/** Les semaines d'un mois civil (mois 1-12), du dimanche au samedi ; null hors du mois. */
export function semaines(annee, mois) {
  const longueur = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const p = (n) => String(n).padStart(2, '0');
  return grille(Array.from({ length: longueur }, (_, i) => `${annee}-${p(mois)}-${p(i + 1)}`));
}

const decaleIso = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Le premier jour (1er) du mois hébreu qui contient iso. Le mois ne dépend pas du lieu. */
export function debutMoisHebreu(iso) {
  return decaleIso(iso, -(jour(iso, false).jourHebreu - 1));
}

/** Les 29 ou 30 jours du mois hébreu qui contient iso. */
export function joursMoisHebreu(iso) {
  const debut = debutMoisHebreu(iso);
  const mois = jour(debut, false).moisHebreu;
  const jours = [debut];
  for (let d = decaleIso(debut, 1); jour(d, false).moisHebreu === mois; d = decaleIso(d, 1)) jours.push(d);
  return jours;
}

/** Les semaines du mois hébreu qui contient iso, du dimanche au samedi ; null hors du mois. */
export function semainesHebreu(iso) {
  return grille(joursMoisHebreu(iso));
}

/** Le 1er du mois hébreu suivant (sens = 1) ou précédent (sens = -1). */
export function moisHebreuVoisin(iso, sens) {
  return sens > 0 ? decaleIso(joursMoisHebreu(iso).at(-1), 1) : debutMoisHebreu(decaleIso(debutMoisHebreu(iso), -1));
}

function grille(jours) {
  const decalage = new Date(`${jours[0]}T12:00:00Z`).getUTCDay();
  const cases = [...Array(decalage).fill(null), ...jours];
  const s = [];
  for (let i = 0; i < cases.length; i += 7) {
    const l = cases.slice(i, i + 7);
    s.push([...l, ...Array(7 - l.length).fill(null)]);
  }
  return s;
}

// --- La carte du jour : illustration, hilloula, halakha (11/10) -------------------
// Comme JourAffiche.illustration et Hilloulot.kt.

/** L'illustration d'un jour de fête ou de Chabbat, ou null ; la fête passe avant Chabbat. */
export function illustration(fetes, iso) {
  const a = (liste) => fetes.some((f) => liste.includes(f));
  if (a(['erev_soukkot', 'soukkot', 'hol_hamoed_soukkot', 'hochaana_rabba'])) return 'scene_sukkot';
  if (a(['erev_pessah', 'pessah', 'hol_hamoed_pessah'])) return 'char_matsa';
  if (fetes.includes('hanouka')) return 'scene_hanukkah';
  if (a(['pourim', 'chouchan_pourim', 'pourim_ailleurs', 'pourim_jerusalem'])) return 'char_purim';
  return new Date(`${iso}T12:00:00Z`).getUTCDay() === 6 ? 'char_shabbat' : null;
}

/** Cycle de Méton : 7 années embolismiques sur 19. */
export const embolismique = (annee) => (7 * annee + 1) % 19 < 7;

/**
 * Les clés de hilloulot.json pour un jour hébreu (mois de KosherJava,
 * NISSAN = 1 … ADAR_II = 13). « adar » sans précision : Adar II les années
 * embolismiques (OH 568:7) ; un 30 absent cette année, le 29.
 */
export function clesHilloula(mois, jourH, emb, dernierJour, ashkenaz = false) {
  // Ashkénazes : « adar » en Adar I, comme le note le Rema (Hilloulot.cles).
  const m = mois === 12 && !emb ? ['adar', 'adar1', 'adar2'] : mois === 12 ? (ashkenaz ? ['adar', 'adar1'] : ['adar1'])
    : mois === 13 ? (ashkenaz ? ['adar2'] : ['adar', 'adar2']) : [String(mois)];
  const jours = jourH === 29 && dernierJour ? [29, 30] : [jourH];
  return m.flatMap((k) => jours.map((j) => `${k}-${j}`));
}

/** D'abord ceux que les deux sources donnent, puis ceux sans doute relevé. */
export function hilloulotDuJour(table, cles) {
  const rang = (h) => (h.s.length === 2 ? 0 : 2) + (h.d ? 1 : 0);
  return cles.flatMap((k) => table[k] ?? []).map((h, i) => [h, i])
    .sort((x, y) => rang(x[0]) - rang(y[0]) || x[1] - y[1]).map(([h]) => h);
}

export function hilloulotPour(table, iso, enIsrael, ashkenaz = false) {
  const j = jour(iso, enIsrael);
  const [a, m, d] = iso.split('-').map(Number);
  const demain = new Date(Date.UTC(a, m - 1, d + 1, 12)).toISOString().slice(0, 10);
  return hilloulotDuJour(table, clesHilloula(j.moisHebreu, j.jourHebreu, embolismique(j.anneeHebraique), jour(demain, enIsrael).jourHebreu === 1, ashkenaz));
}

/** La page du jour de החכם היומי, qui prend la date civile. */
export function lienHyomi(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return `https://hyomi.org.il/day.php?month1=0&dd=${d}&mm=${m}&yy=${a}`;
}

/** La halakha du jour, dans la langue de l'application. */
export function lienHalakha(langue) {
  const code = /^(he|iw)/.test(langue) ? 'he' : /^en/.test(langue) ? 'en' : 'fr';
  return `https://halachayomit.co.il/${code}/default.aspx`;
}

const MOIS_HILLOULA = { 1: 'ניסן', 2: 'אייר', 3: 'סיון', 4: 'תמוז', 5: 'אב', 6: 'אלול', 7: 'תשרי', 8: 'חשון', 9: 'כסלו', 10: 'טבת', 11: 'שבט', adar: 'אדר', adar1: 'אדר א׳', adar2: 'אדר ב׳' };

/** « 7-30 » → « ל׳ תשרי » (Hilloulot.dateDe). */
export function dateHilloula(cle, lettres) {
  const [m, j] = cle.split('-');
  return `${lettres(Number(j))} ${MOIS_HILLOULA[m] ?? m}`;
}

/** La recherche par nom, sans voyelles ni guillemets, dans toute l'année. */
export function rechercheHilloula(table, texte) {
  const nu = (t) => t.replace(/[\u0591-\u05C7"'״׳]/g, '').toLowerCase();
  const q = nu(texte.trim());
  if (q.length < 2) return [];
  return Object.entries(table).flatMap(([cle, l]) => l.map((x) => [cle, x]))
    .filter(([, x]) => nu(x.he).includes(q) || (x.fr && nu(x.fr).includes(q)) || (x.en && nu(x.en).includes(q)));
}

export const lienArticle = (titre) => `https://he.wikipedia.org/wiki/${encodeURIComponent(titre.replace(/ /g, '_'))}`;
