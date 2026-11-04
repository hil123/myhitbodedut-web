// Les zmanim en vol (Vol.kt, 28/10), phase 1 : hors ligne, sur la route
// prévue, sans réseau. Le même calcul qu'Android, ligne pour ligne : l'avion
// sur le grand cercle à vitesse constante, et un zman a lieu en vol à
// l'instant t où le zman du point sous l'avion vaut t. Le zman du point est
// celui de zmanim.js (jour), au niveau de la mer, même profil. Choix et
// limites : ZMANIM.md, « En vol ». Tout est en UTC (des Date).

import { jour, CLES } from './zmanim.js';
import { jour as jourJuif } from './calendrier-juif.js';

const H = 3600 * 1000;
const MIN = 60 * 1000;
export const MARGE = 30 * H;
const PAS_VOL = 5 * MIN;
const PAS_SOL = 60 * MIN;
const APPARIEMENT = 3 * H;
const TOLERANCE = 500;
export const LATITUDE_HAUTE = 60;
export const RETARD = 30 * MIN;
export const DUREE_MAX = 22 * H;
const COUVERT = 6 * H;

/**
 * [iata, nom, ville, pays, latitude, longitude, fuseau] (aeroports.json) → objet ; les noms en hébreu
 * et en français (aeroports_noms.json, Wikidata : [nom he, [villes he], nom fr, [villes fr]]) s'y
 * ajoutent, pour l'affichage (noms) et la recherche (alias) (Aeroports.parse).
 */
export function aeroports(donnees, nomsDonnees = null) {
  const autres = nomsDonnees?.noms ?? {};
  return donnees.aeroports.map(([iata, nom, ville, pays, latitude, longitude, fuseau]) => {
    const n = autres[iata];
    const noms = {};
    const alias = [];
    if (n) ['he', 'fr'].forEach((langue, k) => {
      if (n[2 * k]) { noms[langue] = n[2 * k]; alias.push(n[2 * k]); }
      alias.push(...n[2 * k + 1]);
    });
    return { iata, nom, ville, pays, latitude, longitude, fuseau, noms, alias };
  });
}

/** Sans accents, nikoud, casse ni ponctuation : tiret, maqaf, apostrophe, guillemets, géresh et points deviennent des espaces. */
const plier = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[-\u05BE'\u2019"\u05F3\u05F4.]/g, ' ').replace(/\s+/g, ' ').trim();

/** Le code IATA exact d'abord, puis la ville, puis le nom et les autres noms (Aeroports.chercher). */
export function chercher(liste, texte, max = 20) {
  const q = plier(texte);
  if (!q) return [];
  // Les noms pliés une fois par liste (04/11) : avant, chaque lettre repliait les 3 226 aéroports.
  let idx = INDEX.get(liste);
  if (!idx) {
    idx = liste.map((a) => ({ iata: plier(a.iata), ville: plier(a.ville), nom: plier(a.nom), alias: (a.alias ?? []).map(plier) }));
    INDEX.set(liste, idx);
  }
  const exact = [];
  const ville = [];
  const nom = [];
  idx.forEach((p, i) => {
    if (p.iata === q) exact.push(i);
    else if (p.ville.startsWith(q) || p.alias.some((x) => x.startsWith(q))) ville.push(i);
    else if (p.nom.includes(q) || p.ville.includes(q) || p.alias.some((x) => x.includes(q))) nom.push(i);
  });
  return [...exact, ...ville, ...nom].slice(0, max).map((i) => liste[i]);
}
const INDEX = new WeakMap();

/** Le nom dans la langue de l'application s'il existe, sinon celui d'OurAirports (Aeroports.nomLocal). */
export const nomLocal = (a, langue) => a.noms?.[langue === 'iw' ? 'he' : langue] ?? a.nom;

/** Un fuseau que le navigateur ne connaît pas rend false plutôt que d'échouer. */
export function fuseauConnu(fuseau) {
  try { new Intl.DateTimeFormat('en', { timeZone: fuseau }); return true; } catch { return false; }
}

const parties = (instant, fuseau) => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone: fuseau, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).formatToParts(instant).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));

/**
 * L'heure du billet « AAAA-MM-JJTHH:MM », à l'heure locale de l'aéroport, en
 * instant ; null si le fuseau est inconnu. Dans le trou du passage à l'heure
 * d'été, l'heure avance d'autant, comme LocalDateTime.atZone.
 */
export function instant(local, aeroport) {
  if (!fuseauConnu(aeroport.fuseau)) return null;
  const [d, t] = local.split('T');
  const [a, m, j] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const voulu = Date.UTC(a, m - 1, j, hh, mm);
  const decalage = (x) => {
    const p = parties(new Date(x), aeroport.fuseau);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - x;
  };
  // Le décalage avant le trou : un instant UTC tel que l'heure locale soit la voulue,
  // ou la première qui la suit.
  const avant = decalage(voulu - 12 * H);
  const apres = decalage(voulu + 12 * H);
  const essai1 = voulu - avant;
  if (decalage(essai1) === avant) return new Date(essai1);
  const essai2 = voulu - apres;
  if (decalage(essai2) === apres) return new Date(essai2);
  return new Date(voulu - avant);
}

