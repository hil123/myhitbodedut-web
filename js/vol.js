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
  const alias = (a) => (a.alias ?? []).map(plier);
  const exact = liste.filter((a) => plier(a.iata) === q);
  const ville = liste.filter((a) => plier(a.ville).startsWith(q) || alias(a).some((x) => x.startsWith(q)));
  const nom = liste.filter((a) => plier(a.nom).includes(q) || plier(a.ville).includes(q) || alias(a).some((x) => x.includes(q)));
  return [...new Set([...exact, ...ville, ...nom])].slice(0, max);
}

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