export function verifier(plan) {
  if (plan.depart.iata === plan.arrivee.iata) return 'meme_aeroport';
  if (+plan.atterrissage <= +plan.decollage) return 'arrivee_avant_depart';
  if (+plan.atterrissage - +plan.decollage > DUREE_MAX) return 'trop_long';
  if (!fuseauConnu(plan.depart.fuseau) || !fuseauConnu(plan.arrivee.fuseau)) return 'fuseau_inconnu';
  return null;
}

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const vecteur = (lat, lon) => [Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat))];

/** Le relevé GPS compte s'il tombe entre le décollage et l'atterrissage prévus (Vol.releveUtilisable). */
export const releveUtilisable = (plan) => !!plan.releve && +plan.releve.instant > +plan.decollage && +plan.releve.instant < +plan.atterrissage;

/**
 * La position prévue à t : grand cercle, vitesse constante ; à l'aéroport hors du vol. Avec
 * un relevé GPS en vol : du départ au relevé, puis du relevé à l'arrivée (Vol.position).
 */
export function position(plan, t) {
  const r = plan.releve;
  if (releveUtilisable(plan)) {
    return +t > +r.instant
      ? arc(r.latitude, r.longitude, plan.arrivee.latitude, plan.arrivee.longitude, r.instant, plan.atterrissage, t)
      : arc(plan.depart.latitude, plan.depart.longitude, r.latitude, r.longitude, plan.decollage, r.instant, t);
  }
  return arc(plan.depart.latitude, plan.depart.longitude, plan.arrivee.latitude, plan.arrivee.longitude, plan.decollage, plan.atterrissage, t);
}

function arc(lat1, lon1, lat2, lon2, debut, fin, t) {
  const f = Math.min(1, Math.max(0, (+t - +debut) / (+fin - +debut)));
  const a = vecteur(lat1, lon1);
  const b = vecteur(lat2, lon2);
  const omega = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  const p = omega < 1e-9 ? a : a.map((_, i) => (Math.sin((1 - f) * omega) * a[i] + Math.sin(f * omega) * b[i]) / Math.sin(omega));
  return { instant: new Date(+t), latitude: deg(Math.asin(Math.min(1, Math.max(-1, p[2])))), longitude: deg(Math.atan2(p[1], p[0])) };
}

/** Haversine, rayon moyen de la Terre (Villes.distanceKm). */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

/** UTC + n, n = longitude / 15 arrondi (Vol.decalageNautique) : il choisit seulement le jour civil demandé au moteur. */
export const decalageNautique = (longitude) => Math.min(12, Math.max(-12, Math.round(longitude / 15)));

/** « Etc/GMT-3 » pour UTC+3 : le signe des fuseaux Etc est inversé (tzdb). */
export function fuseauNautique(longitude) {
  const n = decalageNautique(longitude);
  if (n === 0) return 'Etc/GMT';
  return n > 0 ? `Etc/GMT-${n}` : `Etc/GMT+${-n}`;
}

export const lieuSous = (p) => ({ nom: '', latitude: p.latitude, longitude: p.longitude, altitude: 0, fuseau: fuseauNautique(p.longitude) });

const isoDans = (t, fuseau) => new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
const decale = (iso, n) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n, 12)).toISOString().slice(0, 10);
};

/** Un jour du moteur en un point ; au sol, avant et après le vol, le même point revient : gardé. */
const memo = new Map();
function jourEn(lieu, iso) {
  const k = `${lieu.latitude},${lieu.longitude},${iso}`;
  if (!memo.has(k)) {
    if (memo.size > 5000) memo.clear();
    memo.set(k, jour(lieu, iso));
  }
  return memo.get(k);
}

/** Les zmanim du point pour la veille, le jour et le lendemain (jour du fuseau nautique). */
function occurrences(p, signaler = () => {}) {
  const lieu = lieuSous(p);
  const iso = isoDans(p.instant, lieu.fuseau);
  const parCle = {};
  for (const d of [decale(iso, -1), iso, decale(iso, 1)]) {
    for (const z of jourEn(lieu, d)) {
      if (z.statut === 'ok') (parCle[z.cle] ??= []).push(+z.instant);
      else signaler(z.statut === 'absent' ? 'absent' : 'erreur');
    }
  }
  return parCle;
}

const plusProche = (liste, cible) => {
  let m = null;
  for (const x of liste ?? []) if (m === null || Math.abs(x - cible) < Math.abs(m - cible)) m = x;
  return m;
};

/** Fausse position (Illinois) sur ]a, b] : t tel que zman(position(t)) = t, à la demi-seconde. */
function racine(plan, cle, a, oa, b, ob) {
  let ta = 0;
  let tb = b - a;
  let fa = oa - a;
  let fb = ob - b;
  let cote = 0;
  for (let i = 0; i < 60; i++) {
    const t = fb === fa ? (ta + tb) / 2 : tb - (fb * (tb - ta)) / (fb - fa);
    const inst = a + Math.trunc(t);
    const attendu = oa + Math.trunc((ob - oa) * (t / (b - a)));
    const o = plusProche(occurrences(position(plan, inst))[cle], attendu);
    if (o === null) return inst;
    const f = o - inst;
    if (Math.abs(f) <= TOLERANCE) return o;
    if ((f > 0) === (fa > 0)) {
      ta = t; fa = f;
      if (cote === -1) fb /= 2;
      cote = -1;
    } else {
      tb = t; fb = f;
      if (cote === 1) fa /= 2;
      cote = 1;
    }
  }
  return a + Math.trunc((ta + tb) / 2);
}

function calculerSeul(plan) {
  const reserves = new Set();
  const dec = +plan.decollage;
  const att = +plan.atterrissage;
  const instants = [];
  for (let t = dec - MARGE; t < dec; t += PAS_SOL) instants.push(t);
  for (let t = dec; t < att; t += PAS_VOL) instants.push(t);
  for (let t = att; t <= att + MARGE; t += PAS_SOL) instants.push(t);
  const echantillons = instants.map((t) => {
    const p = position(plan, t);
    const enVol = t >= dec && t <= att;
    if (enVol && Math.abs(p.latitude) > LATITUDE_HAUTE) reserves.add('haute_latitude');
    return { t, p, occ: occurrences(p, (r) => { if (enVol) reserves.add(r); }) };
  });
  const trouves = [];
  for (let i = 0; i < echantillons.length - 1; i++) {
    const a = echantillons[i];
    const b = echantillons[i + 1];
    const enVol = a.t < att && b.t > dec;
    for (const cle of CLES) {
      for (const o of a.occ[cle] ?? []) {
        // Sans vis-à-vis : la fenêtre de trois jours a glissé avec la date locale. Un zman
        // vraiment absent est signalé par le moteur (statut « absent »), pas ici.
        const apparie = plusProche(b.occ[cle], o);
        if (apparie === null || Math.abs(apparie - o) > APPARIEMENT) continue;
        const fa = o - a.t;
        const fb = apparie - b.t;
        const descend = fa > 0 && fb <= 0;
        const remonte = fa < 0 && fb >= 0;
        if (!descend && !remonte) continue;
        if (remonte && enVol) reserves.add('a_rebours');
        const t = racine(plan, cle, a.t, o, b.t, apparie);
        const p = position(plan, t);
        trouves.push({ cle, instant: new Date(t), latitude: p.latitude, longitude: p.longitude, ecartSiRetard: null });
      }
    }
  }
  trouves.sort((x, y) => x.instant - y.instant);
  const evenements = [];
  for (const e of trouves) if (!evenements.some((x) => x.cle === e.cle && Math.abs(x.instant - e.instant) < MIN)) evenements.push(e);
  return { plan, evenements, reserves, lignesDate: lignesDate(plan, echantillons), fiabilite: !releveUtilisable(plan) ? 'route_prevue' : plan.sourceReleve === 'direct' ? 'releve_direct' : 'releve_gps' };
}

/** Le passage du méridien de 180° en vol, et la date locale (fuseau nautique) de part et d'autre. */
function lignesDate(plan, echantillons) {
  const lignes = [];
  for (let i = 0; i < echantillons.length - 1; i++) {
    const a = echantillons[i].p;
    const b = echantillons[i + 1].p;
    if (+a.instant < +plan.decollage || +b.instant > +plan.atterrissage) continue;
    if (Math.abs(b.longitude - a.longitude) <= 180) continue;
    const avantLigne = 180 - Math.abs(a.longitude);
    const part = avantLigne / (avantLigne + 180 - Math.abs(b.longitude));
    const t = new Date(+a.instant + Math.trunc((b.instant - a.instant) * part));
    lignes.push({ instant: t, avant: isoDans(t, fuseauNautique(a.longitude)), apres: isoDans(t, fuseauNautique(b.longitude)) });
  }
  return lignes;
}

export const enVol = (calcul) => calcul.evenements.filter((e) => +e.instant >= +calcul.plan.decollage && +e.instant <= +calcul.plan.atterrissage);

/** Le calcul complet, avec l'écart de chaque horaire en vol si le départ glisse de 30 minutes. */
export function calculer(plan) {
  const base = calculerSeul(plan);
  // Avec un relevé GPS, le départ est passé : l'incertitude est l'arrivée, 30 min plus tard.
  const retard = calculerSeul(releveUtilisable(plan) ? { ...plan, atterrissage: new Date(+plan.atterrissage + RETARD) }
    : { ...plan, decollage: new Date(+plan.decollage + RETARD), atterrissage: new Date(+plan.atterrissage + RETARD) });
  base.evenements = base.evenements.map((e) => {
    if (+e.instant < +plan.decollage || +e.instant > +plan.atterrissage) return e;
    const memes = retard.evenements.filter((x) => x.cle === e.cle).map((x) => +x.instant);
    const proche = plusProche(memes, +e.instant);
    return { ...e, ecartSiRetard: proche !== null && Math.abs(proche - e.instant) <= APPARIEMENT ? proche - e.instant : null };
  });
  return base;
}

/**
 * La prière du moment et sa limite : ZmanimWidget.prochaine, ligne pour ligne.
 * horaires : { alot, szt_gra, chkia, chatsot_layla } en Date ou null.
 */
export function prochaine(horaires, maintenant) {
  const alot = horaires.alot;
  if (alot && +maintenant < +alot) {
    const veille = horaires.chatsot_layla ? new Date(+horaires.chatsot_layla - 24 * H) : null;
    return ['arvit', veille && +maintenant < +veille ? veille : null];
  }
  for (const [priere, limite] of [['chaharit', horaires.szt_gra], ['minha', horaires.chkia], ['arvit', horaires.chatsot_layla]]) {
    if (limite && +maintenant < +limite) return [priere, limite];
  }
  return ['arvit', null];
}

/** Les horaires que prochaine attend, pris sur la route (Vol.horaires). */
export function horaires(calcul, maintenant) {
  const ev = calcul.evenements;
  const alot = ev.filter((e) => e.cle === 'alot' && +e.instant <= +maintenant).at(-1)?.instant ?? null;
  const apres = alot ?? maintenant;
  const suivant = (cle) => ev.find((e) => e.cle === cle && +e.instant > +apres)?.instant ?? null;
  return { alot, szt_gra: suivant('szt_gra'), chkia: suivant('chkia'), chatsot_layla: suivant('chatsot_layla') };
}

/** La prière du moment en vol et sa limite ; null loin du vol (la fenêtre ne couvre plus). */
export function priere(calcul, maintenant) {
  if (+maintenant < +calcul.plan.decollage - COUVERT || +maintenant > +calcul.plan.atterrissage + COUVERT) return null;
  return prochaine(horaires(calcul, maintenant), maintenant);
}

/**
 * Chabbat, les fêtes et le compte du Omer en vol (VolCalendrier.kt, ligne pour
 * ligne) : la règle de JourAffiche.horaires appliquée aux chki'a et tsét de la
 * route. Le jour civil est celui du point sous l'avion (fuseau nautique).
 */
export function jalons(calcul, enIsrael, minutes) {
  const sortie = [];
  for (const e of enVol(calcul)) {
    if (e.cle !== 'chkia' && e.cle !== 'tset') continue;
    const iso = isoDans(e.instant, fuseauNautique(e.longitude));
    const aujourdhui = jourJuif(iso, enIsrael);
    const demain = jourJuif(decale(iso, 1), enIsrael);
    const jalon = (type, j, allumage = null, omer = 0) => ({
      type, instant: e.instant, date: j.date, chabbat: new Date(`${j.date}T12:00:00Z`).getUTCDay() === 6, fetes: j.fetes, omer, allumage,
      latitude: e.latitude, longitude: e.longitude,
    });
    if (e.cle === 'chkia' && demain.chome && !aujourdhui.chome) sortie.push(jalon('entree', demain, new Date(+e.instant - minutes * MIN)));
    if (e.cle === 'tset') {
      if (aujourdhui.chome && !demain.chome) sortie.push(jalon('sortie', aujourdhui));
      if (aujourdhui.chome && demain.chome) sortie.push(jalon('enchainement', demain));
      if (demain.omer > 0) sortie.push(jalon('omer', demain, null, demain.omer));
    }
  }
  return sortie;
}

// --- Le suivi en direct (SuiviVol.kt, 28/10) : option désactivée par défaut ---------------
// Ce qui part de l'appareil : l'indicatif du vol et la position estimée, arrondie au dixième de
// degré, vers le relais (tools/relais_vol) qui garde la clé d'OpenSky. Rien d'autre.

export const FRAICHEUR_MAX = 10 * MIN;

/** « ely 001 » → « ELY001 » ; null si ce n'est pas un indicatif OACI plausible. */
export function normaliserIndicatif(texte) {
  const x = texte.toUpperCase().replaceAll(' ', '');
  return /^[A-Z]{3}[0-9]{1,4}[A-Z]{0,2}$/.test(x) ? x : null;
}

/** ELY001 et ELY1 sont le même vol. */
export function memeIndicatif(a, b) {
  const parties = (x) => /^([A-Z]{3})0*([0-9]+)([A-Z]*)$/.exec(x.toUpperCase().trim())?.slice(1).join('/');
  const pa = parties(a);
  return pa !== undefined && pa === parties(b);
}

/**
 * Les raisons d'échec, en codes (SuiviVol.Raison) : l'écran les dit dans la langue de
 * l'interface (« vol_erreur_* »), jamais en français dans les trois langues (audit 1.390).
 */
export const Raison = {
  HORS_LIGNE: 'hors_ligne', QUOTA: 'quota', ILLISIBLE: 'illisible', POSITION_INVALIDE: 'position_invalide',
  RELAIS_ABSENT: 'relais_absent', SERVICE: 'service',
  serveur: (code) => (code === 429 ? 'quota' : `serveur_${code}`),
  /** Le code HTTP d'une raison serveur(), sinon null. */
  codeServeur: (raison) => (/^serveur_\d+$/.test(raison) ? +raison.slice(8) : null),
  /** Le message du relais (tools/relais_vol) : « opensky 429 », « opensky injoignable »… */
  duRelais: (message) => {
    const m = /^opensky (\d+)$/.exec(String(message).trim());
    return m ? Raison.serveur(+m[1]) : 'service';
  },
};

/** La réponse du relais (SuiviVol.lire) : { statut: 'trouve' | 'introuvable' | 'erreur', point, altitude, raison }. */
export function lireReponse(o, maintenant) {
  if (!o || typeof o !== 'object') return { statut: 'erreur', raison: Raison.ILLISIBLE };
  if (o.erreur) return { statut: 'erreur', raison: Raison.duRelais(o.erreur) };
  if (!o.trouve) return { statut: 'introuvable' };
  const instant = new Date(o.instant);
  const { latitude, longitude } = o;
  if (Number.isNaN(+instant) || typeof latitude !== 'number' || typeof longitude !== 'number') return { statut: 'erreur', raison: Raison.ILLISIBLE };
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { statut: 'erreur', raison: Raison.POSITION_INVALIDE };
  if (+maintenant - +instant > FRAICHEUR_MAX) return { statut: 'introuvable' };
  const altitude = [o.altitude_geo, o.altitude_baro].find((v) => typeof v === 'number') ?? null;
  return { statut: 'trouve', point: { instant, latitude, longitude }, altitude };
}

export const adresseRelais = (relais, indicatif, estime) =>
  `${relais.replace(/\/+$/, '')}/position?indicatif=${encodeURIComponent(indicatif)}&lat=${estime.latitude.toFixed(1)}&lon=${estime.longitude.toFixed(1)}`;

/** Le relais OpenSky, en HTTPS seulement ; [chercher] est fetch, remplaçable dans les tests. */
export async function positionEnDirect(relais, indicatif, estime, chercher = fetch, maintenant = new Date()) {
  if (!relais || !relais.startsWith('https://')) return { statut: 'erreur', raison: Raison.RELAIS_ABSENT };
  try {
    const r = await chercher(adresseRelais(relais, indicatif, estime), { credentials: 'omit', redirect: 'error' });
    if (r.status >= 500) return { statut: 'erreur', raison: Raison.serveur(r.status) };
    let o;
    try { o = await r.json(); } catch { return { statut: 'erreur', raison: Raison.ILLISIBLE }; }
    return lireReponse(o, maintenant);
  } catch {
    return { statut: 'erreur', raison: Raison.HORS_LIGNE };
  }
}

// --- La route d'un numéro de vol (RouteVol.kt, 28/10) : au toucher seulement ------------------
// Ce qui part de l'appareil : le numéro du vol, vers api.adsbdb.com (gratuit, sans compte ni clé).
// La réponse donne la compagnie, l'indicatif OACI et les escales connues ; pas les heures, qu'aucune
// source gratuite ne donne. Les routes d'adsbdb peuvent être anciennes : l'écran le dit.

export const ADSBDB = 'https://api.adsbdb.com/v0';

/** « ly 81 » → { code: 'LY', chiffres: '81', suffixe: '' } ; « ELY81 » → code OACI ELY ; null sinon. */
export function normaliserNumero(texte) {
  const m = /^([A-Z]{3}|[A-Z][A-Z0-9]|[0-9][A-Z])([0-9]{1,4})([A-Z]?)$/.exec(String(texte).toUpperCase().replace(/\s+/g, ''));
  return m ? { code: m[1], chiffres: m[2].replace(/^0+(?=\d)/, ''), suffixe: m[3] } : null;
}

/**
 * La réponse d'adsbdb (`response.flightroute`) → { statut: 'trouve', indicatif, compagnie, escales, de, vers }.
 * Le tronçon est celui qui part de `depart` (code IATA) s'il est donné ; sinon le premier.
 * `statut: 'autre_depart'` si le vol connu ne part pas de `depart`.
 */
export function lireRoute(o, depart = null) {
  const r = o?.response?.flightroute;
  if (!r || typeof r !== 'object') return { statut: 'introuvable' };
  const escales = [r.origin, r.midpoint, r.destination].map((x) => x?.iata_code).filter((x) => typeof x === 'string' && /^[A-Z0-9]{3}$/.test(x));
  if (escales.length < 2) return { statut: 'introuvable' };
  const base = { indicatif: normaliserIndicatif(String(r.callsign_icao ?? '')), compagnie: r.airline?.name ?? '', escales };
  const i = depart ? escales.indexOf(depart) : 0;
  if (i < 0 || i >= escales.length - 1) return { statut: 'autre_depart', ...base };
  return { statut: 'trouve', ...base, de: escales[i], vers: escales[i + 1] };
}

/**
 * Le numéro (IATA « LY81 » ou OACI « ELY81 ») → la route (lireRoute), ou { statut: 'introuvable' | 'erreur' }.
 * adsbdb refuse certains numéros IATA courts (« QF9 ») : on reprend alors avec l'indicatif OACI de
 * chaque compagnie qui porte ce code (adsbdb /airline).
 */
export async function chercherRoute(numero, depart = null, chercher = fetch) {
  const n = normaliserNumero(numero);
  if (!n) return { statut: 'invalide' };
  const demande = async (chemin) => {
    const r = await chercher(`${ADSBDB}/${chemin}`);
    if (r.status === 404 || r.status === 400) return null;
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { raison: Raison.serveur(r.status) });
    try { return await r.json(); } catch { throw Object.assign(new Error('JSON'), { raison: Raison.ILLISIBLE }); }
  };
  try {
    const direct = await demande(`callsign/${encodeURIComponent(n.code + n.chiffres + n.suffixe)}`);
    if (direct) return lireRoute(direct, depart);
    if (n.code.length !== 2) return { statut: 'introuvable' };
    const compagnies = (await demande(`airline/${encodeURIComponent(n.code)}`))?.response;
    for (const c of Array.isArray(compagnies) ? compagnies : []) {
      if (!/^[A-Z]{3}$/.test(c?.icao ?? '')) continue;
      const o = await demande(`callsign/${c.icao}${n.chiffres}${n.suffixe}`);
      if (o) return lireRoute(o, depart);
    }
    return { statut: 'introuvable' };
  } catch (e) {
    return { statut: 'erreur', raison: e.raison ?? Raison.HORS_LIGNE };
  }
}

// --- La saisie rapide (SaisieVol, 04/11) ------------------------------------------------
// Une phrase comme on la dirait, ou le texte collé d'un billet : tout est lu ici, sans réseau.

/** L'aéroport dont la ville (ou un autre nom) est exactement `q`, déjà plié ; null sinon (Aeroports.exact). */
export function exact(liste, q) {
  chercher(liste, 'x'); // construit l'index au besoin
  const idx = INDEX.get(liste);
  const i = idx.findIndex((p) => p.ville === q || p.alias.includes(q));
  return i < 0 ? null : liste[i];
}

export const COMPAGNIES = {
  'el al': 'LY', elal: 'LY', 'אל על': 'LY', arkia: 'IZ', 'ארקיע': 'IZ', israir: '6H', 'ישראייר': '6H',
  'air haifa': 'H9', 'air france': 'AF', transavia: 'TO', easyjet: 'U2', 'easy jet': 'U2', wizz: 'W6',
  'wizz air': 'W6', ryanair: 'FR', lufthansa: 'LH', swiss: 'LX', 'british airways': 'BA', klm: 'KL',
  delta: 'DL', united: 'UA', 'american airlines': 'AA', turkish: 'TK', 'turkish airlines': 'TK',
  aegean: 'A3', ita: 'AZ', 'ita airways': 'AZ', iberia: 'IB', 'air europa': 'UX', emirates: 'EK',
  etihad: 'EY', flydubai: 'FZ', 'brussels airlines': 'SN', austrian: 'OS', lot: 'LO', 'air canada': 'AC',
  ethiopian: 'ET', vueling: 'VY', volotea: 'V7', tap: 'TP', 'air portugal': 'TP', finnair: 'AY',
  sas: 'SK', aeroflot: 'SU', 'air india': 'AI', cathay: 'CX', qatar: 'QR', 'qatar airways': 'QR',
  eurowings: 'EW', pegasus: 'PC', bluebird: 'BZ', smartwings: 'QS', corsair: 'SS', 'air corsica': 'XK',
  'air senegal': 'HC', 'royal air maroc': 'AT', tunisair: 'TU', egyptair: 'MS', jet2: 'LS',
};

const PRINCIPAL = {
  paris: 'CDG', london: 'LHR', londres: 'LHR', 'new york': 'JFK', milan: 'MXP', milano: 'MXP',
  rome: 'FCO', roma: 'FCO', moscow: 'SVO', moscou: 'SVO', tokyo: 'NRT', berlin: 'BER',
  bruxelles: 'BRU', brussels: 'BRU', 'tel aviv': 'TLV', 'tel aviv yafo': 'TLV', chicago: 'ORD',
  washington: 'IAD', montreal: 'YUL', toronto: 'YYZ', istanbul: 'IST', stockholm: 'ARN',
  bangkok: 'BKK', dubai: 'DXB', lyon: 'LYS', nice: 'NCE', marseille: 'MRS', geneve: 'GVA',
  geneva: 'GVA', bale: 'BSL', basel: 'BSL', eilat: 'ETM', 'buenos aires': 'EZE', 'sao paulo': 'GRU',
  'los angeles': 'LAX', miami: 'MIA', venise: 'VCE', venice: 'VCE', barcelone: 'BCN', madrid: 'MAD',
  athenes: 'ATH', athens: 'ATH', kiev: 'KBP', kyiv: 'KBP', varsovie: 'WAW', warsaw: 'WAW',
  'פריז': 'CDG', 'לונדון': 'LHR', 'ניו יורק': 'JFK', 'תל אביב': 'TLV', 'אילת': 'ETM', 'ליון': 'LYS',
  'מרסיי': 'MRS', 'ניס': 'NCE', 'רומא': 'FCO', 'מילאנו': 'MXP', 'ברלין': 'BER',
};

const MOTS = new Set(['les', 'des', 'vol', 'par', 'sur', 'pour', 'une', 'est', 'and', 'the', 'for', 'via', 'dep', 'arr', 'seat', 'gate',
  'you', 'are', 'air', 'new', 'bus', 'car', 'jet', 'fly', 'pax', 'ref', 'tax', 'fee', 'eur', 'usd', 'ils',
  'son', 'ses', 'mon', 'mes', 'ton', 'nos', 'vos', 'aux', 'pas', 'que', 'qui', 'oui', 'non', 'lun', 'mar', 'mer',
  'jeu', 'ven', 'sam', 'dim', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'jan', 'fev', 'feb', 'avr', 'apr',
  'mai', 'may', 'jun', 'jul', 'aou', 'aug', 'sep', 'oct', 'nov', 'dec', 'bag', 'row', 'pnr', 'age', 'end', 'all']);

const MOIS = {
  janvier: 1, janv: 1, jan: 1, january: 1, 'ינואר': 1, fevrier: 2, fevr: 2, fev: 2, february: 2, feb: 2, 'פברואר': 2,
  mars: 3, march: 3, 'מרץ': 3, 'מרס': 3, avril: 4, avr: 4, april: 4, apr: 4, 'אפריל': 4, mai: 5, may: 5, 'מאי': 5,
  juin: 6, june: 6, jun: 6, 'יוני': 6, juillet: 7, juil: 7, july: 7, jul: 7, 'יולי': 7, aout: 8, august: 8, aug: 8, 'אוגוסט': 8,
  septembre: 9, sept: 9, sep: 9, september: 9, 'ספטמבר': 9, octobre: 10, oct: 10, october: 10, 'אוקטובר': 10,
  novembre: 11, nov: 11, november: 11, 'נובמבר': 11, decembre: 12, dec: 12, december: 12, 'דצמבר': 12,
};

// 1 = lundi … 7 = dimanche (ISO), comme DayOfWeek.
const JOURS = {
  lundi: 1, monday: 1, 'שני': 1, mardi: 2, tuesday: 2, 'שלישי': 2, mercredi: 3, wednesday: 3, 'רביעי': 3,
  jeudi: 4, thursday: 4, 'חמישי': 4, vendredi: 5, friday: 5, 'שישי': 5, samedi: 6, saturday: 6, 'שבת': 6,
  dimanche: 7, sunday: 7, 'ראשון': 7,
};

const VERS = new Set(['vers', 'pour', 'a', 'to', 'destination', 'arrivee', 'arrival', 'arr', '→', '->']);
const DE = new Set(['de', 'depuis', 'from', 'depart', 'departure', 'dep']);

const pad = (n) => String(n).padStart(2, '0');
const iso = (a, m, j) => {
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j ? `${a}-${pad(m)}-${pad(j)}` : null;
};
const plusJours = (isoJour, n) => {
  const [a, m, j] = isoJour.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const jourIso = (isoJour) => { const [a, m, j] = isoJour.split('-').map(Number); return ((new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7) + 1; };

function prochaineDate(aujourdhui, mois, jour) {
  const an = Number(aujourdhui.slice(0, 4));
  const d = iso(an, mois, jour);
  if (!d) return null;
  return d < plusJours(aujourdhui, -7) ? iso(an + 1, mois, jour) : d;
}

/** Les heures, dans l'ordre ; celles de l'embarquement ou de la porte sont écartées (SaisieVol.heures). */
export function heuresPhrase(leger) {
  const r = /(?<![0-9])([01]?[0-9]|2[0-3])(?:\s?h\s?([0-5][0-9])?|:([0-5][0-9])(?:\s?(am|pm))?|\s?(am|pm))(?![0-9])|(?<![a-zא-ת])(?:בשעה|a|à|at|vers)\s([01]?[0-9]|2[0-3])(?![0-9/:.]|\s?h|\s?am|\s?pm)/g;
  const res = [];
  for (const m of leger.matchAll(r)) {
    const avant = leger.slice(Math.max(0, m.index - 24), m.index);
    if (/boarding|embarquement|gate|porte|עלייה|שער|fermeture|closes/.test(avant)) continue;
    if (m[6]) { res.push(`${pad(Number(m[6]))}:00`); continue; }
    let h = Number(m[1]);
    const min = Number(m[2] || m[3] || 0);
    const apm = m[4] || m[5];
    if (apm === 'pm' && h < 12) h += 12;
    if (apm === 'am' && h === 12) h = 0;
    res.push(`${pad(h)}:${pad(min)}`);
  }
  return res;
}

/**
 * « El Al Lyon TLV demain à 11h » → { numero, compagnie, depart, arrivee (codes IATA), date
 * « AAAA-MM-JJ », heureDepart « HH:MM », heureArrivee, dateArrivee } (SaisieVol.lire).
 */
export function lirePhrase(texte, liste, aujourdhui) {
  const pl = plier(String(texte).replace(/→/g, ' → ').replace(/->/g, ' → ').replace(/✈/g, ' '));
  const mots = pl.split(' ').filter(Boolean);
  const leger = String(texte).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  let numero = null;
  const reNum = /(?<![a-z0-9])([a-z]{2,3}|[a-z][0-9]|[0-9][a-z])\s?([0-9]{1,4})([a-z]?)(?![a-z0-9:h/])(?!\s?(?:jan|fe|mar|av|ap|mai|may|juin|jun|juil|jul|ao|aug|sep|oct|nov|dec))/g;
  for (const m of pl.matchAll(reNum)) {
    const code = m[1];
    if (['a', 'le', 'la', 'de', 'du', 'au', 'et', 'on', 'at', 'the'].includes(code) || MOTS.has(code)) continue;
    const n = `${code}${m[2]}${m[3]}`.toUpperCase();
    if (normaliserNumero(n)) { numero = n; break; }
  }
  const avecMot = (mot) => new RegExp(`(^|\\s)${mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(pl);
  const compagnie = (numero && normaliserNumero(numero).code.length === 2 ? normaliserNumero(numero).code : null)
    ?? Object.entries(COMPAGNIES).sort((a, b) => b[0].length - a[0].length).find(([nom]) => avecMot(plier(nom)))?.[1] ?? null;

  // Les aéroports : groupes de trois, deux puis un mot ; « de », « vers », מ et ל donnent le rôle.
  const parIata = (c) => liste.find((a) => a.iata === c) ?? null;
  const trouver = (gram, n) => {
    if (gram.length < 3) return null;
    if (n === 1 && (MOTS.has(gram) || VERS.has(gram) || DE.has(gram) || gram in MOIS || gram in JOURS)) return null;
    if (PRINCIPAL[gram]) { const a = parIata(PRINCIPAL[gram]); if (a) return a; }
    if (n === 1 && gram.length === 3 && /^[a-z]{3}$/.test(gram)) { const a = parIata(gram.toUpperCase()); if (a) return a; }
    return exact(liste, gram);
  };
  const trouves = [];
  const pris = new Array(mots.length).fill(false);
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= mots.length; i++) {
      if (pris.slice(i, i + n).some(Boolean)) continue;
      let gram = mots.slice(i, i + n).join(' ');
      let role = 0;
      let a = trouver(gram, n);
      if (!a && (gram.startsWith('מ') || gram.startsWith('ל'))) {
        a = trouver(gram.slice(1), n);
        if (a) role = gram.startsWith('ל') ? 1 : -1;
        gram = gram.slice(1);
      }
      if (!a) continue;
      if (numero && gram.toUpperCase() === numero) continue;
      const avant = mots[i - 1];
      if (role === 0) role = VERS.has(avant) ? 1 : DE.has(avant) ? -1 : 0;
      for (let k = i; k < i + n; k++) pris[k] = true;
      if (!trouves.some((t) => t.a === a)) trouves.push({ a, pos: i, role });
    }
  }
  trouves.sort((x, y) => x.pos - y.pos);
  const dep = trouves.find((t) => t.role === -1) ?? trouves.find((t) => t.role === 0);
  const arr = trouves.find((t) => t.role === 1 && t !== dep) ?? trouves.find((t) => t !== dep && t.role === 0);

  // Les dates.
  const dates = [];
  const ajoute = (pos, d) => { if (d) dates.push([pos, d]); };
  let m = /apres demain|after tomorrow|מחרתיים/.exec(pl);
  if (m) ajoute(m.index, plusJours(aujourdhui, 2));
  if (!dates.length && (m = /(^|\s)(demain|tomorrow|מחר)(\s|$)/.exec(pl))) ajoute(m.index, plusJours(aujourdhui, 1));
  if ((m = /(^|\s)(aujourd hui|aujourdhui|today|ce soir|tonight|היום|הערב)(\s|$)/.exec(pl))) ajoute(m.index, aujourdhui);
  for (const x of leger.matchAll(/(?<![0-9])([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?![0-9])/g)) ajoute(x.index, iso(+x[1], +x[2], +x[3]));
  for (const x of leger.matchAll(/(?<![0-9:./])([0-9]{1,2})[/.]([0-9]{1,2})(?:[/.]([0-9]{2,4}))?(?![0-9:])/g)) {
    const an = x[3] ? (Number(x[3]) < 100 ? 2000 + Number(x[3]) : Number(x[3])) : null;
    ajoute(x.index, an ? iso(an, +x[2], +x[1]) : prochaineDate(aujourdhui, +x[2], +x[1]));
  }
  for (const x of pl.matchAll(/(?<![0-9])([0-9]{1,2})(?:er)?\s+([a-zא-ת]+)(?:\s+([0-9]{4}))?/g)) {
    const mo = MOIS[x[2]] ?? MOIS[x[2].replace(/^ב/, '')];
    if (!mo) continue;
    ajoute(x.index, x[3] ? iso(+x[3], mo, +x[1]) : prochaineDate(aujourdhui, mo, +x[1]));
  }
  for (const x of pl.matchAll(/([a-z]+)\s+([0-9]{1,2})(?![0-9:h])(?:\s+([0-9]{4}))?/g)) {
    const mo = MOIS[x[1]];
    if (!mo) continue;
    ajoute(x.index, x[3] ? iso(+x[3], mo, +x[2]) : prochaineDate(aujourdhui, mo, +x[2]));
  }
  if (!dates.length) mots.forEach((mot, i) => {
    const j = JOURS[mot] ?? JOURS[mot.replace(/^ב/, '')];
    if (!j) return;
    if (/[א-ת]/.test(mot) && mot !== 'שבת' && mot !== 'בשבת' && !['יום', 'ביום'].includes(mots[i - 1])) return;
    dates.push([i, plusJours(aujourdhui, (j - jourIso(aujourdhui) + 7) % 7)]);
  });
  const tri = [...new Set(dates.sort((x, y) => x[0] - y[0]).map((x) => x[1]))];
  const heures = heuresPhrase(leger);
  return {
    numero, compagnie, depart: dep?.a.iata ?? null, arrivee: arr?.a.iata ?? null,
    date: tri[0] ?? null, dateArrivee: tri[1] ?? null, heureDepart: heures[0] ?? null, heureArrivee: heures[1] ?? null,
  };
}

/** La durée estimée, en ms : distance à 820 km/h + 30 min, au quart d'heure (SaisieVol.dureeEstimee). */
export function dureeEstimee(a, b) {
  const minutes = Math.round(distanceKm(a.latitude, a.longitude, b.latitude, b.longitude) / 820 * 60 + 30);
  return Math.floor((minutes + 7) / 15) * 15 * MIN;
}

/** Une phrase sans rien de reconnu. */
export const phraseVide = (p) => !p.numero && !p.depart && !p.arrivee && !p.date && !p.heureDepart;
