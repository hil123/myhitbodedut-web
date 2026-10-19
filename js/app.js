// L'application : l'accueil (MainActivity), la séance (SessionActivity),
// le bravo (CelebrationActivity), la musique (MusicActivity) et un premier
// écran de réglages. Les écrans suivants arrivent par étapes ; ce qui
// n'existe pas encore est montré, mais inerte (classe « a-venir »).

import { chargeTraduction, formate, langueInitiale, LANGUES } from './i18n.js';
import { Anneaux, CycleTehilim, DureeSeance, JaugeSemaine, LibraryRules, Plaque, Reference, Salutation, SiddurMoment, SignetsSiddur, SourceDuJour, Parcours } from './regles.js';
import { ART_DU_MOMENT, ChizukBag, ChizukRules } from './chizuk.js';
import { AMBIANCES, arreter as arreteAmbiance, jouer as joueAmbiance } from './ambiance.js';
import { DanseMesure } from './seance.js';
import { creeStore, memoire } from './store.js';
import { isoLocal } from './calendrier.js';
import { JERUSALEM_GEONAMES, RAPPELS_TEFILA, dansIsrael, USAGES_LEVANA, aJerusalem, calendrier, jour as jourJuif, jourDeLaPriere, levana, rappelsTefila, usageLevana } from './calendrier-juif.js';
import { conditionsPour, index as indexAjouts, libelleJour, vrai as ajoutVrai } from './siddur-jour.js';
import * as Paliers from './paliers.js';
import * as Trophees from './trophees.js';
import { FORMES, ICONES } from './trophees-formes.js';
import { pour as halakhotPour, recherche as rechercheHalakha, source as sourceHalakha } from './halakha.js';
import { pour as yalkutPour, recherche as rechercheYalkut, source as sourceYalkut, texteCarte, titreCarte } from './yalkut.js';
import { ajouts as ajoutsDuJour, dateHilloula, debutMoisHebreu, hilloulotPour, lienArticle, rechercheHilloula, horaires, illustration as illustrationDuJour, lienHalakha, lienHyomi, momentDuSiddour, moisHebreuVoisin, semaines, semainesHebreu } from './jour-affiche.js';
import { ALLUMAGES, heure as heureZman, jour as zmanimDuJour } from './zmanim.js';

// --- Stockage ---------------------------------------------------------------
function stockageDuNavigateur() {
  try {
    const s = window.localStorage;
    s.setItem('__essai', '1');
    s.removeItem('__essai');
    return s;
  } catch {
    return memoire();
  }
}
const store = creeStore(stockageDuNavigateur());

// Safari peut effacer ce qu'un site garde ; une application de l'écran
// d'accueil en est exemptée, et persist() le demande explicitement.
navigator.storage?.persist?.().catch(() => {});

// --- Petits outils de construction du DOM ---------------------------------------
function h(tag, attrs = {}, ...enfants) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat()) {
    if (e === null || e === undefined || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return el;
}
const SVG = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// --- Les sujets (Theme.kt), dans l'ordre de la liste Android ----------------------
const SUJETS = ['emotions', 'gratitude', 'decisions', 'famille', 'zivoug', 'parnassa', 'avoda', 'difficultes', 'croissance', 'autre'];

// --- Le hassid (Character.kt) : stable sur une journée, change le lendemain -------
const JOIE = ['char_dancing_joy', 'char_dancing', 'char_guitar', 'char_thumbs_up', 'char_open_arms'];
function duJour(pool, sel) {
  const [a, m, j] = store.today().split('-').map(Number);
  const jourEpoque = Math.round(Date.UTC(a, m - 1, j) / 86400000) + sel * 7;
  return pool[((jourEpoque % pool.length) + pool.length) % pool.length];
}
const APPEL = ['char_praise', 'char_pointing', 'char_walking', 'char_tehilim', 'char_thinking', 'char_welcome', 'char_open_arms'];
const PENDANT = ['char_arms_raised', 'char_praying', 'char_standing_back', 'char_praise'];
// Au centre de l'anneau : tant que la hitbodedout du jour reste à faire, celui qui accueille (13/10).
const salutation = (fait) => (fait ? duJour(JOIE, 3) : 'char_welcome');
const joie = () => duJour(JOIE, 3);
const appel = () => duJour(APPEL, 1);
const pendant = () => duJour(PENDANT, 2);

// --- État de l'application -----------------------------------------------------------
let tr;
let morceaux = [];
let tikkun = null;
let chizuk = null;
// L'onglet d'ouverture (14/10) : Aujourd'hui ou Textes ; Zmanim s'ouvre par-dessus au démarrage.
let onglet = store.ouverture() === 'textes' ? 'textes' : 'aujourdhui';
/** Les jours faits dont on a touché la case : leur durée remplace le ✓ (14/10). */
const joursMontres = new Set();
const app = document.getElementById('app');

function appliqueApparence() {
  const racine = document.documentElement;
  racine.dataset.mode = store.modeApparence();
  racine.dataset.fond = store.fond();
  racine.dataset.accent = store.accent();
  racine.lang = tr.langue;
  racine.dir = tr.rtl ? 'rtl' : 'ltr';
}

// --- Feuille de choix : ce que sont les AlertDialog d'Android -----------------------
function feuille(titre, construire, apres = null) {
  const voile = h('div', { class: 'voile', role: 'presentation' });
  // Le focus revient où il était ; Échap ferme ; Tab reste dans la feuille (audit du 16/10).
  const avant = document.activeElement;
  const fermer = () => { if (!voile.isConnected) return; voile.remove(); if (avant?.isConnected) avant.focus(); apres?.(); };
  const f = h('div', { class: 'feuille', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre },
    h('h2', {}, titre));
  construire(f, fermer);
  voile.addEventListener('click', (e) => { if (e.target === voile) fermer(); });
  voile.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); fermer(); return; }
    if (e.key !== 'Tab') return;
    const l = [...f.querySelectorAll('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!l.length) return;
    const premier = l[0], dernier = l[l.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  });
  voile.append(f);
  document.body.append(voile);
  (f.querySelector('textarea, input') ?? f.querySelector('button'))?.focus();
}

function choisirDans(titre, options, courante, onChoisi) {
  feuille(titre, (f, fermer) => {
    options.forEach((o, i) => f.append(h('button', {
      class: 'choix', role: 'menuitemradio', 'aria-checked': String(i === courante),
      onclick: () => { fermer(); onChoisi(i); },
    }, o)));
  });
}

/** DureeSeance.choisir : les durées proposées, puis « Durée réglable… ». */
function choisirDuree(onChoisi, titre = tr.t('settings_target')) {
  const libelles = [...DureeSeance.PROPOSEES.map((m) => tr.duree(m)), tr.t('duration_custom')];
  const i = DureeSeance.PROPOSEES.indexOf(store.targetMinutes());
  choisirDans(titre, libelles, i, (choix) => {
    if (choix < DureeSeance.PROPOSEES.length) onChoisi(DureeSeance.PROPOSEES[choix]);
    else saisirDuree(onChoisi);
  });
}

function saisirDuree(onChoisi) {
  feuille(tr.t('duration_custom_title'), (f, fermer) => {
    const champ = h('input', {
      type: 'number', inputmode: 'numeric', min: DureeSeance.MIN, max: DureeSeance.MAX,
      placeholder: tr.t('duration_custom_hint'), value: store.targetMinutes(),
    });
    const valider = () => {
      const m = DureeSeance.lire(champ.value);
      fermer();
      if (m !== null) onChoisi(m);
    };
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });
    f.append(champ, h('p', { class: 'indice' }, tr.t('duration_custom_hint')),
      h('div', { class: 'actions' },
        h('button', { onclick: fermer }, tr.t('action_back')),
        h('button', { onclick: valider }, tr.t('action_save'))));
    setTimeout(() => champ.select(), 0);
  });
}

function choisirSujet() {
  const libelles = [tr.t('session_theme_none_short'), ...SUJETS.map((c) => tr.t(`theme_${c}`))];
  const courant = store.sessionTheme();
  choisirDans(tr.t('session_theme_title'), libelles, courant ? SUJETS.indexOf(courant) + 1 : 0, (i) => {
    store.setSessionTheme(i === 0 ? null : SUJETS[i - 1]);
    rendre();
  });
}

// --- La musique -----------------------------------------------------------------------
// Un seul élément <audio>, gardé d'un écran à l'autre. C'est un élément
// média et non Web Audio : iOS coupe Web Audio écran verrouillé, et ne
// laisse continuer que la lecture d'un élément média.
const lecteur = new Audio();
lecteur.preload = 'none';
let enEcoute = null;
lecteur.addEventListener('ended', () => { enEcoute = null; rendre(); });
lecteur.addEventListener('pause', () => { if (!lecteur.ended) { enEcoute = null; rendre(); } });

/**
 * iOS ne laisse pas une page régler le volume : il reste aux boutons du
 * téléphone. La propriété accepte pourtant la valeur et la relit sans rien
 * changer au son (essai sur iPhone, 29/09) : c'est donc l'appareil qu'on
 * reconnaît. Un iPad récent se présente comme un Mac tactile.
 */
const surIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const volumeReglable = !surIOS && (() => {
  const a = new Audio();
  a.volume = 0.5;
  return a.volume === 0.5;
})();

const titreMorceau = (m) => tr.t(m.titre);
const morceauChoisi = () => morceaux.find((m) => m.id === store.musicTrackId()) ?? morceaux[0] ?? null;

/**
 * Un message bref en bas de l'écran (le Toast d'Android), qui ne bloque
 * rien : une boîte d'alerte interromprait la séance.
 */
// Un message à la fois : le suivant attend la fin du précédent au lieu de l'effacer (audit du 16/10).
let finToast = 0;
function signale(texte) {
  const attente = finToast - Date.now();
  if (attente > 0 && document.querySelector('.toast')) {
    finToast += 3500;
    setTimeout(() => montreToast(texte), attente);
    return;
  }
  finToast = Date.now() + 3500;
  montreToast(texte);
}
function montreToast(texte) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast', role: 'status' }, texte);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

/**
 * Une lecture qui n'a pas pu partir. Une lecture interrompue par un arrêt
 * voulu (séance close, autre morceau) n'en est pas une : Safari la signale
 * pourtant comme un échec (AbortError).
 */
function echecLecture(e) {
  if (e?.name === 'AbortError') return;
  signale(tr.t('music_play_failed'));
}

function metadonnees(m) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: titreMorceau(m), artist: 'MyHitbodedut',
    artwork: [{ src: 'icones/icon-512.png', sizes: '512x512', type: 'image/png' }],
  });
}

function ecouter(m) {
  if (enEcoute === m.id) { lecteur.pause(); enEcoute = null; rendre(); return; }
  lecteur.src = m.fichier;
  lecteur.loop = false;
  if (volumeReglable) lecteur.volume = store.musicVolume() / 100;
  enEcoute = m.id;
  metadonnees(m);
  lecteur.play().catch((e) => { enEcoute = null; rendre(); echecLecture(e); });
  rendre();
}

// --- Rendu : l'accueil ------------------------------------------------------------------
// Les trois anneaux (Anneaux.kt, AnneauxDessin.kt) : jour au centre, puis
// semaine, puis série. Un toucher met un anneau en avant ; la légende suit.
let anneauEnAvant = null;

/** Un dessin rendu lisible : une image et sa description, au lieu de aria-hidden. */
function decrire(svg, texte) {
  svg.removeAttribute('aria-hidden');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', texte);
  return svg;
}

function anneaux(etat) {
  const EPAISSEUR = 8 / 2.36; // 8 dp sur 236 dp
  const ECART = 3 / 2.36;
  const svg = s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' });
  const ordre = [etat.serie, etat.semaine, etat.jour]; // de l'extérieur vers le centre
  ordre.forEach((a, rang) => {
    const enAvant = anneauEnAvant === null || anneauEnAvant === a.quel;
    const trait = anneauEnAvant === a.quel ? EPAISSEUR * 1.3 : EPAISSEUR;
    const r = 50 - rang * (EPAISSEUR + ECART) - EPAISSEUR / 2;
    const tour = 2 * Math.PI * r;
    const g = s('g', { class: `anneau anneau-${a.quel}${enAvant ? '' : ' efface'}`, 'data-anneau': a.quel });
    g.append(s('circle', { class: 'piste', cx: 50, cy: 50, r, fill: 'none', 'stroke-width': trait }));
    if (a.tours >= 1) g.append(s('circle', { class: 'arc plein', cx: 50, cy: 50, r, fill: 'none', 'stroke-width': trait }));
    if (a.reste > 0) {
      const arc = s('circle', {
        class: `arc${a.tours >= 1 ? ' second-tour' : ''}`, cx: 50, cy: 50, r, fill: 'none', 'stroke-width': trait, 'stroke-linecap': 'round',
        'stroke-dasharray': tour, 'stroke-dashoffset': tour, transform: 'rotate(-90 50 50)',
      });
      g.append(arc);
      requestAnimationFrame(() => requestAnimationFrame(() => arc.setAttribute('stroke-dashoffset', tour * (1 - a.reste))));
    }
    // Une bande transparente plus large que le trait : le doigt n'est pas une pointe.
    g.append(s('circle', { class: 'prise', cx: 50, cy: 50, r, fill: 'none', 'stroke-width': EPAISSEUR + ECART, stroke: 'transparent' }));
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      const quel = anneauEnAvant === a.quel ? null : a.quel;
      mettreEnAvantSurPlace(quel);
      // Toucher un anneau montre sa face au centre ; le relâcher ramène le hassid.
      tournerPlaque(quel ? Plaque.pour(quel) : 'hassid');
    });
    svg.append(g);
  });
  return svg;
}

/** La légende sous les anneaux : la semaine, ou l'anneau mis en avant. */
function legendeAnneaux(etat, progression) {
  if (anneauEnAvant === 'jour') {
    return tr.t(etat.jour.atteint ? 'ring_day_reached' : 'ring_day_detail', tr.duree(etat.jour.fait), tr.duree(etat.jour.objectif));
  }
  if (anneauEnAvant === 'serie') {
    return tr.t(etat.serie.atteint ? 'ring_streak_reached' : 'ring_streak_detail', etat.serie.fait, etat.serie.objectif);
  }
  return tr.p('week_gauge', progression.faits, progression.faits, progression.dus);
}

/**
 * Le saut du hassid, [fois] de suite. Sur l'image du rendu en cours : un
 * nouveau rendu la remplace, et l'ancienne sautait hors de l'écran.
 */
function sauter(fois) {
  const img = app.querySelector('.plaque img');
  if (!img) return;
  img.style.setProperty('--sauts', String(fois));
  img.classList.remove('salut');
  void img.offsetWidth; // relance l'animation CSS
  img.classList.add('salut');
}

// --- Le centre des anneaux (Plaque.kt) : le hassid, puis vos chiffres ---------
let facePlaque = 'hassid';
let minuteurPlaque = null;
const sansMouvement = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Le chiffre d'une face, la façon de l'écrire, et ce qu'il compte. */
function contenuFace(face) {
  const etat = store.anneaux();
  const nombre = (n) => String(n);
  switch (face) {
    case 'jour': return { cible: etat.jour.fait, texte: (n) => tr.duree(n), legende: tr.t('plaque_jour', tr.duree(etat.jour.objectif)) };
    case 'semaine': return { cible: etat.semaine.fait, texte: (n) => tr.t('plaque_semaine_valeur', n, etat.semaine.objectif), legende: tr.t('plaque_semaine') };
    case 'serie': return { cible: etat.serie.fait, texte: nombre, legende: tr.p('plaque_serie', etat.serie.fait, etat.serie.fait, etat.serie.objectif) };
    case 'meilleure': return { cible: store.meilleureSerie(), texte: nombre, legende: tr.t('plaque_meilleure') };
    case 'total': return { cible: store.totalMinutes(), texte: (n) => tr.duree(n), legende: tr.t('plaque_total') };
    case 'jours': {
      const jours = store.joursFaits().size;
      return { cible: jours, texte: nombre, legende: tr.p('plaque_jours', jours, jours) };
    }
    default: return { cible: Plaque.moyenne(store.totalMinutes(), store.joursFaits().size), texte: (n) => tr.duree(n), legende: tr.t('plaque_moyenne') };
  }
}

/** Le chiffre monte depuis zéro. */
function compter(el, cible, texte) {
  if (cible <= 0 || sansMouvement()) return;
  const debut = performance.now();
  const pas = (t) => {
    const f = Math.min(1, (t - debut) / 650);
    el.textContent = texte(Math.round(cible * (1 - (1 - f) ** 2)));
    if (f < 1 && el.isConnected) requestAnimationFrame(pas);
  };
  el.textContent = texte(0);
  requestAnimationFrame(pas);
}

/** Remplit la plaque avec la face courante. */
function remplirPlaque(btn) {
  if (facePlaque === 'hassid') {
    btn.setAttribute('aria-label', tr.t('rings_character_hint'));
    btn.replaceChildren(h('img', { src: `img/${salutation(store.record()?.faite === true)}.webp`, alt: '' }));
    return;
  }
  const c = contenuFace(facePlaque);
  const anneau = Plaque.anneau(facePlaque);
  const valeur = h('div', { class: `face-valeur${anneau ? ` valeur-${anneau}` : ''}` }, c.texte(c.cible));
  btn.setAttribute('aria-label', `${c.texte(c.cible)} ${c.legende}`);
  btn.replaceChildren(h('div', { class: 'face' }, valeur, h('div', { class: 'face-legende' }, c.legende)));
  compter(valeur, c.cible, c.texte);
}

/** Attend la fin d'une animation CSS de cet élément, pas de ses enfants. */
function apresAnimation(el, nom, suite) {
  const ecoute = (e) => {
    if (e.target !== el || e.animationName !== nom) return;
    el.removeEventListener('animationend', ecoute);
    suite();
  };
  el.addEventListener('animationend', ecoute);
}

/** La plaque tourne comme une pièce ; à mi-tour, la face change. */
function tournerPlaque(vers) {
  clearTimeout(minuteurPlaque);
  if (vers !== 'hassid') minuteurPlaque = setTimeout(() => tournerPlaque('hassid'), Plaque.RETOUR_MS);
  if (vers === facePlaque) return;
  const btn = app.querySelector('.plaque');
  if (!btn) { facePlaque = vers; return; }
  const changer = () => {
    facePlaque = vers;
    remplirPlaque(btn);
    mettreEnAvantSurPlace(Plaque.anneau(vers));
    btn.classList.remove('sortie');
    if (sansMouvement()) return;
    btn.classList.add('entree');
    apresAnimation(btn, 'plaque-entree', () => {
      btn.classList.remove('entree');
      if (vers === 'hassid') sauter(1);
    });
  };
  if (sansMouvement()) { changer(); return; }
  btn.classList.remove('entree');
  btn.classList.add('sortie');
  apresAnimation(btn, 'plaque-sortie', changer);
}

function plaqueAccueil() {
  const btn = h('button', { class: 'plaque', type: 'button', onclick: () => {
    navigator.vibrate?.(8);
    tournerPlaque(Plaque.suivante(facePlaque));
  } });
  remplirPlaque(btn);
  return btn;
}

/** Met un anneau en avant sans refaire le rendu, qui relancerait le remplissage. */
function mettreEnAvantSurPlace(quel) {
  anneauEnAvant = quel;
  app.querySelectorAll('.jauge .anneau').forEach((g) =>
    g.classList.toggle('efface', quel !== null && g.dataset.anneau !== quel));
  const legende = app.querySelector('.jauge-legende');
  if (legende) {
    legende.className = `jauge-legende${quel ? ` legende-${quel}` : ''}`;
    legende.textContent = legendeAnneaux(store.anneaux(), JaugeSemaine.progression(store.currentWeek()));
  }
}

/**
 * La fin du remplissage, quand l'accueil apparaît (MainActivity.apresRemplissage) :
 * un anneau qui vient de se fermer est fêté une fois, sinon le hassid salue.
 */
let accueilAnime = false;
function animerAccueil() {
  if (!app.querySelector('.jauge')) return;
  const etat = store.anneaux();
  const jour = store.today();
  const nouveaux = Anneaux.aFeter(etat, jour, store.anneauxFetes());
  store.setAnneauxFetes(Anneaux.marques(etat, jour));
  if (nouveaux.length === 0) { if (facePlaque === 'hassid') sauter(1); return; }
  // L'anneau fermé passe devant et sa face s'affiche le temps de la fête.
  const face = Plaque.pour(nouveaux[0]);
  const jauge = app.querySelector('.jauge');
  jauge.classList.remove('fete');
  void jauge.offsetWidth;
  jauge.classList.add('fete');
  mettreEnAvantSurPlace(nouveaux[0]);
  tournerPlaque(face);
  setTimeout(() => { if (facePlaque === face) { mettreEnAvantSurPlace(null); tournerPlaque('hassid'); } }, 2800);
}

function panneauAujourdhui() {
  const prenom = store.firstName();
  const record = store.record();
  // Une note seule ne fait pas la journée.
  const fait = record?.faite === true;
  const serie = store.streak();
  const semaine = store.currentWeek();
  const progression = JaugeSemaine.progression(semaine);
  const etat = store.anneaux();
  const nomJour = new Intl.DateTimeFormat(tr.langue, { weekday: 'short', timeZone: 'UTC' });

  const bouton = store.isSessionRunning() ? tr.t('action_back_to_session')
    : fait ? tr.t('action_another_session')
      : tr.t('action_start_session', tr.duree(store.targetMinutes()));

  const sujet = store.sessionTheme();
  const morceau = store.musicEnabled() ? morceauChoisi() : null;

  // Trois blocs : en-tête, anneaux, actions. Ils s'empilent ; sur un
  // téléphone couché, les anneaux passent à côté (app.css, « Téléphone couché »).
  return h('div', { class: 'contenu accueil' }, h('div', { class: 'accueil-tete' },
    h('div', { class: 'marque' }, tr.t('app_name')),
    prenom ? h('div', { class: 'salut' }, tr.t(Salutation.cle(new Date().getHours()), prenom)) : null,
    // Sans prénom, l'état du jour prend la place du titre.
    // Comme Android : en cours, faite, jour sans obligation, ou pas encore faite.
    h('div', { class: prenom ? 'statut' : 'statut titre' }, tr.t(
      store.isSessionRunning() ? 'status_running'
        : fait ? 'status_done'
          : semaine.filter((j) => !j.future).at(-1)?.exempt ? 'status_rest'
            : 'status_pending')),
    // Le premier jour, « 0 min au total » n'apprend rien : la phrase d'accueil reste seule.
    h('div', { class: 'serie' },
      h('span', {}, serie > 0 ? tr.p('status_streak', serie)
        : store.aDejaPratique() ? tr.t('status_streak_none') : tr.t('status_streak_first')),
      store.totalMinutes() > 0 ? h('span', { class: 'separateur', 'aria-hidden': 'true' }, '·') : null,
      store.totalMinutes() > 0 ? h('span', { class: 'total' }, tr.t('status_total', tr.duree(store.totalMinutes()))) : null),
    fait ? h('div', { class: 'detail' },
      record.minutes > 0 ? tr.t('today_minutes', tr.duree(record.minutes)) : tr.t('today_declared')) : null),

    h('div', { class: 'accueil-jauge' }, h('div', { class: 'jauge' },
    // L'image des anneaux porte la description ; la plaque, touchable, reste à part (audit du 16/10).
    decrire(anneaux(etat), tr.t('rings_description',
      tr.duree(etat.jour.fait), tr.duree(etat.jour.objectif), etat.semaine.fait, etat.semaine.objectif, etat.serie.fait, etat.serie.objectif)),
    plaqueAccueil()),
    h('div', { class: `jauge-legende${anneauEnAvant ? ` legende-${anneauEnAvant}` : ''}` }, legendeAnneaux(etat, progression)),
    lignePaliers()),

    h('div', { class: 'accueil-actions' }, h('button', { class: 'principal', onclick: () => ouvrir('seance') }, bouton),

    h('div', { class: 'pastilles' },
      pastille(tr.t('start_duration'), tr.duree(store.targetMinutes()), () => choisirDuree((m) => {
        store.setTargetMinutes(m); rendre();
      })),
      pastille(tr.t('start_theme'), sujet ? tr.t(`theme_${sujet}`) : tr.t('session_theme_none_short'), choisirSujet),
      pastille(tr.t('start_music'), morceau ? titreMorceau(morceau) : tr.t('start_music_off'), () => ouvrir('musique'))),

    h('div', { class: 'semaine' }, semaine.map((j) => {
      const repos = j.shabbat && j.exempt;
      // Le numéro du jour remplit les cases ouvertes : la bande se lit comme un calendrier.
      // Un jour fait touché montre sa durée à la place du ✓ (14/10) ; touché encore, le ✓ revient.
      const minutes = store.record(j.date)?.minutes ?? 0;
      const montre = j.done && joursMontres.has(j.date);
      const marque = montre ? JaugeSemaine.dureeCourte(minutes) : j.done ? '✓' : repos ? tr.t('week_shabbat_mark') : j.exempt ? '—' : String(Number(j.date.slice(8)));
      const etiquette = j.done ? `${tr.t('week_done')} · ${tr.duree(minutes)}` : repos ? tr.t('settings_shabbat')
        : j.exempt ? tr.t('gate_exempt_title') : tr.t('week_todo');
      const classe = ['jour', j.done ? 'fait' : j.exempt ? 'exempte' : '', repos && !j.done ? 'repos' : '',
        !j.done && !j.exempt && j.date === store.today() ? 'aujourdhui' : '', j.future ? 'avenir' : ''].join(' ').replace(/\s+/g, ' ').trim();
      const nom = `${nomJour.format(new Date(`${j.date}T12:00:00Z`))} : ${etiquette}`;
      const bascule = () => { if (!joursMontres.delete(j.date)) joursMontres.add(j.date); rendre(); };
      // Tout jour jusqu'à aujourd'hui s'ouvre (16/10) : y ajouter du temps fait hors du téléphone ;
      // un jour fait peut aussi montrer sa durée sur la bande (14/10).
      const ouvrable = !j.future && j.date <= store.today();
      return h(ouvrable ? 'button' : 'div', { class: `${classe}${montre ? ' montre-duree' : ''}`,
        ...(ouvrable ? { type: 'button', onclick: () => ajoutTemps(j.date, j.done ? bascule : null) } : { role: 'img' }), 'aria-label': nom },
        h('span', { class: 'nom', 'aria-hidden': 'true' }, nomJour.format(new Date(`${j.date}T12:00:00Z`))),
        h('span', { class: 'marque-jour', 'aria-hidden': 'true' }, marque));
    })),

    fait ? h('button', { class: 'texte-bouton', onclick: () => ecrireNote(store.today(), rendre) }, tr.t('action_write_note')) : null,
    // L'accueil selon l'heure (14/10) : la prière du moment, Birkat haLevana les soirs de la fenêtre.
    ...momentAccueil(),
    // Les trophées et les paliers, en bas de la page (11/10).
    // Les trophées et « Mon parcours », côte à côte (19/10).
    h('div', { class: 'boutons-bas' },
      h('button', { class: 'bouton-trophees', onclick: () => ouvrir('paliers') }, tr.t('trophees_paliers')),
      h('button', { class: 'bouton-trophees', onclick: () => ouvrir('parcours') }, tr.t('parcours_title')))));
}

/**
 * Les effets d'entrée (19/10, « ajoute des effets professionnels ») : l'écran glisse
 * et s'éclaircit, ses cartes suivent en cascade (app.css, « Effets ») ; dans « Mon
 * parcours », les chiffres montent jusqu'à leur valeur. Rien de cela quand le
 * téléphone demande moins de mouvement.
 */
const moinsDeMouvement = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function effetsEntree(ecran) {
  if (moinsDeMouvement()) return;
  const racine = app.firstElementChild;
  if (!racine) return;
  racine.classList.add('entree');
  racine.querySelectorAll('.contenu > *').forEach((el, i) => el.style.setProperty('--rang', String(Math.min(i, 8))));
  setTimeout(() => racine.classList.remove('entree'), 900);
  if (ecran === 'parcours') racine.querySelectorAll('.tuile-valeur [data-compte]').forEach(compteMonte);
}

/** Un nombre qui monte de 0 à sa valeur en 0,7 s, en ralentissant. */
function compteMonte(el) {
  const fin = Number(el.dataset.compte);
  if (!(fin > 0)) return;
  const debut = performance.now();
  const pas = (t) => {
    const p = Math.min(1, (t - debut) / 700);
    el.textContent = String(Math.round(fin * (1 - (1 - p) ** 3)));
    if (p < 1) requestAnimationFrame(pas);
  };
  el.textContent = '0';
  requestAnimationFrame(pas);
}

/** « Mon parcours » (ParcoursActivity) : les chiffres et les sujets ; l'humeur reste sur Android, qui a le journal. */
function ecranParcours() {
  const b = Parcours.bilan(store.jours());
  const serie = store.streak();
  const meilleure = store.meilleureSerie();
  const tuile = (valeur, unite, cle, teinte) => h('div', { class: 'tuile-parcours' },
    h('span', { class: 'tuile-pastille', style: `background: var(${teinte})` }),
    h('div', { class: 'tuile-valeur' }, /^\d+$/.test(valeur) ? h('span', { 'data-compte': valeur }, valeur) : valeur,
      unite ? h('span', { class: 'tuile-unite' }, ` ${unite}`) : null),
    h('div', { class: 'tuile-libelle' }, tr.t(cle)));
  const max = Math.max(1, ...b.sujets.map(([, n]) => n));
  return h('div', { class: 'ecran avec-bandeau' },
    bandeau(tr.t('parcours_title'), { puce: h('p', { class: 'bandeau-sous-titre' }, tr.t('parcours_hint')), dessin: 'char_praise' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu parcours' },
      h('div', { class: 'tuiles-parcours' },
        tuile(String(serie), tr.p('parcours_unite_jours', serie), 'parcours_serie', '--ring-streak'),
        tuile(String(meilleure), tr.p('parcours_unite_jours', meilleure), 'parcours_meilleure', '--ring-streak'),
        tuile(String(b.jours), '', 'parcours_jours_faits', '--ring-week'),
        tuile(tr.duree(b.minutes), '', 'parcours_total', '--brand')),
      b.jours ? h('p', { class: 'parcours-moyenne' }, tr.t('parcours_moyenne_ligne', tr.duree(b.moyenne))) : null,
      h('h2', { class: 'section' }, tr.t('parcours_sujets')),
      h('div', { class: 'carte' }, b.sujets.length
        ? b.sujets.map(([s, n]) => h('div', { class: 'sujet-parcours' },
          h('div', { class: 'sujet-tete' }, h('span', {}, tr.t(`theme_${s}`)), h('span', { class: 'sujet-fois' }, tr.p('parcours_fois', n))),
          h('div', { class: 'sujet-piste' }, h('div', { class: 'sujet-plein', style: `width: ${Math.max(4, Math.round((100 * n) / max))}%` }))))
        : h('p', { class: 'parcours-vide' }, tr.t('parcours_sujets_vide'))))));
}

/** L'accueil selon l'heure (AccueilMoment.kt) : la prière du moment, et Birkat haLevana les soirs où elle se dit. */
/**
 * Les rappels de tefila (16/10, RappelsTefilaVue) : un changement dans la prière, annoncé
 * quelques jours avant, avec sa source (Choul'han Aroukh).
 */
function rappelsDeTefila() {
  const aujourdhui = store.today();
  const israel = store.inIsrael();
  const muk = mukafChoma();
  const edot = store.siddurNusah() === 'edot';
  const ajoute = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const jourSemaine = (iso) => { const t = new Intl.DateTimeFormat(tr.langue, { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`)); return t.charAt(0).toLocaleUpperCase(tr.langue) + t.slice(1); };
  const moment = (r) => {
    if (!RAPPELS_TEFILA[r.type].leSoir) return r.date === aujourdhui ? tr.t('rappel_aujourdhui') : r.date === ajoute(aujourdhui, 1) ? tr.t('rappel_demain') : jourSemaine(r.date);
    const soir = ajoute(r.date, -1);
    if (soir < aujourdhui) return tr.t('rappel_hier_soir');
    if (new Date(`${soir}T12:00:00Z`).getUTCDay() === 6) return tr.t('rappel_motsae');
    if (soir === aujourdhui) return tr.t('rappel_ce_soir');
    if (soir === ajoute(aujourdhui, 1)) return tr.t('rappel_demain_soir');
    return tr.t('rappel_soir', jourSemaine(soir));
  };
  const TEXTES = {
    pluie_debut: ['rappel_pluie_debut_titre', edot ? 'rappel_pluie_debut_edot' : 'rappel_pluie_debut'],
    pluie_fin: ['rappel_pluie_fin_titre', edot ? 'rappel_pluie_fin_edot' : 'rappel_pluie_fin'],
    guechem_debut: ['rappel_guechem_titre', 'rappel_guechem_debut'], guechem_fin: ['rappel_guechem_titre', 'rappel_guechem_fin'],
    dix_jours: ['rappel_dix_jours_titre', 'rappel_dix_jours'], omer: ['rappel_omer_titre', 'rappel_omer'],
  };
  const sansGuechem = edot && (store.lieu()?.latitude ?? 0) < 0;
  return rappelsTefila(aujourdhui, israel, 3, (iso) => jourJuif(iso, israel, muk), sansGuechem).map((r) => {
    const [titre, corps] = TEXTES[r.type];
    return h('div', { class: 'carte rappel-tefila' },
      h('h3', { class: 'rappel-titre' }, tr.t(titre)),
      h('p', { class: 'rappel-corps' }, tr.t(corps, moment(r))),
      h('p', { class: 'rappel-source' }, tr.t('rappel_source', sourceRappel(RAPPELS_TEFILA[r.type].source))));
  });
}

function momentAccueil() {
  const rappels = rappelsDeTefila();
  if (!chargeSiddur()) return rappels;
  const heure = new Date();
  const moment = store.lieu() ? momentDuSiddour(store.lieu(), heure) : SiddurMoment.suggestion(heure.getHours(), heure.getMinutes());
  const cartes = [...rappels];
  const t = moment ? siddur.textes.find((x) => x.id === moment) : null;
  if (t) cartes.push(carteMaintenant(t, undefined, undefined, tr.t(Salutation.mot(heure.getHours()))));
  const zone = store.lieu()?.fuseau ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const l = levana(isoLocal(heure), zone, { usage: usageLevanaCourant() });
  const lv = siddur.textes.find((x) => x.id === 'birkat_halevana');
  if (lv && typeof l.etat === 'string' && heure.getHours() >= 14) {
    cartes.push(h('button', { class: 'maintenant', onclick: () => { priere = lv.id; ouvrir('priere'); } },
      plateau('char_praise', 'plateau-maintenant'),
      h('span', { class: 'maintenant-corps' },
        h('span', { class: 'maintenant-libelle' }, tr.t('levana_ce_soir')),
        h('span', { class: 'maintenant-he', lang: 'he', dir: 'rtl' }, lv.titre.he)),
      h('span', { class: 'chevron', 'aria-hidden': 'true' })));
  }
  // La source du jour (SourceDuJour, 19/10) : la même toute la journée, distincte du ’hizouk.
  const p = chargeBibliotheque() ? SourceDuJour.choix(bibliotheque, store.today()) : null;
  if (p) {
    cartes.push(h('div', { class: 'carte source-du-jour' },
      h('span', { class: 'maintenant-libelle' }, tr.t('source_du_jour')),
      h('p', { class: 'source-du-jour-texte', lang: 'he', dir: 'rtl' }, SourceDuJour.extrait(p.texte)),
      h('p', { class: 'source-du-jour-ref' }, Reference.localise(p.source.ref, tr.langue)),
      h('div', { class: 'source-du-jour-actions' },
        h('button', { class: 'principal', onclick: () => ouvrir('seance') }, tr.t('source_du_jour_commencer')),
        h('button', { class: 'secondaire', onclick: () => { entreeBiblio = p.source.id; ouvrir('source'); } }, tr.t('source_du_jour_lire')))));
  }
  return cartes.length ? [h('div', { class: 'accueil-moment' }, ...cartes)] : [];
}

function pastille(libelle, valeur, onclick) {
  return h('button', { class: 'pastille', onclick },
    h('span', { class: 'libelle' }, libelle), h('span', { class: 'valeur' }, valeur));
}

function ligne({ nom, etat, onclick, aVenir = false, fin = null }) {
  return h('button', { class: `ligne${aVenir ? ' a-venir' : ''}`, onclick, 'aria-disabled': aVenir ? 'true' : null },
    h('span', { class: 'corps' }, h('div', { class: 'nom' }, nom), etat ? h('div', { class: 'etat' }, etat) : null),
    fin, h('span', { class: 'chevron', 'aria-hidden': 'true' }));
}

function etatTikkun() {
  if (!tikkun) return '';
  const dits = store.tikkunDone().size;
  const total = tikkun.psaumes.length;
  const versets = tikkun.psaumes.reduce((n, p) => n + p.versets.length, 0);
  if (dits === 0) return tr.t('tikkun_progress_none', total, versets);
  if (dits === total) return tr.t('tikkun_progress_all');
  return tr.t('tikkun_progress', dits, total);
}

function etatMusique() {
  const m = morceauChoisi();
  if (!store.musicEnabled()) return tr.t('music_off_summary');
  if (!m) return tr.t('music_none_summary');
  return volumeReglable ? tr.t('music_on_summary', titreMorceau(m), store.musicVolume()) : titreMorceau(m);
}

// --- Tehilim (Tehilim.kt, TehilimActivity.kt) ------------------------------------
// Le livre entier, chargé au premier besoin : 327 ko qu'on ne lit pas à chaque ouverture.
let tehilim = null;
let lecture = null;
function chargeTehilim() {
  if (tehilim) return true;
  fetch('data/tehilim.json').then((r) => r.json()).then((d) => { tehilim = d.psaumes; rendre(); });
  return false;
}

/** Le jour du mois hébraïque et la longueur du mois (29 ou 30), par le calendrier du navigateur. */
function jourHebreu(date = new Date()) {
  const jour = (d) => Number(new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric' }).format(d));
  const j = jour(date);
  const demain = new Date(date);
  demain.setDate(date.getDate() + 1);
  return { jour: j, longueur: j === 29 && jour(demain) === 1 ? 29 : 30 };
}

/** « 117:1 » ; en hébreu « קי״ז, א׳ » (RappelsTefilaVue.sourceLocale). */
const sourceRappel = (s) => (tr.langue === 'he' ? s.split(':').map((n) => Reference.lettres(+n)).join(', ') : s);
const nombreTehilim = (n) => (tr.langue === 'he' ? Reference.lettres(n) : String(n));

function libellePortion(p) {
  if (CycleTehilim.partielle(p)) {
    return tr.t('tehilim_range_verses', nombreTehilim(p.debut), nombreTehilim(p.debutVerset), nombreTehilim(p.finVerset));
  }
  if (p.debut === p.fin) return tr.t('tehilim_single', nombreTehilim(p.debut));
  return tr.t('tehilim_range', nombreTehilim(p.debut), nombreTehilim(p.fin));
}

function portionDuMois() {
  const { jour, longueur } = jourHebreu();
  return { jour, portion: CycleTehilim.duMois(jour, longueur) };
}

function lire(p) {
  lecture = p;
  ouvrir('lecture');
}

function ecranTehilim() {
  const { jour, portion } = portionDuMois();
  const auj = new Date();
  const semaine = CycleTehilim.deLaSemaine(auj.getDay());
  const nomJour = new Intl.DateTimeFormat(tr.langue, { weekday: 'long' }).format(auj);
  const pret = chargeTehilim();
  const versets = pret ? tehilim.reduce((n, ch) => n + ch.length, 0) : null;
  return h('div', { class: 'ecran' }, barre(tr.t('tehilim_title')),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      versets ? h('p', { class: 'indice' }, tr.t('tehilim_count', 150, versets.toLocaleString(tr.langue))) : null,
      h('div', { class: 'carte' },
        ligne({ nom: tr.t('tehilim_month'), etat: tr.t('tehilim_month_state', nombreTehilim(jour), libellePortion(portion)), onclick: () => lire(portion) }),
        ligne({ nom: tr.t('tehilim_week'), etat: tr.t('tehilim_week_state', nomJour.charAt(0).toLocaleUpperCase(tr.langue) + nomJour.slice(1), libellePortion(semaine)), onclick: () => lire(semaine) })),
      h('h2', { class: 'section' }, tr.t('tehilim_all')),
      h('div', { class: 'grille-psaumes' }, Array.from({ length: 150 }, (_, i) => i + 1).map((n) =>
        h('button', { class: 'case-psaume', 'aria-label': libellePortion(CycleTehilim.portion(n, n)), onclick: () => lire(CycleTehilim.portion(n, n)) },
          nombreTehilim(n)))))));
}

function ecranLecture() {
  // Rouvert directement sur #lecture, sans passage choisi : le livre.
  if (!lecture) return ecranTehilim();
  const p = lecture;
  if (!chargeTehilim()) return h('div', { class: 'ecran' }, barre(libellePortion(p)), h('div', { class: 'defile' }));
  const seul = p.debut === p.fin && !CycleTehilim.partielle(p);
  const blocs = [];
  let total = 0;
  for (let n = p.debut; n <= p.fin; n++) {
    const tous = tehilim[n - 1];
    const quels = CycleTehilim.versets(p, n, tous.length);
    total += quels.length;
    blocs.push(h('h2', { class: 'psaume-titre', lang: 'he', dir: 'rtl' }, tr.t('tikkun_psalm_he', Reference.lettres(n))));
    blocs.push(h('div', { class: 'psaume', lang: 'he', dir: 'rtl' }, quels.map((v) =>
      h('p', { class: 'verset' }, h('span', { class: 'num', 'aria-hidden': 'true' }, `${Reference.lettres(v)} `), tous[v - 1]))));
  }
  const aller = (n) => { lecture = CycleTehilim.portion(n, n); rendre(); app.querySelector('.defile').scrollTop = 0; };
  return ecranLu(libellePortion(p), h('div', { class: 'contenu lecture' },
      h('p', { class: 'indice' }, tr.p('tehilim_verses', total, total)),
      ...blocs), { avecNusah: false, pied: seul ? h('div', { class: 'lecture-nav' },
      h('button', { class: 'secondaire', style: p.debut > 1 ? null : 'visibility:hidden', onclick: () => aller(p.debut - 1) }, tr.t('tehilim_previous')),
      h('button', { class: 'principal', style: p.debut < 150 ? null : 'visibility:hidden', onclick: () => aller(p.debut + 1) }, tr.t('tehilim_next'))) : null });
}

// --- Siddour (SiddurActivity.kt, SiddurLectureActivity.kt) ------------------------
const siddurs = {};
let siddur = null;
let priere = null;
const NUSAH = [['edot', 'siddur_nusah_edot'], ['sefard', 'siddur_nusah_sefard'], ['ashkenaz', 'siddur_nusah_ashkenaz']];
/** Le siddour du nusah choisi, chargé au premier besoin (un fichier par nusah). */
/** Les livres entiers de la bibliothèque (data/livres.json, au format du siddour), chargés au premier besoin. */
let livres = null;
function chargeLivres() {
  if (livres) return true;
  fetch('data/livres.json').then((r) => r.json()).then((d) => { livres = d; rendre(); }).catch(() => {});
  return false;
}

function chargeSiddur() {
  const n = store.siddurNusah();
  if (siddurs[n]) { siddur = siddurs[n]; return true; }
  fetch(`data/siddur_${n}.json`).then((r) => r.json()).then((d) => { siddurs[n] = d; rendre(); });
  return false;
}

// --- Le bouton de lecture (ReglagesLecture.kt) -------------------------------------
// Une petite pastille « Aa » au bas du texte, aux couleurs de l'utilisateur.
// Touchée, elle s'ouvre en barre : taille des lettres, lecture de nuit,
// nusah au siddour, masquer, replier. Masquée, elle disparaît de tous les
// écrans de lecture ; un appui long sur le texte la fait revenir.
let reglagesOuverts = false;
let choixNusahOuvert = false;
const ECRANS_LUS = ['lecture', 'priere', 'tikkun', 'source'];

/** Les chaînes nouvelles, tant qu'Android ne les a pas encore : le français. */
const CHAINES_LECTURE = {
  lecture_reglages: 'Réglages de lecture',
  lecture_nuit: 'Lecture sur fond noir',
  lecture_plus: 'Lettres plus grandes',
  lecture_moins: 'Lettres plus petites',
  lecture_masquer: 'Masquer le bouton',
  lecture_masque_info: 'Bouton masqué. Appui long sur le texte pour le faire revenir.',
  lecture_annuler_masque: 'Annuler',
  lecture_replier: 'Replier',
  lecture_taille: 'Taille du texte : %1$d %%',
};
function tl(cle, ...args) {
  try { return tr.t(cle, ...args); } catch { return formate(CHAINES_LECTURE[cle] ?? cle, args); }
}

// Au trait, bouts arrondis : le dessin des autres icônes de l'application.
const ICONES_LECTURE = {
  lune: ['M19.5,14.6 A7.8,7.8 0 1,1 9.4,4.5 A6.2,6.2 0 0,0 19.5,14.6 Z'],
  masquer: ['M3,12 C5,8 8.2,6 12,6 C15.8,6 19,8 21,12 C19,16 15.8,18 12,18 C8.2,18 5,16 3,12 Z', 'M9.2,12 a2.8,2.8 0 1,0 5.6,0 a2.8,2.8 0 1,0 -5.6,0', 'M4,4 L20,20'],
  replier: ['M6.5,9.5 L12,15 L17.5,9.5'],
  coche: ['M5,12.5 L10,17 L19,7.5'],
};
function icone(nom) {
  const svg = s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  for (const d of ICONES_LECTURE[nom]) {
    svg.append(s('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }
  return svg;
}

/** Un nouveau rendu, puis le doigt (ou le clavier) retrouve le bon bouton. */
/** La police choisie des textes hébreux (12/10), posée sur toute la page. */
const POLICES = {
  serif: '"Hebreu Serif", "Noto Serif Hebrew", "Times New Roman", serif',
  sans: '"Noto Sans Hebrew", "Arial Hebrew", system-ui, sans-serif',
  arrondie: '"Varela Round", system-ui, sans-serif',
  // Quatre polices hébraïques libres (OFL, Google Fonts), toutes avec le nikkoud (14/10).
  frank: '"Frank Ruhl Libre", "Hebreu Serif", serif',
  david: '"David Libre", "Hebreu Serif", serif',
  rachi: '"Noto Rashi Hebrew", "Hebreu Serif", serif',
  miriam: '"Miriam Libre", system-ui, sans-serif',
};
function appliquerPolice() {
  document.documentElement.style.setProperty('--police-texte', POLICES[store.lecturePolice()]);
  // La taille choisie à la lecture vaut aussi pour les cartes de halakha et de hilloulot.
  document.documentElement.style.setProperty('--echelle-texte', String(store.lectureEchelle()));
}

function rendreEtViser(selecteur) {
  rendre();
  app.querySelector(selecteur)?.focus({ preventScroll: true });
}

/** Un message bref avec une action (le Snackbar d'Android). */
function signaleAvecAction(texte, action, onAction, duree = 5000) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast toast-action', role: 'status' },
    h('span', {}, texte),
    h('button', { type: 'button', onclick: () => { t.remove(); onAction(); } }, action));
  document.body.append(t);
  setTimeout(() => t.remove(), duree);
}

function masquerLecture() {
  store.setLectureMasquee(true);
  reglagesOuverts = false;
  choixNusahOuvert = false;
  rendre();
  signaleAvecAction(tl('lecture_masque_info'), tl('lecture_annuler_masque'), () => {
    store.setLectureMasquee(false);
    rendreEtViser('.lecture-pastille');
  });
}

function ramenerLecture() {
  store.setLectureMasquee(false);
  reglagesOuverts = true;
  document.querySelector('.toast')?.remove();
  navigator.vibrate?.(10);
  rendreEtViser('.lecture-barre button');
}

function reglagesLecture({ avecNusah, sansNuit = false }) {
  if (store.lectureMasquee()) return null;
  if (!reglagesOuverts) {
    return h('div', { class: 'lecture-ctrl' },
      h('button', {
        type: 'button', class: 'lecture-pastille', lang: 'en', dir: 'ltr', 'aria-label': tl('lecture_reglages'), 'aria-expanded': 'false',
        onclick: () => { reglagesOuverts = true; rendreEtViser('.lecture-barre button'); },
      }, 'Aa'));
  }
  const e = store.lectureEchelle();
  const pourcent = Math.round(e * 100);
  const echelle = (n) => {
    const v = Math.round(Math.min(2, Math.max(0.8, n)) * 10) / 10;
    if (v !== e) { store.setLectureEchelle(v); rendre(); }
  };
  const nuit = store.lectureSombre();
  const bouton = (attrs, ...enfants) => h('button', { type: 'button', ...attrs }, ...enfants);
  const separateur = () => h('span', { class: 'lecture-sep', 'aria-hidden': 'true' });
  return h('div', { class: 'lecture-ctrl' },
    choixNusahOuvert ? h('div', { class: 'lecture-nusah', role: 'menu', 'aria-label': tl('siddur_choose') }, NUSAH.map(([cle, nom]) => {
      const courant = cle === store.siddurNusah();
      return bouton({
        role: 'menuitemradio', 'aria-checked': String(courant),
        onclick: () => { store.setSiddurNusah(cle); choixNusahOuvert = false; rendreEtViser('.lecture-nusah-bouton'); },
      }, h('span', { class: 'coche' }, courant ? icone('coche') : null), tr.t(nom));
    })) : null,
    h('div', { class: 'lecture-barre', role: 'toolbar', 'aria-label': tl('lecture_reglages') },
      bouton({ class: 'lettres', lang: 'en', dir: 'ltr', 'aria-label': tl('lecture_moins'), disabled: e <= 0.8, onclick: () => echelle(e - 0.1) }, 'A−'),
      bouton({ class: 'taille', 'aria-label': tl('lecture_taille', pourcent), onclick: () => echelle(1) },
        new Intl.NumberFormat(tr.langue, { style: 'percent' }).format(pourcent / 100)),
      bouton({ class: 'lettres', lang: 'en', dir: 'ltr', 'aria-label': tl('lecture_plus'), disabled: e >= 2, onclick: () => echelle(e + 0.1) }, 'A+'),
      separateur(),
      // « אב » : la police suivante (les sept, l'une après l'autre), pour tous les textes.
      bouton({ class: 'lecture-police', lang: 'he', dir: 'rtl', 'aria-label': `${tl('lecture_police')} : ${tl(`police_${store.lecturePolice()}`)}`, title: tl(`police_${store.lecturePolice()}`),
        onclick: choisirPolice }, 'אב'),
      sansNuit ? null : bouton({ class: 'icone-bouton', 'aria-label': tl('lecture_nuit'), 'aria-pressed': String(nuit), onclick: () => { store.setLectureSombre(!nuit); rendreEtViser('.lecture-barre [aria-pressed]'); } }, icone('lune')),
      avecNusah ? bouton({
        class: 'lecture-nusah-bouton', 'aria-haspopup': 'menu', 'aria-expanded': String(choixNusahOuvert),
        onclick: () => { choixNusahOuvert = !choixNusahOuvert; rendreEtViser(choixNusahOuvert ? '.lecture-nusah [aria-checked="true"]' : '.lecture-nusah-bouton'); },
      }, tr.t('siddur_choose')) : null,
      separateur(),
      bouton({ class: 'icone-bouton', 'aria-label': tl('lecture_masquer'), onclick: masquerLecture }, icone('masquer')),
      bouton({ class: 'icone-bouton', 'aria-label': tl('lecture_replier'), 'aria-expanded': 'true', onclick: () => { reglagesOuverts = false; choixNusahOuvert = false; rendreEtViser('.lecture-pastille'); } }, icone('replier'))));
}

/**
 * L'appui long sur le texte, quand le bouton est masqué : 550 ms sans
 * bouger de plus de 10 px, ou le menu contextuel. Rien n'est empêché tant
 * qu'il n'a pas abouti : le texte défile comme d'habitude.
 */
function appuiLongPourRamener(zone) {
  let minuteur = null;
  let depart = null;
  let abouti = 0;
  const annule = () => { clearTimeout(minuteur); minuteur = null; depart = null; };
  zone.addEventListener('pointerdown', (e) => {
    if (!store.lectureMasquee() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    depart = { x: e.clientX, y: e.clientY };
    minuteur = setTimeout(() => { minuteur = null; abouti = Date.now(); ramenerLecture(); }, 550);
  });
  zone.addEventListener('pointermove', (e) => {
    if (depart && Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 10) annule();
  });
  for (const fin of ['pointerup', 'pointercancel', 'pointerleave', 'scroll']) zone.addEventListener(fin, annule, { passive: true });
  zone.addEventListener('contextmenu', (e) => {
    if (Date.now() - abouti < 800) { e.preventDefault(); return; }
    if (!store.lectureMasquee()) return;
    e.preventDefault();
    annule();
    abouti = Date.now();
    ramenerLecture();
  });
  // Le doigt qui se lève après l'appui long ne touche rien d'autre.
  zone.addEventListener('click', (e) => {
    if (Date.now() - abouti < 800) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}

/**
 * Un écran de lecture de texte saint : le texte à la taille choisie, de
 * nuit si demandé, et le bouton de lecture au-dessus du pied d'écran.
 */
function ecranLu(titre, contenu, { avecNusah = false, pied = null, bande = null, entete = null } = {}) {
  const defile = h('div', { class: 'defile' }, contenu);
  const ctrl = reglagesLecture({ avecNusah });
  let avant = 0;
  defile.addEventListener('scroll', () => {
    const p = ctrl?.querySelector('.lecture-pastille');
    const y = defile.scrollTop;
    if (p) {
      // En bas du texte, la pastille revient : on n'a plus à remonter pour la trouver.
      const enBas = y + defile.clientHeight >= defile.scrollHeight - 4;
      if (enBas || y < avant - 4) p.classList.remove('cachee');
      else if (y > avant + 4) p.classList.add('cachee');
    }
    avant = y;
  }, { passive: true });
  appuiLongPourRamener(defile);
  return h('div', { class: `ecran lu${store.lectureSombre() ? ' nuit' : ''}`, style: `--echelle: ${store.lectureEchelle()}` },
    entete ?? barre(titre),
    bande,
    h('div', { class: `lu-zone${pied ? '' : ' sans-pied'}` }, defile, ctrl),
    pied);
}

/**
 * Le balisage du siddour, en nœuds : seuls <b>, <small> et <br> existent dans
 * siddur.json (tools/siddur_construction.py) ; tout le reste reste du texte.
 */
function riche(html) {
  const racine = document.createDocumentFragment();
  const pile = [racine];
  for (const morceau of html.split(/(<\/?b>|<\/?small>|<br>)/)) {
    if (!morceau) continue;
    const ouvre = morceau.match(/^<(b|small)>$/);
    if (ouvre) { const el = document.createElement(ouvre[1]); pile.at(-1).append(el); pile.push(el); }
    else if (/^<\/(b|small)>$/.test(morceau)) { if (pile.length > 1) pile.pop(); }
    else if (morceau === '<br>') pile.at(-1).append(document.createElement('br'));
    else pile.at(-1).append(document.createTextNode(morceau));
  }
  return racine;
}

const titreTexte = (titre) => (tr.langue === 'he' ? titre.he : (titre[tr.langue] || titre.he));

/** Une ligne de section : le nom hébreu, sa traduction dessous, le chevron. */
function ligneHebreu(hebreu, traduction, onclick) {
  return h('button', { class: 'ligne ligne-he', onclick },
    h('span', { class: 'corps' },
      h('span', { class: 'nom-he', lang: 'he', dir: 'rtl' }, hebreu),
      traduction && traduction !== hebreu ? h('span', { class: 'etat' }, traduction) : null),
    h('span', { class: 'chevron', 'aria-hidden': 'true' }));
}

/** Le personnage sur son panneau clair, comme sur l'accueil (bg_stage). */
function plateau(dessin, classe) {
  return h('span', { class: `plateau ${classe}`, 'aria-hidden': 'true' }, h('img', { src: `img/${dessin}.webp`, alt: '' }));
}

/**
 * Le bandeau d'un écran à l'identité de l'application (bg_hero) : le
 * retour, le titre, ce qui se règle dessous, et le hassid sur son panneau.
 */
function bandeau(titre, { puce = null, dessin = null } = {}) {
  return h('header', { class: 'bandeau' },
    h('button', { class: 'retour', 'aria-label': tr.t('action_back'), onclick: retour }),
    h('div', { class: 'bandeau-corps' }, h('h1', {}, titre), puce),
    dessin ? plateau(dessin, 'plateau-bandeau') : null);
}

/** Le nom du groupe en hébreu, à la couleur choisie ; sa traduction à côté. */
function enteteGroupe(hebreu, traduction) {
  const enHebreu = /[֐-׿]/.test(hebreu);
  return h('h2', { class: 'entete-groupe' },
    h('span', { class: `entete-he${enHebreu ? ' serif-he' : ''}`, lang: enHebreu ? 'he' : null, dir: enHebreu ? 'rtl' : null }, hebreu),
    traduction && traduction !== hebreu ? h('span', { class: 'entete-trad' }, traduction) : null);
}

/** Les trois nusah ; le choix est gardé, et vaut aussi dans les lectures. */
/** Le choix de la police (14/10) : chaque nom écrit dans sa police, avec un mot vocalisé pour juger. */
function choisirPolice() {
  feuille(tr.t('lecture_police'), (f, fermer) => {
    f.append(h('div', { role: 'radiogroup', 'aria-label': tr.t('lecture_police') }, Object.keys(POLICES).map((cle) => {
      const courant = cle === store.lecturePolice();
      return h('button', {
        type: 'button', class: 'choix choix-radio choix-police', role: 'radio', 'aria-checked': String(courant),
        onclick: () => { fermer(); if (!courant) { store.setLecturePolice(cle); appliquerPolice(); rendreEtViser('.lecture-police'); } },
      }, h('span', { class: 'radio', 'aria-hidden': 'true' }),
      h('span', { class: 'choix-police-corps' },
        h('span', { class: 'choix-police-nom' }, tr.t(`police_${cle}`)),
        h('span', { class: 'choix-police-exemple', lang: 'he', dir: 'rtl', style: `font-family: ${POLICES[cle]}` }, 'בְּרֵאשִׁית בָּרָא אֱלֹהִים')));
    })));
  });
  document.querySelector('.feuille [aria-checked="true"]')?.focus();
}

function choisirNusah() {
  feuille(tr.t('siddur_choose'), (f, fermer) => {
    f.append(h('div', { role: 'radiogroup', 'aria-label': tr.t('siddur_choose') }, NUSAH.map(([cle, nom]) => {
      const courant = cle === store.siddurNusah();
      return h('button', {
        type: 'button', class: 'choix choix-radio', role: 'radio', 'aria-checked': String(courant),
        onclick: () => { fermer(); if (!courant) { store.setSiddurNusah(cle); rendre(); } },
      }, h('span', { class: 'radio', 'aria-hidden': 'true' }), tr.t(nom));
    })));
  });
  document.querySelector('.feuille [aria-checked="true"]')?.focus();
}

/** La suggestion de l'heure : le hassid, l'heure dite en clair, le texte. */
function carteMaintenant(x, dessin = SiddurMoment.illustration(x.id), action = () => { priere = x.id; ouvrir('priere'); }, mot = null) {
  const traduction = titreTexte(x.titre) !== x.titre.he ? titreTexte(x.titre) : null;
  return h('button', { class: 'maintenant', onclick: action },
    plateau(dessin, 'plateau-maintenant'),
    h('span', { class: 'maintenant-corps' },
      h('span', { class: 'maintenant-libelle' }, tr.t('siddur_maintenant')),
      h('span', { class: 'maintenant-he', lang: 'he', dir: 'rtl' }, x.titre.he),
      traduction ? h('span', { class: 'maintenant-trad' }, traduction) : null,
      mot ? h('span', { class: 'maintenant-mot' }, mot) : null),
    h('span', { class: 'chevron', 'aria-hidden': 'true' }));
}

/** Un livre en tuile : son personnage, son nom hébreu, son nom traduit. */
function tuileLivre(hebreu, traduction, dessin, onclick) {
  return h('button', { class: 'livre', onclick },
    plateau(dessin, 'plateau-livre'),
    h('span', { class: 'livre-he', lang: 'he', dir: 'rtl' }, hebreu),
    traduction !== hebreu ? h('span', { class: 'livre-trad' }, traduction) : null);
}

/**
 * Le siddour (SiddurActivity, 04/10), dans la manière de l'application : en
 * tête, le texte que suggère l'heure ; puis Tehilim et le Tikoun côte à
 * côte ; puis les textes par groupe. Le nusah se choisit sur le bandeau.
 */
function ecranSiddur() {
  const pret = chargeSiddur();
  const nomNusah = pret ? titreTexte(siddur._meta.nusah) : tr.t(NUSAH.find(([c]) => c === store.siddurNusah())?.[1] ?? 'siddur_nusah');
  const heure = new Date();
  // Avec un lieu, la suggestion suit ses zmanim ; sans lieu, les heures fixes.
  const moment = store.lieu() ? momentDuSiddour(store.lieu(), heure) : SiddurMoment.suggestion(heure.getHours(), heure.getMinutes());
  const suggere = pret && moment ? siddur.textes.find((x) => x.id === moment) : null;
  // 'Hanouka (13/10) : le Hallel du jour, avec la scène de 'Hanouka, sous la prière du matin.
  const hallelHanouka = pret && moment === 'chaharit' && jourJuif(isoLocal(heure), store.inIsrael()).fetes.includes('hanouka')
    ? siddur.textes.find((x) => x.id === 'hallel') : null;
  // Birkat haIlanot (14/10), le mois où on la dit (SiddurMoment.ilanot).
  const ilanot = pret && ilanotDuMois(isoLocal(heure)) ? siddur.textes.find((x) => x.id === 'birkat_hailanot') : null;
  // Pourim (13/10) : la Méguila sous Arvit (la nuit qui ouvre Pourim) et sous Cha'harit (SiddurMoment.megila).
  // Les livres (7 Mo) ne se chargent que les jours de Méguila.
  const esther = megilaDuMoment(moment, isoLocal(heure)) && chargeLivres() ? livres.textes.find((x) => x.id === 'meguilat_esther') : null;
  const puce = h('button', {
    type: 'button', class: 'puce-bandeau', 'aria-haspopup': 'dialog', 'aria-label': `${tr.t('siddur_choose')} : ${nomNusah}`, onclick: choisirNusah,
  }, h('span', {}, nomNusah), icone('replier'));
  return h('div', { class: 'ecran avec-bandeau' }, bandeau(tr.t('siddur_title'), { puce, dessin: 'char_praying' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu liste-siddour' },
      suggere ? carteMaintenant(suggere) : null,
      hallelHanouka ? carteMaintenant(hallelHanouka, 'scene_hanukkah') : null,
      ilanot ? carteMaintenant(ilanot, 'scene_nature') : null,
      esther ? carteMaintenant(esther, 'char_purim', () => { priere = `livre:${esther.id}`; ouvrir('priere'); }) : null,
      enteteGroupe(tr.t('siddur_books'), null),
      h('div', { class: 'livres' },
        tuileLivre(tr.t('siddur_tehilim_he'), tr.t('tehilim_title'), 'char_tehilim', () => ouvrir('tehilim')),
        tuileLivre(tr.t('siddur_tikkun_he'), tr.t('tikkun_title'), 'char_torah', () => ouvrir('tikkun'))),
      ...(pret ? siddur.groupes.flatMap((g) => [
        enteteGroupe(g.titre.he, titreTexte(g.titre)),
        h('div', { class: 'carte carte-sections' }, siddur.textes.filter((x) => x.groupe === g.cle).map((x) =>
          // Un texte absent des sources de ce nusah, emprunté à un autre, le dit.
          ligneHebreu(x.titre.he, [titreTexte(x.titre) !== x.titre.he ? titreTexte(x.titre) : null, x.nusah ? titreTexte(x.nusah) : null].filter(Boolean).join(' · '),
            () => { priere = x.id; ouvrir('priere'); }))),
      ]) : []),
      // Les seules mentions que les licences demandent (CC-BY du siddour Metsudah, Wikipédia), sans Sefaria.
      pret && mentionsObligatoires(siddur._meta.sources).length
        ? h('p', { class: 'indice sources' }, tr.t('siddur_sources', mentionsObligatoires(siddur._meta.sources).join(' ; '))) : null)));
}

function ecranPriere() {
  // Un livre de la bibliothèque (« livre:likoutei_etsot », 12/10) se lit comme une prière, sans nusah ni ajouts.
  const livre = priere?.startsWith('livre:') ?? false;
  if (livre ? !chargeLivres() : !chargeSiddur()) return h('div', { class: 'ecran' }, barre(tr.t(livre ? 'livres_title' : 'siddur_title')), h('div', { class: 'defile' }));
  const recueil = livre ? livres : siddur;
  const x = recueil.textes.find((y) => y.id === (livre ? priere.slice(6) : priere));
  // Rouvert directement sur #priere, sans texte choisi : la liste.
  if (!x) return ecranSiddur();
  const plusieurs = x.sections.length > 1;
  const sousTitre = [titreTexte(x.titre) !== x.titre.he ? titreTexte(x.titre) : null, titreTexte(x.nusah ?? recueil._meta.nusah)].filter(Boolean).join(' · ');
  const titres = [];
  // Les ajouts du jour (10/10) : mis en évidence ; les autres, repliés.
  const annotations = !livre && chargeAnnotations() ? annotationsSiddur[store.siddurNusah()]?.[x.id] : null;
  const idx = indexAjouts(annotations ?? []);
  const maintenant = new Date();
  const jourDuTexte = jourJuif(jourDeLaPriere(x.id, isoLocal(maintenant), maintenant.getHours()), store.inIsrael(), mukafChoma());
  const nusah = store.siddurNusah();
  const c = conditionsPour(nusah, store.inIsrael(), jourDuTexte.conditions, store.sansTahanounFinTichri(), hemisphereSud());
  const nom = (a, condition) => tr.t(libelleJour(a.libelle, condition, nusah, c));
  // Marque-pages (15/10, SiddurLectureActivity) : un appui long sur un paragraphe le marque ou le démarque.
  const cleMarque = `${livre ? 'l' : 's'}:${x.id}`;
  const nusahMarque = livre ? '' : store.siddurNusah();
  const marquee = (si, i) => store.marques().some((m) => m.cle === cleMarque && m.nusah === nusahMarque && m.section === si && m.bloc === i);
  const paragraphe = (s, i) => {
    const b = s.blocs[i];
    const si = x.sections.indexOf(s);
    const p = h('p', { class: `${b.c !== undefined ? 'consigne' : 'priere'}${marquee(si, i) ? ' marque-page' : ''}${livre ? ' marque-etude' : ''}`, lang: 'he', dir: 'rtl', 'data-place': `${si}:${i}` }, riche(b.c ?? b.t));
    let minuteur = null;
    const poser = () => {
      const pose = store.basculerMarque({ cle: cleMarque, nusah: nusahMarque, section: si, bloc: i, apercu: apercuMarque(b.c ?? b.t) });
      p.classList.toggle('marque-page', pose);
      signale(tr.t(pose ? 'marque_posee' : 'marque_retiree'));
    };
    p.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(minuteur); poser(); });
    p.addEventListener('touchstart', () => { minuteur = setTimeout(() => { minuteur = null; poser(); }, 550); }, { passive: true });
    for (const ev of ['touchend', 'touchmove', 'touchcancel']) p.addEventListener(ev, () => clearTimeout(minuteur), { passive: true });
    return p;
  };
  // « Aujourd'hui · הַלֵּל › » : le texte à dire là ce jour-là, ouvert d'un geste ; rien hors du jour.
  // Qui prie seul (19/10) : une carte à part, jamais repliée, après Barekhou.
  const seuls = (si, i) => (idx.seuls.get(`${si}:${i}`) ?? []).filter((a) => ajoutVrai(a.si, c)).map((a) =>
    h('div', { class: 'seul-carte', lang: 'he', dir: 'rtl' },
      h('p', { class: 'seul-etiquette' }, tr.t('siddur_seul')),
      a.consigne ? h('p', { class: 'seul-consigne' }, a.consigne) : null,
      h('p', { class: a.consigne ? 'seul-texte' : 'seul-consigne' }, a.texte)));
  const renvois = (si, i) => (idx.renvois.get(`${si}:${i ?? ''}`) ?? []).filter((a) => ajoutVrai(a.si, c)).map((a) => {
    const cible = siddur.textes.find((y) => y.id === a.cible);
    return cible ? h('button', { type: 'button', class: 'renvoi-jour', lang: 'he', dir: 'rtl', onclick: () => ouvrirRenvoi(x.id, cible.id) },
      `${tr.t('siddur_aujourdhui')} · ${cible.titre.he}  ›`) : null;
  });
  const avecIndices = (si, i, p) => {
    const du = (idx.indices.get(`${si}:${i}`) ?? []).filter((a) => ajoutVrai(a.si, c));
    return [p, ...du.map((a) => h('p', { class: 'indice-jour' },
      h('span', {}, `${tr.t('siddur_aujourdhui')} : `), h('span', { lang: 'he', dir: 'rtl' }, a.texte))), ...renvois(si, i)];
  };
  const contenu = h('div', { class: 'contenu lecture siddour' },
    annotations ? h('p', { class: 'indice note-ajouts' }, tr.t('siddur_jour_ajouts', jourDuTexte.dateHebraique,
      tr.t(store.inIsrael() ? 'region_israel' : 'region_diaspora'))) : null,
    ...x.sections.flatMap((s, si) => {
      const t = plusieurs && s.titre ? h('h2', { class: 'psaume-titre', lang: 'he', dir: 'rtl' }, s.titre) : null;
      if (t) titres.push({ titre: s.titre, el: t });
      const section = idx.sections.get(si);
      if (section) return [t, ajout(nom(section, section.si), ajoutVrai(section.si, c), s.blocs.map((_, i) => paragraphe(s, i)), section.si), ...renvois(si)];
      const corps = [];
      for (let i = 0; i < s.blocs.length; i++) {
        const a = idx.blocs.get(`${si}:${i}`);
        if (!a) { corps.push(...avecIndices(si, i, paragraphe(s, i)), ...seuls(si, i)); continue; }
        // Le groupe : les blocs suivants de même groupe, variantes comprises.
        const membres = [];
        while (i < s.blocs.length && idx.blocs.get(`${si}:${i}`)?.g === a.g) {
          const m = idx.blocs.get(`${si}:${i}`);
          const p = paragraphe(s, i);
          if (!ajoutVrai(m.si, c)) p.classList.add('hors-jour');
          membres.push(p);
          i++;
        }
        i--;
        corps.push(ajout(nom(a, a.racine ?? a.si), ajoutVrai(a.racine ?? a.si, c), membres, a.racine ?? a.si));
        corps.push(...seuls(si, i));
      }
      return [t, ...corps, ...renvois(si)];
    }));
  const bande = titres.length > 1 ? bandeSignets(titres) : null;
  const etiquettes = [titreTexte(x.titre) !== x.titre.he ? titreTexte(x.titre) : null, titreTexte(x.nusah ?? recueil._meta.nusah)].filter(Boolean);
  const ecran = ecranLu(x.titre.he, contenu, { avecNusah: !livre, bande: bande?.nav, entete: bandeauPriere(x.titre.he, etiquettes, livre ? null : horairePriere(x.id)) });
  bande?.suivre(ecran.querySelector('.defile'));
  // Favori et reprise de lecture (14/10, RepriseFavoris.kt) : « s:id » ou « l:id ».
  const cle = `${livre ? 'l' : 's'}:${x.id}`;
  const etoile = h('button', { type: 'button', class: 'favori', 'aria-pressed': String(store.favoris().includes(cle)),
    'aria-label': tr.t(store.favoris().includes(cle) ? 'favori_retirer' : 'favori_ajouter'),
    onclick: (e) => { store.basculerFavori(cle); const fav = store.favoris().includes(cle); e.currentTarget.setAttribute('aria-pressed', String(fav)); e.currentTarget.textContent = fav ? '★' : '☆'; } },
  store.favoris().includes(cle) ? '★' : '☆');
  const listeMarques = h('button', { type: 'button', class: 'favori', 'aria-label': tr.t('marques_titre'), onclick: () => {
    const l = store.marques().filter((m) => m.cle === cleMarque && m.nusah === nusahMarque).sort((a, b) => a.section - b.section || a.bloc - b.bloc);
    if (!l.length) { signale(tr.t('marques_aucun')); return; }
    choisirDans(tr.t('marques_titre'), l.map((m) => `${m.apercu}…`), -1, (k) => allerAMarque(ecran, l[k]));
  } }, iconeMarque(livre));
  ecran.querySelector('.bandeau-actions')?.append(listeMarques, etoile);
  if (marqueAOuvrir?.cle === cleMarque) { const m = marqueAOuvrir; marqueAOuvrir = null; requestAnimationFrame(() => allerAMarque(ecran, m)); return ecran; }
  const defile = ecran.querySelector('.defile');
  if (defile) {
    const place = store.positionLecture(cle);
    if (place > 0 && app.dataset.ecran !== `priere/${onglet}`) requestAnimationFrame(() => { defile.scrollTop = place; });
    let minuteur = null;
    defile.addEventListener('scroll', () => { clearTimeout(minuteur); minuteur = setTimeout(() => store.setPositionLecture(cle, Math.round(defile.scrollTop)), 400); }, { passive: true });
  }
  return ecran;
}

// --- La recherche dans toute l'application (RechercheActivity.kt, 14/10) ------------------
let texteRecherche = '';
/** Où chercher (19/10) : tout, les prières, les halakhot ou les livres (RechercheGlobale.Portee). */
let porteeRecherche = 'tout';
const nuRecherche = (t) => t.replace(/<[^>]+>/g, ' ').replace(/[־׀]/g, ' ').replace(/[\u0591-\u05C7"'״׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
function extraitRecherche(texte, q) {
  const t = nuRecherche(texte);
  const i = Math.max(0, t.indexOf(q));
  const debut = Math.max(0, i - 30);
  return (debut > 0 ? '…' : '') + t.slice(debut, i + q.length + 50).trim() + (i + q.length + 50 < t.length ? '…' : '');
}
function dansRecueil(recueil, q, livre) {
  const r = [];
  for (const t of recueil.textes) {
    if (r.length >= 30) break;
    if (nuRecherche(t.titre.he).includes(q) || nuRecherche(titreTexte(t.titre)).includes(q)) { r.push({ t, extrait: titreTexte(t.titre) !== t.titre.he ? titreTexte(t.titre) : '', livre }); continue; }
    for (const s of t.sections) {
      const b = s.blocs.find((x) => x.t && nuRecherche(x.t).includes(q));
      if (b) { r.push({ t, extrait: extraitRecherche(b.t, q), livre }); break; }
    }
  }
  return r;
}
function ecranRecherche() {
  chargeLivres();
  const q = nuRecherche(texteRecherche.trim());
  const champ = h('input', { type: 'search', class: 'champ-recherche', placeholder: tr.t('recherche_indice'), value: texteRecherche,
    oninput: (e) => { texteRecherche = e.target.value; clearTimeout(ecranRecherche.minuteur); ecranRecherche.minuteur = setTimeout(() => { rendre(); const c = app.querySelector('.champ-recherche'); c?.focus(); c?.setSelectionRange(c.value.length, c.value.length); }, 300); } });
  const resultat = (titre, extrait, onclick) => h('button', { class: 'carte resultat-recherche', onclick },
    h('span', { class: 'resultat-titre', dir: 'auto' }, titre), extrait ? h('span', { class: 'resultat-extrait', dir: 'auto' }, extrait) : null);
  const groupes = [];
  if (q.length >= 2) {
    const p = porteeRecherche;
    const sid = (p === 'tout' || p === 'tefilot') && chargeSiddur() ? dansRecueil(siddur, q, false) : [];
    const liv = (p === 'tout' || p === 'sefarim') && livres ? dansRecueil(livres, q, true) : [];
    const halakhot = p === 'tout' || p === 'halakhot';
    const yy = halakhot && livreYalkut ? rechercheYalkut(livreYalkut, texteRecherche).slice(0, 30) : [];
    const bih = halakhot && livreHalakha ? rechercheHalakha(livreHalakha, texteRecherche).slice(0, 30) : [];
    const hil = p === 'tout' && tableHilloulot() ? rechercheHilloula(tableHilloulot(), texteRecherche).slice(0, 30) : [];
    yalkutDuJour(); livreDuJour();
    const total = sid.length + liv.length + yy.length + bih.length + hil.length;
    groupes.push(h('p', { class: 'jour-sous-titre' }, tr.t('hilloulot_resultats', total)));
    const groupe = (nom, l) => (l.length ? [h('h2', { class: 'section' }, tr.t(nom)), ...l] : []);
    groupes.push(...groupe('siddur_title', sid.map((r) => resultat(r.t.titre.he, r.extrait, () => { priere = r.t.id; ouvrir('priere'); }))));
    groupes.push(...groupe('recherche_livres', liv.map((r) => resultat(r.t.titre.he, r.extrait, () => { priere = `livre:${r.t.id}`; ouvrir('priere'); }))));
    groupes.push(...groupe('halakha_title', [...yy.map((x) => resultat(sourceYalkut(x), extraitRecherche(x.t, q), () => { rechercheHalakhaTexte = texteRecherche; ouvrir('halakha'); })),
      ...bih.map((x) => resultat(sourceHalakha(x, (n) => Reference.lettres(n)), extraitRecherche(x.texte, q), () => { rechercheHalakhaTexte = texteRecherche; ouvrir('halakha'); }))]));
    groupes.push(...groupe('hilloulot_title', hil.map(([, x]) => resultat(x.he, x.a ?? '', () => { rechercheHilloulot = texteRecherche; ouvrir('hilloulot'); }))));
  }
  return h('div', { class: 'ecran' }, barre(tr.t('recherche_titre')),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' }, h('div', { class: 'carte' }, champ,
      h('div', { class: 'puces-recherche', role: 'radiogroup', 'aria-label': tr.t('recherche_titre') },
        [['tout', 'recherche_tout'], ['tefilot', 'recherche_tefilot'], ['halakhot', 'recherche_halakhot'], ['sefarim', 'recherche_sefarim']]
          .map(([cle, nom]) => h('button', { type: 'button', class: 'puce-choix', role: 'radio', 'aria-checked': String(cle === porteeRecherche),
            onclick: () => { porteeRecherche = cle; rendre(); } }, tr.t(nom))))), ...groupes)));
}

/** L'icône des marque-pages (15/10) : ruban en contour pour une prière, livre ouvert et ruban pour une étude. */
function iconeMarque(etude, taille = 22) {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: taille, height: taille, 'aria-hidden': 'true', class: 'icone-marque' })) s.setAttribute(k, v);
  const p = document.createElementNS(NS, 'path');
  if (etude) {
    p.setAttribute('d', 'M2.5 6.5c3-1.3 6.2-1.3 9.5.8v12.2c-3.3-2-6.5-2-9.5-.8z M21.5 6.5c-3-1.3-6.2-1.3-9.5.8v12.2c3.3-2 6.5-2 9.5-.8z');
    for (const [k, v] of Object.entries({ fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linejoin': 'round' })) p.setAttribute(k, v);
    const ruban = document.createElementNS(NS, 'path');
    ruban.setAttribute('d', 'M15 6.4h3.4v8.4l-1.7-1.3-1.7 1.3z'); ruban.setAttribute('fill', 'currentColor');
    s.append(ruban);
  } else {
    p.setAttribute('d', 'M6.5 3.5h11v16.6l-5.5-4.1-5.5 4.1z');
    for (const [k, v] of Object.entries({ fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linejoin': 'round' })) p.setAttribute(k, v);
  }
  s.append(p);
  return s;
}

/** Les premiers mots d'un paragraphe, sans balises ni voyelles (MarquesPages.apercu). */
const apercuMarque = (t) => t.replace(/<[^>]+>/g, ' ').replace(/[־׀]/g, ' ').replace(/[\u0591-\u05C7]/g, '').trim().split(/\s+/).slice(0, 6).join(' ');
/** Le marque-page à rejoindre à l'ouverture du texte (depuis la Bibliothèque). */
let marqueAOuvrir = null;
/** Va au paragraphe marqué ; replié aujourd'hui, à sa section (le premier paragraphe qui suit). */
function allerAMarque(ecran, m) {
  const defile = ecran.querySelector('.defile');
  const cible = ecran.querySelector(`[data-place="${m.section}:${m.bloc}"]`);
  const visible = cible && cible.offsetParent !== null ? cible
    : [...ecran.querySelectorAll('[data-place]')].find((p) => p.offsetParent !== null && Number(p.dataset.place.split(':')[0]) >= m.section);
  if (visible && defile) defile.scrollTop += visible.getBoundingClientRect().top - defile.getBoundingClientRect().top - 8;
}

/** « Reprendre la lecture » et les favoris, en tête de la Bibliothèque (RepriseFavoris.kt). */
function repriseFavoris() {
  const titre = (cle) => {
    const livre = cle.startsWith('l:');
    if (livre ? !livres : !chargeSiddur()) return null;
    return (livre ? livres : siddur).textes.find((t) => t.id === cle.slice(2))?.titre.he ?? null;
  };
  const ouvrirCle = (cle) => { priere = cle.startsWith('l:') ? `livre:${cle.slice(2)}` : cle.slice(2); ouvrir('priere'); };
  const lignes = [];
  const derniere = store.derniereLecture();
  if (derniere && titre(derniere)) lignes.push(ligne({ nom: tr.t('reprise_titre'), etat: titre(derniere), onclick: () => ouvrirCle(derniere) }));
  for (const cle of store.favoris()) {
    const t = titre(cle);
    if (t) lignes.push(ligne({ nom: `★ ${t}`, onclick: () => ouvrirCle(cle) }));
  }
  // Les marque-pages (15/10) : le texte et les premiers mots du paragraphe marqué.
  for (const m of store.marques().slice(0, 12)) {
    const t = titre(m.cle);
    if (t) lignes.push(ligne({ nom: h('span', { class: 'nom-marque' }, iconeMarque(m.cle.startsWith('l:'), 18), t), etat: `${m.apercu}…`, onclick: () => { marqueAOuvrir = m; ouvrirCle(m.cle); } }));
  }
  return lignes.length ? h('div', { class: 'carte' }, ...lignes) : null;
}

// Les annotations des ajouts (tools/siddur_annotations.py), chargées une fois.
let annotationsSiddur = null;
let annotationsDemandees = false;
function chargeAnnotations() {
  if (annotationsSiddur) return true;
  if (!annotationsDemandees) {
    annotationsDemandees = true;
    fetch('data/siddur_annotations.json').then((r) => r.json()).then((d) => { annotationsSiddur = d; rendre(); }).catch(() => {});
  }
  return false;
}

/**
 * Un ajout lié au jour, sous son [nom] déjà traduit. S'il s'applique : mis en
 * évidence. Sinon : replié en une ligne ; la flèche l'ouvre et le referme.
 * Rien n'est jamais retiré : l'annotation n'est qu'indicative.
 */
function ajout(nom, applique, blocs, cond = '') {
  if (applique) {
    return h('div', { class: 'ajout du-jour' },
      h('p', { class: 'ajout-etiquette' }, h('span', { class: 'ajout-pastille' }, tr.t('siddur_aujourdhui')), h('span', {}, nom)), blocs);
  }
  // Le bandeau (19/10) : le nom de l'ajout, dessous ce qu'un toucher fait ; déplié, un panneau
  // qui s'ouvre en glissant, fermé en bas par « Replier ».
  const ferme = tr.t(JAMAIS_DU_JOUR.has(cond) ? 'siddur_toucher_lire' : 'siddur_pas_aujourdhui');
  const corps = h('div', { class: 'ajout-corps', hidden: true }, blocs);
  const bouton = h('button', { type: 'button', class: 'replie-bouton', 'aria-expanded': 'false' },
    h('span', { class: 'replie-icone', 'aria-hidden': 'true' }, icone('replier')),
    h('span', { class: 'replie-texte' }, h('span', { class: 'replie-nom' }, nom), h('span', { class: 'replie-etat' }, ferme)));
  const bas = h('button', { type: 'button', class: 'replie-bas' }, h('span', { class: 'replie-icone', 'aria-hidden': 'true' }, icone('replier')), tr.t('siddur_replier'));
  corps.append(bas);
  const boite = h('div', { class: 'ajout replie' }, bouton, corps);
  const basculer = (depuisBas) => {
    const ouvrir = corps.hidden;
    bouton.setAttribute('aria-expanded', String(ouvrir));
    boite.classList.toggle('ouvert', ouvrir);
    bouton.querySelector('.replie-etat').textContent = ouvrir ? tr.t('siddur_replier') : ferme;
    corps.getAnimations?.().forEach((x) => x.cancel());
    if (ouvrir) {
      corps.hidden = false;
      if (!sansMouvement() && corps.animate) corps.animate([{ height: '0px', opacity: 0 }, { height: `${corps.scrollHeight}px`, opacity: 1 }],
        { duration: Math.min(520, 220 + corps.scrollHeight / 12), easing: 'cubic-bezier(.2,.7,.2,1)' });
      return;
    }
    const fin = () => { corps.hidden = true; if (depuisBas && bouton.getBoundingClientRect().top < 0) bouton.scrollIntoView({ block: 'start', behavior: sansMouvement() ? 'auto' : 'smooth' }); };
    if (sansMouvement() || !corps.animate) return fin();
    corps.animate([{ height: `${corps.offsetHeight}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
      { duration: 200, easing: 'cubic-bezier(.4,0,.6,1)' }).onfinish = fin;
  };
  bouton.addEventListener('click', () => basculer(false));
  bas.addEventListener('click', () => basculer(true));
  return boite;
}

/** Les ajouts qui ne sont jamais « du jour » : « toucher pour lire », pas « pas aujourd'hui ». */
const JAMAIS_DU_JOUR = new Set(['minyan', 'beit_avel', 'oubli']);

/**
 * La bande de signets en tête de la lecture (demande du 10/10, comme
 * SiddurLectureActivity) : une section par signet ; on touche, on y est ; la
 * section qu'on lit se marque d'elle-même (SignetsSiddur). Le signet touché
 * reste marqué tant que le doigt ne reprend pas la page : une section courte
 * de fin ne monte jamais jusqu'en haut.
 */
function bandeSignets(titres) {
  let defile = null;
  let choisi = null;
  let actif = -1;
  // Position d'un titre dans le texte qui défile, quel que soit le défilement.
  const position = (el) => el.getBoundingClientRect().top - defile.getBoundingClientRect().top + defile.scrollTop;
  const signets = titres.map(({ titre, el }, i) => h('button', {
    type: 'button', class: 'signet', lang: 'he',
    onclick: () => { choisi = i; defile.scrollTop = position(el) - 6; marque(i); },
  }, titre));
  const nav = h('nav', { class: 'signets', dir: 'rtl', 'aria-label': tr.t('siddur_signets') }, signets);

  function marque(i) {
    if (i === actif) return;
    actif = i;
    signets.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
    // Le signet en cours reste en vue, au milieu de la bande. offsetLeft et
    // scrollLeft se comptent du même bord, en RTL comme en LTR.
    const b = signets[i];
    nav.scrollTo({ left: b.offsetLeft - (nav.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
  }

  function suit() {
    if (!defile || !defile.isConnected) return;
    if (choisi !== null) { marque(choisi); return; }
    const haut = defile.scrollTop;
    const bas = haut + defile.clientHeight;
    marque(SignetsSiddur.courant(titres.map(({ el }) => position(el)), haut + 12, bas - 1, bas >= defile.scrollHeight - 4));
  }

  return {
    nav,
    suivre(d) {
      defile = d;
      defile.addEventListener('scroll', suit, { passive: true });
      for (const geste of ['touchstart', 'wheel', 'keydown']) defile.addEventListener(geste, () => { choisi = null; }, { passive: true });
      requestAnimationFrame(suit);
    },
  };
}

// --- Le Tikoun lu d'un seul trait (TikkunFlowActivity.kt) -------------------------
// « להמשיך מזה לזה ברצף אחד, ללא הפסק » : l'ouverture, les dix psaumes à la
// suite, la clôture ; rien à toucher entre les psaumes. La kavana et la
// prière de Rabbi Natan ne font pas partie du trait.
function ecranTikkun() {
  if (!tikkun) return h('div', { class: 'ecran' }, barre(tr.t('tikkun_title')), h('div', { class: 'defile' }));
  const titre = (texte) => h('h2', { class: 'psaume-titre' }, texte);
  const paragraphe = (texte) => h('p', { class: 'verset paragraphe' }, texte);
  const blocs = [];
  for (const b of [tikkun.ouverture].filter(Boolean)) blocs.push(titre(b.titre.he), ...b.paragraphes.map(paragraphe));
  for (const p of tikkun.psaumes) {
    blocs.push(titre(tr.t('tikkun_psalm_he', Reference.lettres(p.numero))));
    for (const v of p.versets) {
      blocs.push(h('p', { class: 'verset' }, v.he));
      if (v.arret) blocs.push(h('p', { class: 'arret' }, v.arret.note));
    }
  }
  if (tikkun.cloture) blocs.push(titre(tikkun.cloture.titre.he), ...tikkun.cloture.paragraphes.map(paragraphe));
  const fini = () => {
    // Tout dire d'un trait vaut les dix psaumes.
    for (const p of tikkun.psaumes) store.setTikkunDone(p.numero, true);
    retour();
  };
  return ecranLu(tr.t('tikkun_title'), h('div', { class: 'contenu lecture tikkun' },
    h('div', { class: 'psaume', lang: 'he', dir: 'rtl' }, blocs)), {
    pied: h('div', { class: 'lecture-nav' }, h('button', { class: 'principal', onclick: fini }, tr.t('tikkun_flow_done'))),
  });
}

// --- La bibliothèque (LibraryActivity, LibraryEntryActivity) ----------------------
// Sur le web, les sources seulement : des œuvres du domaine public, dont le
// texte se lit en entier. Les articles, dont le texte reste chez leur
// auteur, attendent leur fiche.
let bibliotheque = null;
let entreeBiblio = null;
function chargeBibliotheque() {
  if (bibliotheque) return true;
  fetch('data/bibliotheque.json').then((r) => r.json()).then((d) => { bibliotheque = d; rendre(); });
  return false;
}

/** Les livres entiers (onglet Bibliothèque, 13/10) : Likoutei Moharan, les méguilot … */
function ecranLivres() {
  const livresPrets = chargeLivres();
  return h('div', { class: 'ecran avec-bandeau' },
    bandeau(tr.t('livres_title'), { puce: h('p', { class: 'bandeau-sous-titre' }, tr.t('livres_hint')), dessin: 'char_torah' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu liste-siddour' },
      ...(livresPrets ? livres.groupes.flatMap((g) => [
        enteteGroupe(g.titre.he, titreTexte(g.titre)),
        h('div', { class: 'carte carte-sections' }, livres.textes.filter((x) => x.groupe === g.cle).map((x) =>
          ligneHebreu(x.titre.he, [titreTexte(x.titre) !== x.titre.he ? titreTexte(x.titre) : null, tr.p('livre_chapitres', x.sections.length)].filter(Boolean).join(' · '),
            () => { priere = `livre:${x.id}`; ouvrir('priere'); }))),
      ]) : []))));
}

/**
 * « J'ai besoin de ’hizouk » (ChizukActivity, 19/10) : un texte à la demande,
 * « Un autre », « Garder » (sur l'appareil) et « Partager » (le seul endroit
 * où un texte de ’hizouk sort de l'appareil, d'un geste de l'utilisateur).
 */
let hizouk = null;
let hizoukChange = false;
function ecranHizouk() {
  const change = hizoukChange;
  hizoukChange = false;
  if (chizuk && !hizouk) hizouk = ChizukBag.tirer(store, chizuk, 'demande');
  const item = hizouk;
  const garde = item && store.chizukFavoris().includes(item.id);
  const gardes = chizuk ? store.chizukFavoris().map((id) => chizuk.items.find((x) => x.id === id)).filter(Boolean) : [];
  const partager = async () => {
    const texte = ChizukRules.partage(ChizukRules.hebreu(chizuk, item), ChizukRules.traduction(item, tr.langue),
      Reference.localise(item.ref, tr.langue), tr.t('partage_lien', LIEN_WEB));
    try { if (navigator.share) { await navigator.share({ text: texte }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(texte); signale(tr.t('partage_copie')); } catch { /* rien d'autre à faire */ }
  };
  return h('div', { class: 'ecran avec-bandeau' },
    bandeau(tr.t('chizuk_demande_title'), { puce: h('p', { class: 'bandeau-sous-titre' }, tr.t('chizuk_demande_hint')), dessin: 'char_open_arms' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu hizouk' },
      item ? (() => { const c = carteChizuk({ moment: 'demande', item }); if (change && !moinsDeMouvement()) c.classList.add('fondu-neuf'); return c; })() : null,
      item ? h('div', { class: 'hizouk-actions' },
        h('button', { class: 'secondaire', onclick: () => { hizouk = ChizukBag.tirer(store, chizuk, 'demande'); hizoukChange = true; rendre(); } }, tr.t('chizuk_autre')),
        h('button', { class: 'secondaire', 'aria-pressed': garde ? 'true' : 'false', onclick: () => { store.basculerChizukFavori(item.id); rendre(); } },
          tr.t(garde ? 'chizuk_garde' : 'chizuk_garder')),
        h('button', { class: 'secondaire', onclick: partager }, tr.t('chizuk_partager'))) : null,
      h('button', { class: 'principal', onclick: () => ouvrir('seance') }, tr.t('chizuk_commencer')),
      gardes.length ? h('h2', { class: 'section' }, tr.t('chizuk_favoris')) : null,
      gardes.length ? h('div', { class: 'carte' }, gardes.map((x) =>
        h('button', { class: 'hizouk-garde', onclick: () => { hizouk = x; hizoukChange = true; rendre(); document.querySelector('.defile')?.scrollTo({ top: 0, behavior: moinsDeMouvement() ? 'auto' : 'smooth' }); } },
          h('span', { class: 'hizouk-garde-texte' }, ChizukRules.traduction(x, tr.langue) || ChizukRules.hebreu(chizuk, x)),
          h('span', { class: 'hizouk-ref' }, Reference.localise(x.ref, tr.langue))))) : null)));
}

/** Les sources de la hitbodedout. */
function ecranBibliotheque() {
  const pret = chargeBibliotheque();
  return h('div', { class: 'ecran avec-bandeau' },
    bandeau(tr.t('library_title'), { puce: h('p', { class: 'bandeau-sous-titre' }, tr.t('library_hint')), dessin: 'char_torah' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu liste-siddour' },
      ...(pret ? LibraryRules.sources(bibliotheque).flatMap((section) => [
        enteteGroupe(section.titre.he, titreTexte(section.titre)),
        ...section.sous_sections.flatMap((sous) => [
          sous.titre.he !== section.titre.he ? h('h3', { class: 'sous-entete' },
            h('span', { class: 'serif-he', lang: 'he', dir: 'rtl' }, sous.titre.he),
            titreTexte(sous.titre) !== sous.titre.he ? h('span', { class: 'entete-trad' }, titreTexte(sous.titre)) : null) : null,
          h('div', { class: 'carte carte-sections' }, sous.entrees.map((e) =>
            ligneHebreu(e.titre_he, Reference.localise(e.ref, tr.langue), () => { entreeBiblio = e.id; ouvrir('source'); }))),
        ]),
      ]) : []))));
}

function ecranSource() {
  if (!chargeBibliotheque()) return h('div', { class: 'ecran' }, barre(tr.t('library_title')), h('div', { class: 'defile' }));
  const e = entreeBiblio ? LibraryRules.entree(bibliotheque, entreeBiblio) : null;
  // Rouvert directement sur #source, sans entrée choisie : la liste.
  if (!e || e.type !== 'source') return ecranBibliotheque();
  return ecranLu(tr.t('library_title'), h('div', { class: 'contenu lecture source-biblio' },
    h('div', { class: 'source-tete' },
      h('div', { class: 'source-titres' },
        h('span', { class: 'badge' }, tr.t('library_kind_source')),
        h('h2', { class: 'source-titre', lang: 'he', dir: 'rtl' }, e.titre_he),
        h('p', { class: 'source-ref' }, Reference.localise(e.ref, tr.langue)))),
    h('div', { class: 'carte carte-texte psaume', lang: 'he', dir: 'rtl' },
      LibraryRules.paragraphes(bibliotheque, e).map((p) => h('p', { class: 'verset paragraphe-source' }, p))),
    // Ni note ni édition sous le texte : l'attribution passe par le lien vers Sefaria.
    e.url ? h('a', { class: 'principal lien-sefaria', href: e.url, target: '_blank', rel: 'noopener noreferrer' }, tr.t('library_open_sefaria')) : null));
}

function panneauTextes() {
  return h('div', { class: 'contenu' },
    h('h1', { class: 'titre-ecran' }, tr.t('nav_texts')),
    // La recherche dans toute l'application (14/10), puis la reprise et les favoris.
    h('button', { class: 'secondaire bouton-recherche', onclick: () => { texteRecherche = ''; ouvrir('recherche'); } }, tr.t('recherche_indice')),
    repriseFavoris(),
    h('div', { class: 'carte' },
      ligne({ nom: tr.t('siddur_title'), etat: tr.t('siddur_hint'), onclick: () => ouvrir('siddur') }),
      // Tehilim est le premier texte lisible sur le web (04/10).
      ligne({ nom: tr.t('tehilim_title'), etat: tr.t('tehilim_today', libellePortion(portionDuMois().portion)), onclick: () => ouvrir('tehilim') }),
      // Le Tikoun, lu d'un trait (04/10).
      ligne({ nom: tr.t('tikkun_title'), etat: etatTikkun(), onclick: () => ouvrir('tikkun') }),
      // Les textes arrivent à l'étape 4.
      ligne({ nom: tr.t('tefilot_title'), etat: tr.t('tefilot_hint'), aVenir: true }),
      // Les livres entiers (13/10), puis les sources de la hitbodedout.
      ligne({ nom: tr.t('livres_title'), etat: tr.t('livres_hint'), onclick: () => ouvrir('livres') }),
      ligne({ nom: tr.t('library_title'), etat: tr.t('library_hint'), onclick: () => ouvrir('bibliotheque') }),
      ligne({ nom: tr.t('chizuk_demande_title'), etat: tr.t('chizuk_demande_hint'), onclick: () => { hizouk = null; ouvrir('hizouk'); } }),
      ligne({ nom: tr.t('tips_title'), etat: tr.t('tips_hint'), aVenir: true })),
    h('h2', { class: 'section' }, tr.t('section_around')),
    h('div', { class: 'carte' },
      ligne({ nom: tr.t('music_title'), etat: etatMusique(), onclick: () => ouvrir('musique') }),
      ligne({ nom: tr.t('settings_title'), onclick: () => ouvrir('reglages') })));
}

function onglets() {
  // Le journal n'existe pas encore sur le web : son onglet est masqué
  // plutôt que montré grisé (finition du 04/10).
  const items = [
    ['aujourdhui', 'nav_today'], ['textes', 'nav_texts'], ['zmanim', 'nav_zmanim'], ['reglages', 'settings_title'],
  ];
  return h('nav', { class: 'onglets' }, items.map(([cle, nom]) => h('button', {
    class: 'onglet',
    'data-onglet': cle,
    'aria-current': cle === onglet ? 'page' : null,
    onclick: () => {
      // Journal et Réglages ouvrent leur écran ; l'onglet actif ne bouge pas (MainActivity.wireTabs).
      if (cle === 'reglages' || cle === 'zmanim') ouvrir(cle);
      else { onglet = cle; rendre(); }
    },
  }, h('span', { class: 'icone', 'aria-hidden': 'true' }), tr.t(nom))));
}

// --- Rendu : écrans secondaires ---------------------------------------------------------
/**
 * La bannière d'une prière ou d'un livre (16/10) : le titre hébreu dans la police du siddour,
 * des étiquettes courtes (le nom traduit, le nusah) au lieu d'une phrase coupée, l'horaire du
 * jour de la prière, et les actions (marque-pages, favori). Jamais d'image : on ne prie pas
 * devant une image (Choul'han Aroukh, O.H. 90, 23).
 */
function bandeauPriere(titreHe, etiquettes, horaire) {
  return h('header', { class: 'bandeau bandeau-priere' },
    h('div', { class: 'bandeau-haut' },
      h('button', { class: 'retour', 'aria-label': tr.t('action_back'), onclick: retour }),
      h('div', { class: 'bandeau-actions' })),
    h('div', { class: 'bandeau-corps' },
      h('h1', { lang: 'he', dir: 'rtl', class: 'titre-priere' }, titreHe),
      etiquettes.length ? h('div', { class: 'etiquettes-bandeau' }, etiquettes.map((e) => h('span', { class: 'etiquette-bandeau' }, e))) : null,
      horaire ? h('p', { class: 'horaire-bandeau' }, horaire) : null));
}

/** L'horaire du jour d'une prière, aux bornes du widget (ZmanimWidget.prochaine) ; null sans lieu. */
function horairePriere(id) {
  const lieu = store.lieu();
  if (!lieu || !['chaharit', 'minha', 'arvit'].includes(id)) return null;
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: lieu.fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const z = Object.fromEntries(zmanimDuJour(lieu, iso).map((x) => [x.cle, x.instant]));
  const hh = (c) => (z[c] ? heureZman(z[c], lieu.fuseau) : null);
  if (id === 'chaharit') return hh('szt_gra') && tr.t('banniere_chaharit', hh('szt_gra'));
  if (id === 'minha') return hh('minha_gedola') && hh('chkia') && tr.t('banniere_minha', hh('minha_gedola'), hh('chkia'));
  return hh('tset') && tr.t('banniere_arvit', hh('tset'));
}

function barre(titre) {
  return h('header', { class: 'barre' },
    h('button', { class: 'retour', 'aria-label': tr.t('action_back'), onclick: retour }),
    h('h1', {}, titre));
}

let apercuAmbiance = null;
function ecranMusique() {
  const choisi = morceauChoisi();
  const interrupteur = h('input', {
    type: 'checkbox', role: 'switch', class: 'interrupteur', checked: store.musicEnabled(),
    'aria-label': tr.t('music_enable'),
    onchange: (e) => { store.setMusicEnabled(e.target.checked); rendre(); },
  });
  return h('div', { class: 'ecran' }, barre(tr.t('music_title')),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      h('div', { class: 'carte' },
        h('label', { class: 'ligne' },
          h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('music_enable')),
            h('div', { class: 'etat' }, tr.t('music_enable_hint'))),
          interrupteur),
        volumeReglable ? h('div', { class: 'ligne' },
          h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('music_volume')),
            h('input', {
              type: 'range', min: 0, max: 100, value: store.musicVolume(), 'aria-label': tr.t('music_volume'),
              oninput: (e) => { store.setMusicVolume(Number(e.target.value)); lecteur.volume = store.musicVolume() / 100; },
            }))) : null,
        // Les ambiances (19/10) : calculées, sous la musique ; cinq secondes d'aperçu hors séance.
        h('button', {
          class: 'ligne', onclick: () => choisirDans(tr.t('ambiance_title'), AMBIANCES.map((a) => tr.t(`ambiance_${a}`)),
            AMBIANCES.indexOf(store.ambiance()), (i) => {
              store.setAmbiance(AMBIANCES[i]);
              if (store.isSessionRunning()) joueAmbiance(AMBIANCES[i], store.musicVolume());
              else { joueAmbiance(AMBIANCES[i], store.musicVolume()); clearTimeout(apercuAmbiance); apercuAmbiance = setTimeout(arreteAmbiance, 5000); }
              rendre();
            }),
        }, h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('ambiance_title')),
          h('div', { class: 'etat' }, tr.t(`ambiance_${store.ambiance()}`))),
        h('span', { class: 'chevron', 'aria-hidden': 'true' }))),
      h('h2', { class: 'section' }, tr.t('music_library')),
      h('div', { class: 'carte' }, morceaux.map((m) => h('div', { class: `ligne morceau${m === choisi ? ' choisi' : ''}` },
        h('button', {
          class: 'corps', onclick: () => { store.setMusicTrackId(m.id); rendre(); },
          'aria-pressed': String(m === choisi),
        }, h('div', { class: 'nom' }, titreMorceau(m)), h('div', { class: 'etat' }, tr.t('music_origin_bundled'))),
        h('button', {
          class: 'ecouter', 'aria-pressed': String(enEcoute === m.id), onclick: () => ecouter(m),
        }, tr.t('music_preview'))))))));
}

// --- Zmanim et calendrier (ZmanimActivity, CalendrierActivity, 10/10) ----------------
let villes = null;
let villesDemandees = false;
function chargeVilles() {
  if (villes) return true;
  if (!villesDemandees) {
    villesDemandees = true;
    fetch('data/villes.json').then((r) => r.json()).then((d) => { villes = d.villes; rendre(); }).catch(() => {});
  }
  return false;
}
let jourCalendrier = null;
let moisCalendrier = null;
/** Le 1er du mois hébreu affiché, en vue hébraïque ; null : celui du jour choisi. */
let moisHebreuCalendrier = null;

/** « 16.1 » → « 16,1 » en français : les paramètres des méthodes, à la locale. */
const parametre = (p) => (p !== '' && !Number.isNaN(Number(p)) ? Number(p).toLocaleString(tr.langue) : p);

/** Choisir le lieu : la position du téléphone, ou une ville de la liste (GeoNames). */
function choisirLieu() {
  chargeVilles();
  feuille(tr.t('zmanim_choisir_lieu'), (f, fermer) => {
    const etat = h('p', { class: 'message', 'aria-live': 'polite' });
    f.append(h('button', {
      class: 'choix',
      onclick: () => {
        if (!navigator.geolocation) { etat.textContent = tr.t('zmanim_position_refusee'); return; }
        etat.textContent = tr.t('zmanim_position_attente');
        // La position (16/10) : basse précision d'abord (plus rapide, et assez pour des zmanim) ;
        // sans réponse, la dernière connue, même ancienne. La ville la plus proche nomme le lieu.
        const poser = (p, ancienne) => {
          const proche = villePlusProche(villes ?? [], p.coords.latitude, p.coords.longitude);
          store.setLieu({
            nom: proche ? tr.t('zmanim_position_pres', titreTexte(proche.nom)) : tr.t('zmanim_position'),
            latitude: p.coords.latitude, longitude: p.coords.longitude,
            // Le fuseau du téléphone ; Israël ou diaspora d'après le territoire (TerritoireIsrael, 16/10).
            altitude: proche?.altitude ?? 0, fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
          store.setInIsrael(dansIsrael(p.coords.latitude, p.coords.longitude));
          if (ancienne) signale(tr.t('zmanim_position_ancienne'));
          fermer();
          rendre();
        };
        const refus = () => { etat.textContent = tr.t('zmanim_position_refusee'); };
        navigator.geolocation.getCurrentPosition((p) => poser(p, false), (e) => {
          if (e.code === 1) { refus(); return; } // refusée : inutile d'insister
          navigator.geolocation.getCurrentPosition((p) => poser(p, true), refus, { maximumAge: Infinity, timeout: 10_000 });
        }, { enableHighAccuracy: false, maximumAge: 3_600_000, timeout: 20_000 });
      },
    }, tr.t('zmanim_position')), etat);
    const courant = store.lieu()?.ville;
    for (const v of villes ?? []) {
      f.append(h('button', {
        class: 'choix', role: 'menuitemradio', 'aria-checked': String(v.id === courant),
        onclick: () => {
          store.setLieu({ nom: titreTexte(v.nom), latitude: v.latitude, longitude: v.longitude, altitude: v.altitude, fuseau: v.fuseau }, v);
          fermer();
          rendre();
        },
      }, titreTexte(v.nom)));
    }
    f.append(h('p', { class: 'indice sources' }, tr.t('zmanim_source_villes')));
  });
}

/** « 40 min avant la chki'a · coutume de Jérusalem », quand Jérusalem est choisie. */
const libelleAllumage = (m) => tr.t(m === 40 && mukafChoma() ? 'reglage_allumage_jerusalem' : 'reglage_allumage_valeur', m);

function choisirTahanounTichri() {
  choisirDans(tr.t('reglage_tahanoun_tichri'), [tr.t('reglage_tahanoun_tichri_dit'), tr.t('reglage_tahanoun_tichri_sans')],
    store.sansTahanounFinTichri() ? 1 : 0, (i) => { store.setSansTahanounFinTichriSfard(i === 1); rendre(); });
}

function choisirAllumage() {
  choisirDans(tr.t('reglage_allumage'), ALLUMAGES.map(libelleAllumage),
    ALLUMAGES.indexOf(store.allumage()), (i) => { store.setAllumage(ALLUMAGES[i]); rendre(); });
}

/** Pourim le 15 Adar d'après le lieu, sans réglage (13/10) : la ville de Jérusalem, ou une position dans Jérusalem (Store.mukafChoma). */
const mukafChoma = () => { const l = store.lieu(); return !!l && (l.ville === JERUSALEM_GEONAMES || (l.ville == null && aJerusalem(l.latitude, l.longitude))); };

/** Birkat haIlanot : en Nissan dans l'hémisphère nord (SiddurMoment.ilanot) ; l'hémisphère sud, voir moisIlanotSud. */
// Hémisphère sud (14/10) : quand les arbres y fleurissent — Eloul (6) et Tichri (7), comme Siddur.moisIlanotSud.
const moisIlanotSud = (mois) => mois === 6 || mois === 7;
function ilanotDuMois(iso) {
  const c = calendrier(iso, store.inIsrael(), false, false);
  const l = store.lieu();
  return l && l.latitude < 0 ? moisIlanotSud(c.getJewishMonth()) : c.getJewishMonth() === 1;
}

/** La Méguila avec la prière : sous Arvit, le jour hébreu de demain ; sous Cha'harit, aujourd'hui (SiddurMoment.megila). */
function megilaDuMoment(moment, iso) {
  if (moment !== 'chaharit' && moment !== 'arvit') return false;
  const [a, m, d] = iso.split('-').map(Number);
  const jour = moment === 'arvit' ? new Date(Date.UTC(a, m - 1, d + 1, 12)).toISOString().slice(0, 10) : iso;
  const fetes = jourJuif(jour, store.inIsrael(), mukafChoma()).fetes;
  const semaine = new Date(`${jour}T12:00:00Z`).getUTCDay();
  if (fetes.includes('pourim') || (fetes.includes('pourim_jerusalem') && semaine !== 6)) return true;
  return mukafChoma() && fetes.includes('pourim_ailleurs') && semaine === 5;
}

/** La date hébraïque d'un jour, ses fêtes, et ce qu'il change aux prières. */
// La hilloula du jour (11/10) : hilloulot.json, chargé à la première carte.
let hilloulots = null;
let hilloulotsDemandees = false;
function tableHilloulot() {
  if (!hilloulotsDemandees) {
    hilloulotsDemandees = true;
    fetch('data/hilloulot.json').then((r) => r.json()).then((d) => { hilloulots = hilloulots ?? d.jours; rendre(); }).catch(() => {});
  }
  return hilloulots;
}

// Les biographies d'autres sources (hilloulot_bios.json, 12/10), à part pour que la carte du
// jour reste légère : lues à l'écran des hilloulot ; par jour, une entrée par hilloula, dans le même ordre.
let biosDemandees = false;
function chargeBiosHilloulot() {
  if (biosDemandees) return;
  biosDemandees = true;
  Promise.all([fetch('data/hilloulot.json').then((r) => r.json()), fetch('data/hilloulot_bios.json').then((r) => r.json())])
    .then(([d, bios]) => {
      hilloulots = hilloulots ?? d.jours;
      hilloulotsDemandees = true;
      for (const [cle, ligne] of Object.entries(bios)) ligne.forEach((b, i) => { if (b && hilloulots[cle]?.[i]) hilloulots[cle][i].b = b; });
      rendre();
    }).catch(() => { biosDemandees = false; });
}

// La halakha du jour (11/10) : ben_ish_hai.json, chargé à la première carte.
let livreHalakha = null;
let livreHalakhaDemande = false;
function livreDuJour() {
  if (!livreHalakhaDemande) {
    livreHalakhaDemande = true;
    fetch('data/ben_ish_hai.json').then((r) => r.json()).then((d) => { livreHalakha = d; rendre(); }).catch(() => {});
  }
  return livreHalakha;
}

// La halakha courte du jour (13/10) : yalkut_yosef.json, chargé à la première carte.
let livreYalkut = null;
let livreYalkutDemande = false;
function yalkutDuJour() {
  if (!livreYalkutDemande) {
    livreYalkutDemande = true;
    fetch('data/yalkut_yosef.json').then((r) => r.json()).then((d) => { livreYalkut = d; rendre(); }).catch(() => {});
  }
  return livreYalkut;
}

function lienExterne(libelle, url) {
  return h('a', { class: 'jour-lien', href: url, target: '_blank', rel: 'noopener' }, `${libelle} ↗`);
}

function carteJour(iso, { complet = true } = {}) {
  const j = jourJuif(iso, store.inIsrael(), mukafChoma());
  // L'omer se compte le soir, pour le jour hébreu qui commence : celui de demain.
  const [a, m, d] = iso.split('-').map(Number);
  const omerCeSoir = jourJuif(new Date(Date.UTC(a, m - 1, d + 1, 12)).toISOString().slice(0, 10), store.inIsrael()).omer;
  const civil = new Intl.DateTimeFormat(tr.langue, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`));
  const marques = [
    ...j.fetes.map((f) => tr.t(`fete_${f}`)),
    j.paracha ? tr.t('zmanim_paracha', j.paracha) : null,
    omerCeSoir ? tr.t('zmanim_omer_ce_soir', omerCeSoir) : null,
  ].filter(Boolean);
  const dessin = illustrationDuJour(j.fetes, iso);
  return h('div', { class: 'carte carte-jour' },
    dessin ? h('img', { class: 'jour-illustration', src: `img/${dessin}.webp`, alt: '' }) : null,
    h('p', { class: 'jour-hebreu', lang: 'he', dir: 'rtl' }, j.dateHebraique),
    h('p', { class: 'jour-civil' }, civil),
    marques.length ? h('div', { class: 'jour-marques' }, marques.map((m) => h('span', { class: 'marque' }, m))) : null,
    h('h3', { class: 'jour-sous-titre' }, tr.t('zmanim_ajouts_titre')),
    h('p', { class: 'jour-ajouts' }, ajoutsDuJour(j.conditions, store.siddurNusah(), store.inIsrael(), store.sansTahanounFinTichri(), hemisphereSud()).map((k) => tr.t(k)).join(' · ')),
    // Partager le jour en image (14/10, PartageJour.kt).
    h('button', { class: 'jour-lien lien-bouton', onclick: () => partagerJour(iso) }, `${tr.t('partage_jour')} ↗`),
    // Le calendrier montre tout ; l'écran Zmanim (14/10) n'y garde que le jour (sousHoraires).
    ...(complet ? [store.levanaAffichee() ? blocLevana(iso) : null, ...blocHilloula(iso), ...blocHalakha(iso)] : []));
}

/**
 * Partager un jour (PartageJour.kt) : une image de 1080 × 1350 — date hébraïque et
 * civile, fêtes et paracha, hilloula, début de la halakha — par le partage du
 * téléphone, sinon téléchargée. Rien ne part sans ce geste.
 */
async function partagerJour(iso) {
  const j = jourJuif(iso, store.inIsrael(), mukafChoma());
  const civil = new Intl.DateTimeFormat(tr.langue, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
  const marques = [...j.fetes.map((f) => tr.t(`fete_${f}`)), j.paracha ? tr.t('zmanim_paracha', j.paracha) : null].filter(Boolean).join('  ·  ');
  const hil = tableHilloulot() ? hilloulotPour(tableHilloulot(), iso, store.inIsrael(), store.siddurNusah() === 'ashkenaz').slice(0, 3).map((x) => x.he).join(' · ') : '';
  const [livre, debut] = apercuHalakha(iso) ?? ['', ''];
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const g = c.getContext('2d');
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--brand-dark').trim() || '#123d33';
  g.fillRect(0, 0, c.width, c.height);
  const M = 84;
  let y = M + 60;
  const lignes = (texte, taille, couleur, police, rtl, apres) => {
    if (!texte) return;
    g.font = `${taille}px ${police}`; g.fillStyle = couleur; g.direction = rtl ? 'rtl' : 'ltr'; g.textAlign = rtl ? 'right' : 'left';
    const x = rtl ? c.width - M : M;
    let l = '';
    for (const mot of texte.split(' ')) {
      if (g.measureText(`${l} ${mot}`).width > c.width - 2 * M && l) { g.fillText(l, x, y); y += taille * 1.3; l = mot; } else l = l ? `${l} ${mot}` : mot;
    }
    if (l) { g.fillText(l, x, y); y += taille * 1.3; }
    y += apres;
  };
  const he = '"Frank Ruhl Libre", "Hebreu Serif", serif';
  const ui = 'system-ui, sans-serif';
  lignes(j.dateHebraique, 92, '#fff', `bold ${he}`, true, 0);
  lignes(civil, 40, 'rgba(255,255,255,.8)', ui, tr.rtl, 16);
  lignes(marques, 40, '#fff', `bold ${ui}`, tr.rtl, 36);
  if (hil) { lignes(tr.t('hilloula_titre'), 30, 'rgba(255,255,255,.8)', `bold ${ui}`, tr.rtl, 0); lignes(hil, 44, '#fff', he, true, 36); }
  if (debut) {
    lignes(`${tr.t('halakha_yomit_titre')} · ${livre}`, 30, 'rgba(255,255,255,.8)', `bold ${ui}`, tr.rtl, 0);
    lignes(debut.length > 420 ? `${debut.slice(0, 420)}…` : debut, 42, '#fff', he, true, 0);
  }
  g.font = `bold 30px ${ui}`; g.fillStyle = 'rgba(255,255,255,.8)'; g.direction = 'ltr'; g.textAlign = 'left';
  g.fillText(tr.t('app_name'), M, c.height - M / 2);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const fichier = new File([blob], `jour-${iso}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [fichier] })) {
    try { await navigator.share({ files: [fichier], title: j.dateHebraique }); return; } catch { /* annulé : rien à faire */ return; }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: fichier.name });
  document.body.append(a); a.click(); a.remove();
}

/**
 * Sous les horaires de l'écran Zmanim (14/10, « trop de choses avant les זמנים ») :
 * Birkat haLevana, la hilloula, la halakha, chacune dans sa carte, chacune masquable.
 */
function sousHoraires(iso) {
  const carte = (blocs) => (blocs.length ? h('div', { class: 'carte carte-jour carte-sous-horaires' }, ...blocs) : null);
  return [carte(store.levanaAffichee() ? [blocLevana(iso)] : []), carte(blocHilloula(iso)), carte(blocHalakha(iso))].filter(Boolean);
}

/**
 * La lune de ce soir (Levana.Dessin) : le disque sombre, la part éclairée à sa vraie
 * mesure, du côté où la voit l'hémisphère du lieu, quelques mers.
 */
function dessinLune({ eclairage, croissante }, sud) {
  const r = 27;
  const droite = croissante !== sud;
  const e = r * Math.abs(1 - 2 * eclairage);
  const bombe = eclairage > 0.5 ? droite : !droite;
  // Le demi-disque éclairé, refermé par le terminateur (une demi-ellipse).
  const chemin = `M28 1 A${r} ${r} 0 0 ${droite ? 1 : 0} 28 55 A${e.toFixed(2)} ${r} 0 0 ${bombe ? 1 : 0} 28 1 Z`;
  const ns = 'http://www.w3.org/2000/svg';
  const el = (nom, attrs) => { const n = document.createElementNS(ns, nom); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
  const svg = el('svg', { viewBox: '0 0 56 56', class: 'lune', 'aria-hidden': 'true' });
  const id = `lune-${Math.random().toString(36).slice(2, 8)}`;
  const defs = el('defs', {});
  const clip = el('clipPath', { id });
  clip.append(el('path', { d: chemin }));
  defs.append(clip);
  svg.append(defs, el('circle', { cx: 28, cy: 28, r, class: 'lune-ombre' }));
  const g = el('g', { 'clip-path': `url(#${id})` });
  g.append(el('circle', { cx: 28, cy: 28, r, class: 'lune-clair' }));
  for (const [x, y, t] of [[-0.25, -0.3, 0.22], [0.2, -0.1, 0.18], [-0.05, 0.25, 0.2], [0.35, 0.35, 0.1]]) {
    g.append(el('circle', { cx: 28 + x * r, cy: 28 + y * r, r: t * r, class: 'lune-mer' }));
  }
  svg.append(g, el('circle', { cx: 28, cy: 28, r, class: 'lune-bord' }));
  return svg;
}

/** L'usage de Birkat haLevana : celui choisi, sinon celui du noussa'h (VueJour.usageLevana). */
/** Le lieu des zmanim est au sud de l'équateur (Store.hemisphereSud). */
const hemisphereSud = () => (store.lieu()?.latitude ?? 0) < 0;

const usageLevanaCourant = () => usageLevana(store.siddurNusah(), store.levanaUsage());

/**
 * Birkat haLevana (Levana.kt ; plus réaliste le 14/10) : la lune de ce soir dessinée,
 * ce soir ou dans combien de jours, la fenêtre à l'heure près, le motsaé Chabbat
 * conseillé, Kippour et Tich'a beAv, la jauge du mois lunaire, l'usage suivi.
 */
function blocLevana(iso) {
  const lieu = store.lieu();
  const zone = lieu?.fuseau ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const usage = usageLevanaCourant();
  const l = levana(iso, zone, { usage });
  const court = (d) => new Intl.DateTimeFormat(tr.langue, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const heure = (ms) => new Intl.DateTimeFormat(tr.langue, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).format(new Date(ms));
  const etat = l.etat === 'ce_soir' ? tr.t('levana_ce_soir') : l.etat === 'dernier' ? tr.t('levana_dernier_soir') : tr.p('levana_dans', l.etat.dans);
  const pct = (x) => `${(x * 100).toFixed(2)}%`;
  return h('div', { class: 'levana' },
    h('div', { class: 'levana-tete' },
      dessinLune(l.lune, (lieu?.latitude ?? 1) < 0),
      h('div', { class: 'levana-corps' },
        h('h3', { class: 'jour-sous-titre' }, tr.t('levana_titre')),
        h('p', { class: `levana-etat${typeof l.etat === 'string' ? ' ouvert' : ''}` }, etat),
        h('p', { class: 'levana-lune' }, tr.t('levana_lune', `${Math.round(l.lune.eclairage * 100)} %`, tr.t(l.lune.croissante ? 'levana_croissante' : 'levana_decroissante'))))),
    h('p', { class: 'levana-fenetre' }, tr.t('levana_fenetre', heure(l.debutMs), heure(l.finMs))),
    l.motsae ? h('p', { class: 'levana-conseil' }, tr.t('levana_motsae', court(l.motsae))) : null,
    l.restriction ? h('p', { class: 'levana-conseil' }, tr.t(l.restriction === 'kippour' ? 'levana_kippour' : 'levana_tisha')) : null,
    h('div', { class: 'levana-jauge', 'aria-hidden': 'true' },
      h('span', { class: 'levana-fil' }),
      h('span', { class: 'levana-or', style: `inset-inline-start: ${pct(l.debut)}; width: ${pct(l.fin - l.debut)}` }),
      h('span', { class: 'levana-point', style: `inset-inline-start: ${pct(l.point)}` })),
    h('p', { class: 'levana-source' }, tr.t('levana_source', tr.t(`levana_usage_${usage}`))),
    // Le texte en un toucher (14/10), dans le noussa'h choisi.
    h('button', { class: 'jour-lien lien-bouton', onclick: () => { priere = 'birkat_halevana'; ouvrir('priere'); } }, tr.t('levana_lire')));
}

/** Le début de la halakha du jour dans le livre choisi (14/10) : [livre, texte], ou null. */
function apercuHalakha(iso) {
  const source = store.sourceHalakha();
  if (source !== 'ben_ish_hai') {
    const livre = yalkutDuJour();
    const x = livre ? yalkutPour(livre, iso, store.inIsrael())[0] : null;
    if (x) return [tr.t('halakha_livre'), x.t];
  }
  if (source !== 'yalkut') {
    const livre = livreDuJour();
    const x = livre ? halakhotPour(livre, iso, store.inIsrael())[0] : null;
    if (x) return [tr.t('halakha_ben_ish_hai'), x.texte];
  }
  return null;
}

/** La halakha du jour, hors ligne : son début dans le livre choisi, puis l'écran de la halakha. */
function blocHalakha(iso) {
  const apercu = store.halakhaAffichee() ? apercuHalakha(iso) : null;
  if (!apercu) return [];
  return [
    h('h3', { class: 'jour-sous-titre' }, `${tr.t('halakha_yomit_titre')} · ${apercu[0]}`),
    h('p', { class: 'jour-halakha', lang: 'he', dir: 'rtl' }, apercu[1]),
    h('button', { class: 'jour-lien lien-bouton', onclick: () => { jourHalakha = iso; rechercheHalakhaTexte = ''; ouvrir('halakha'); } }, tr.t('halakha_tout')),
  ];
}

// --- L'écran de la halakha du jour (HalakhaActivity, 11/10) -----------------------
const SOURCES_HALAKHA = [['yalkut', 'halakha_source_yalkut'], ['ben_ish_hai', 'halakha_source_bih'], ['les_deux', 'halakha_source_deux']];
let jourHalakha = null;
let rechercheHalakhaTexte = '';

/**
 * Un écran à bandeau dont le texte se règle (halakha, hilloulot) : la même
 * barre de lecture que les textes saints, taille et police ; la nuit reste aux textes saints.
 */
function zoneReglable(contenu) {
  const defile = h('div', { class: 'defile' }, contenu);
  appuiLongPourRamener(defile);
  return h('div', { class: 'lu-zone sans-pied reglable' }, defile, reglagesLecture({ avecNusah: false, sansNuit: true }));
}

function ecranHalakha() {
  const source = store.sourceHalakha();
  const avecYalkut = source !== 'ben_ish_hai';
  const avecBih = source !== 'yalkut';
  const livre = (avecBih ? livreDuJour() : livreHalakha) ?? { annees: {} };
  const iso = jourHalakha ?? isoLocal(new Date());
  const yalkut = yalkutDuJour() ?? { periodes: {} };
  const fiche = (titre, texte) => h('div', { class: 'carte carte-hilloula' },
    h('p', { class: 'halakha-source', lang: 'he', dir: 'rtl' }, titre),
    h('p', { class: 'halakha-texte', lang: 'he', dir: 'rtl' }, paragraphes(texte)));
  const carte = (x) => fiche(sourceHalakha(x, (n) => Reference.lettres(n)), x.texte);
  const carteYalkut = (x) => fiche(sourceYalkut(x), x.t);
  const champ = h('input', { type: 'search', class: 'champ-recherche', placeholder: tr.t('halakha_recherche'), value: rechercheHalakhaTexte,
    oninput: (e) => { rechercheHalakhaTexte = e.target.value; rendre(); setTimeout(() => { const c = app.querySelector('.champ-recherche'); c?.focus(); c?.setSelectionRange(c.value.length, c.value.length); }, 0); } });
  let corps;
  if (rechercheHalakhaTexte.trim().length >= 2) {
    const yy = avecYalkut ? rechercheYalkut(yalkut, rechercheHalakhaTexte) : [];
    const trouves = avecBih ? rechercheHalakha(livre, rechercheHalakhaTexte) : [];
    corps = [h('p', { class: 'jour-sous-titre' }, tr.t('hilloulot_resultats', yy.length + trouves.length)),
      ...yy.slice(0, 40).map(carteYalkut), ...trouves.slice(0, 40).map(carte)];
  } else {
    const j = jourJuif(iso, store.inIsrael());
    const decale = (n) => { const [a, m, d] = iso.split('-').map(Number); jourHalakha = new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10); rendre(); };
    const liste = avecBih && livreHalakha ? halakhotPour(livre, iso, store.inIsrael()) : [];
    // Le Yalkut Yosef d'abord (13/10), deux halakhot courtes ; puis le Ben Ish 'Haï de la semaine ; selon le livre choisi (14/10).
    const yy = avecYalkut && livreYalkut ? yalkutPour(yalkut, iso, store.inIsrael()) : [];
    corps = [
      h('div', { class: 'mois-tete' },
        h('button', { class: 'icone-bouton mois-precedent', dir: 'ltr', 'aria-label': tr.t('calendrier_precedent'), onclick: () => decale(-1) }, tr.rtl ? '›' : '‹'),
        h('div', { class: 'mois-titres' }, h('p', { class: 'mois-principal mois-hebreu', lang: 'he', dir: 'rtl' }, j.dateHebraique), h('p', { class: 'mois-second' }, iso)),
        h('button', { class: 'icone-bouton mois-suivant', dir: 'ltr', 'aria-label': tr.t('calendrier_suivant'), onclick: () => decale(1) }, tr.rtl ? '‹' : '›')),
      ...(yy.length ? [fiche(titreCarte(yy), texteCarte(yy))] : []),
      ...(liste.length ? [h('h3', { class: 'jour-sous-titre' }, tr.t('halakha_ben_ish_hai')), ...liste.map(carte)] : []),
      ...(yy.length || liste.length ? [] : [h('p', { class: 'message' }, tr.t('halakha_aucune'))]),
      avecYalkut ? h('p', { class: 'note-halakha' }, tr.t('halakha_yalkut_source')) : null,
      h('p', { class: 'note-halakha' }, tr.t('halakha_note')),
      // Le site de Rav Ovadia Yossef : un lien seulement (tous droits réservés sur ses textes).
      lienExterne(tr.t('halakha_yomit_lien'), lienHalakha(tr.langue)),
    ];
  }
  return h('div', { class: 'ecran avec-bandeau' }, bandeau(tr.t('halakha_title')),
    zoneReglable(h('div', { class: 'contenu' },
      h('div', { class: 'carte' },
        h('label', { class: 'ligne' }, h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('halakha_afficher'))),
          h('input', { type: 'checkbox', role: 'switch', class: 'interrupteur', checked: store.halakhaAffichee(), 'aria-label': tr.t('halakha_afficher'),
            onchange: (e) => { store.setHalakhaAffichee(e.target.checked); rendre(); } })),
        // Le livre (14/10, « propose le choix à l'utilisateur ») : Yalkut Yosef, Ben Ish 'Haï, ou les deux.
        h('p', { class: 'jour-sous-titre' }, tr.t('halakha_source_titre')),
        h('div', { class: 'puces-choix', role: 'radiogroup', 'aria-label': tr.t('halakha_source_titre') },
          SOURCES_HALAKHA.map(([cle, nom]) => h('button', { type: 'button', class: 'puce-choix', role: 'radio', 'aria-checked': String(cle === source),
            onclick: () => { store.setSourceHalakha(cle); rendre(); } }, tr.t(nom)))),
        champ),
      ...corps)));
}

/** La hilloula du jour (comme CalJ) : les noms, cinq au plus, puis l'écran des hilloulot. */
/** Domaine public et CC0 ne demandent aucune mention ; CC-BY et CC-BY-SA, si (sans le nom de Sefaria). */
function mentionsObligatoires(sources) {
  return (sources || []).filter((x) => x.includes('CC-BY')).map((x) => x.replace('Sefaria / ', '').replace('Sefaria, ', ''));
}

function blocHilloula(iso) {
  const table = tableHilloulot();
  if (!table || !store.hilloulotAffichees()) return [];
  const liste = hilloulotPour(table, iso, store.inIsrael(), store.siddurNusah() === 'ashkenaz');
  if (!liste.length) return [];
  const reste = liste.length - 5;
  const versHilloulot = () => { jourHilloulot = iso; rechercheHilloulot = ''; ouvrir('hilloulot'); };
  return [
    h('h3', { class: 'jour-sous-titre' }, tr.t('hilloula_titre')),
    h('div', { class: 'jour-hilloula', lang: 'he', dir: 'rtl' }, ...liste.slice(0, 5).map((x) => h('div', {}, x.he)),
      reste > 0 ? h('button', { class: 'jour-hilloula-reste lien-bouton', onclick: versHilloulot }, `${tr.p('hilloula_autres', reste)} ›`) : null),
    h('button', { class: 'jour-lien lien-bouton', onclick: versHilloulot }, tr.t('hilloulot_tout')),
  ];
}

// --- L'écran des hilloulot (HilloulotActivity, 11/10) --------------------------------
let jourHilloulot = null;
let rechercheHilloulot = '';

function ecranHilloulot() {
  chargeBiosHilloulot();
  const table = tableHilloulot() ?? {};
  const iso = jourHilloulot ?? isoLocal(new Date());
  const carte = (x, date) => h('div', { class: 'carte carte-hilloula' },
    h('p', { class: 'hilloula-nom', lang: 'he', dir: 'rtl' }, x.he),
    (tr.langue === 'fr' ? x.fr : tr.langue === 'en' ? x.en : null) ? h('p', { class: 'hilloula-traduit' }, tr.langue === 'fr' ? x.fr : x.en) : null,
    // Isolés (FSI … PDI) : la date et l'année hébraïques ne renversent pas la ligne.
    [date, x.a].some(Boolean)
      ? h('p', { class: 'hilloula-annee' }, [date ? `\u2068${date}\u2069` : null, x.a ? tr.t('hilloula_annee', `\u2068${x.a}\u2069`) : null].filter(Boolean).join(' · ')) : null,
    x.t ? h('p', { class: 'hilloula-description', lang: 'he', dir: 'rtl' }, paragraphes(x.t)) : null,
    x.s.includes('w') ? (x.w ? h('a', { class: 'hilloula-source', href: lienArticle(x.w), target: '_blank', rel: 'noopener' }, tr.t('hilloula_source_wiki'))
      : h('p', { class: 'hilloula-source' }, tr.t('hilloula_source_wiki'))) : null,
    x.s.includes('h') ? h('p', { class: 'hilloula-source' }, tr.t('hilloula_source_hyomi')) : null,
    x.s.includes('e') ? h('p', { class: 'hilloula-source' }, tr.t('hilloula_source_toratemet')) : null,
    // Les autres biographies (MyTzadik, המאיר לארץ), chacune suivie de sa source, comme le demande l'accord (12/10).
    ...(x.b ?? []).flatMap(([src, texte, lien]) => {
      const nom = tr.t(src === 'm' ? 'hilloula_source_mytzadik' : 'hilloula_source_hameir');
      // Une longue biographie se replie à huit lignes ; « Lire la suite » la déplie.
      const long = texte.length > 500;
      const p = h('p', { class: `hilloula-description${long ? ' replie' : ''}`, lang: 'he', dir: 'rtl' }, paragraphes(texte));
      const bascule = long ? h('button', { type: 'button', class: 'lien-bouton hilloula-plus', 'aria-expanded': 'false', onclick: (e) => {
        const ouvert = p.classList.toggle('replie') === false;
        e.currentTarget.setAttribute('aria-expanded', String(ouvert));
        e.currentTarget.textContent = tr.t(ouvert ? 'hilloula_reduire' : 'hilloula_lire_plus');
      } }, tr.t('hilloula_lire_plus')) : null;
      return [p, bascule,
        lien ? h('a', { class: 'hilloula-source', href: lien, target: '_blank', rel: 'noopener' }, `${nom} ↗`) : h('p', { class: 'hilloula-source' }, nom)];
    }),
    x.i ? h('a', { class: 'hilloula-source', href: x.i, target: '_blank', rel: 'noopener' }, `${tr.t('hilloula_source_hidabroot')} ↗`) : null);
  const champ = h('input', { type: 'search', class: 'champ-recherche', placeholder: tr.t('hilloulot_recherche'), value: rechercheHilloulot,
    oninput: (e) => { rechercheHilloulot = e.target.value; rendre(); setTimeout(() => { const c = app.querySelector('.champ-recherche'); c?.focus(); c?.setSelectionRange(c.value.length, c.value.length); }, 0); } });
  let corps;
  if (rechercheHilloulot.trim().length >= 2) {
    const trouves = rechercheHilloula(table, rechercheHilloulot);
    corps = [h('p', { class: 'jour-sous-titre' }, tr.t('hilloulot_resultats', trouves.length)), ...trouves.slice(0, 60).map(([cle, x]) => carte(x, dateHilloula(cle, (n) => Reference.lettres(n))))];
  } else {
    const j = jourJuif(iso, store.inIsrael());
    const decale = (n) => { const [a, m, d] = iso.split('-').map(Number); jourHilloulot = new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10); rendre(); };
    const liste = hilloulotPour(table, iso, store.inIsrael(), store.siddurNusah() === 'ashkenaz');
    corps = [
      h('div', { class: 'mois-tete' },
        h('button', { class: 'icone-bouton mois-precedent', dir: 'ltr', 'aria-label': tr.t('calendrier_precedent'), onclick: () => decale(-1) }, tr.rtl ? '›' : '‹'),
        h('div', { class: 'mois-titres' }, h('p', { class: 'mois-principal mois-hebreu', lang: 'he', dir: 'rtl' }, j.dateHebraique), h('p', { class: 'mois-second' }, iso)),
        h('button', { class: 'icone-bouton mois-suivant', dir: 'ltr', 'aria-label': tr.t('calendrier_suivant'), onclick: () => decale(1) }, tr.rtl ? '‹' : '›')),
      ...(liste.length ? liste.map((x) => carte(x, null)) : [h('p', { class: 'message' }, tr.t('hilloulot_aucune'))]),
      lienExterne(tr.t('hilloula_lien'), lienHyomi(iso)),
    ];
  }
  return h('div', { class: 'ecran avec-bandeau' }, bandeau(tr.t('hilloulot_title')),
    zoneReglable(h('div', { class: 'contenu' },
      h('div', { class: 'carte' },
        h('label', { class: 'ligne' }, h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('hilloulot_afficher'))),
          h('input', { type: 'checkbox', role: 'switch', class: 'interrupteur', checked: store.hilloulotAffichees(), 'aria-label': tr.t('hilloulot_afficher'),
            onchange: (e) => { store.setHilloulotAffichees(e.target.checked); rendre(); } })),
        champ),
      ...corps)));
}

/** Les horaires d'un jour, chacun avec sa méthode ; ou l'invitation à choisir un lieu. */
function listeZmanim(iso) {
  const lieu = store.lieu();
  if (!lieu) {
    return h('div', { class: 'carte carte-texte' }, h('p', { class: 'message' }, tr.t('zmanim_sans_lieu')),
      h('button', { class: 'principal', onclick: choisirLieu }, tr.t('zmanim_choisir_lieu')));
  }
  return h('div', { class: 'carte carte-zmanim' }, horaires(lieu, iso, store.inIsrael(), store.allumage()).map((z) =>
    h('div', { class: `zman${z.cle === 'allumage' || z.cle === 'sortie' ? ' zman-chabbat' : ''}` },
      h('div', { class: 'zman-tete' },
        h('span', { class: 'zman-nom' }, tr.t(`zman_${z.cle}`)),
        h('span', { class: 'zman-heure', dir: 'ltr' }, z.statut === 'ok' ? heureZman(z.instant, lieu.fuseau) : '—')),
      h('div', { class: 'zman-methode' }, z.statut === 'ok'
        ? tr.t(`zman_methode_${z.methode}`, parametre(z.parametres))
        : tr.t(z.statut === 'absent' ? 'zmanim_absent' : 'zmanim_erreur')))));
}

const piedZmanim = () => [h('p', { class: 'indice sources' }, tr.t('zmanim_a_valider')),
  h('p', { class: 'indice sources' }, tr.t('zmanim_source_villes'))];

function ecranZmanim() {
  chargeVilles();
  const iso = isoLocal(new Date());
  const lieu = store.lieu();
  const puce = h('button', {
    type: 'button', class: 'puce-bandeau', 'aria-haspopup': 'dialog', onclick: choisirLieu,
    'aria-label': `${tr.t('reglage_lieu')} : ${lieu ? lieu.nom : tr.t('reglage_lieu_aucun')}`,
  }, h('span', {}, lieu ? tr.t('zmanim_lieu_detail', lieu.nom, tr.t(store.inIsrael() ? 'region_israel' : 'region_diaspora')) : tr.t('zmanim_choisir_lieu')), icone('replier'));
  return h('div', { class: 'ecran avec-bandeau' }, bandeau(tr.t('zmanim_title'), { puce, dessin: 'char_torah' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      // Le jour seul, trois boutons, puis les horaires (14/10, « trop de choses avant les זמנים »).
      carteJour(iso, { complet: false }),
      h('div', { class: 'boutons-jour' },
        h('button', { class: 'secondaire', onclick: () => { jourHalakha = iso; rechercheHalakhaTexte = ''; ouvrir('halakha'); } }, tr.t('zmanim_bouton_halakha')),
        h('button', { class: 'secondaire', onclick: () => { jourHilloulot = iso; rechercheHilloulot = ''; ouvrir('hilloulot'); } }, tr.t('zmanim_bouton_hilloulot')),
        h('button', { class: 'secondaire', onclick: () => { jourCalendrier = iso; moisCalendrier = null; ouvrir('calendrier'); } }, tr.t('zmanim_calendrier'))),
      listeZmanim(iso),
      ...sousHoraires(iso),
      ...piedZmanim())));
}

/**
 * Le calendrier : un mois, du dimanche au samedi ; un jour touché montre son détail.
 * Le mois hébreu est la vue principale, le mois civil au choix ; chaque case porte
 * toujours les deux quantièmes, le principal en haut.
 */
// --- Les paliers d'objectifs (PaliersActivity, 11/10) --------------------------------
function bilanPaliers() {
  const aujourdhui = isoLocal(new Date());
  return { aujourdhui, minutes: store.minutesParJour(), serie: store.streak(), debutMoisHebreu: debutMoisHebreu(aujourdhui), objectifJour: store.dailyGoal() };
}

function libellePalier(piste, bilan) {
  return piste === 'mois' ? tr.t('palier_mois', `\u2068${jourJuif(bilan.aujourdhui, false).moisEtAnnee}\u2069`) : tr.t(`palier_${piste}`);
}

/** Des jours pour la série et les jours de pratique, une durée pour le reste. */
const valeurPalier = (piste, v) => (piste === 'serie' || piste === 'jours' ? tr.p('palier_n_jours', v) : tr.duree(v));

/** Le palier le plus proche, sous les anneaux, et la fête d'un palier atteint depuis la dernière visite. */
function lignePaliers() {
  const bilan = bilanPaliers();
  const etats = Paliers.etats(bilan);
  const vus = store.paliersVus();
  // Un trophée neuf d'abord, sinon le plus haut palier neuf : les confettis (11/10).
  const gagnes = Trophees.gagnes(pratique());
  const tropheesNeufs = Trophees.nouveaux(gagnes, store.tropheesVus());
  const trophee = tropheesNeufs[0];
  const neuf = vus ? Paliers.nouveaux(etats, bilan, vus).sort((a, b) => b.rang - a.rang)[0] : null;
  const message = trophee ? tr.t('trophee_niveau_gagne', tr.t(`trophee_${trophee.famille.cle}`), trophee.rang, tr.t(`metal_${trophee.metal}`))
    : neuf ? tr.t('palier_nouveau', libellePalier(neuf.piste, bilan), valeurPalier(neuf.piste, neuf.atteint)) : null;
  // Des étincelles du grade plutôt que des confettis multicolores (16/10, animation E).
  // Un trophée neuf ouvre sa fiche, avec la fête (19/10) ; un palier seul garde le message et les étincelles.
  if (trophee) setTimeout(() => feterTrophees(tropheesNeufs), 600);
  else if (message) setTimeout(() => { signale(message); etincelles(app.querySelector('.ligne-grade .medaille-grade'), Trophees.grade(gagnes.size)); }, 600);
  store.setPaliersVus(Paliers.marques(etats, bilan));
  store.setTropheesVus(new Set(gagnes));
  // L'accueil montre le grade et le prochain trophée (16/10, points 3 et 4) : les paliers ont
  // rejoint la ligne des trophées, et deux objectifs côte à côte se disputaient l'attention.
  const p = pratique();
  const g = Trophees.grade(gagnes.size);
  const prochain = Trophees.prochain(p);
  const texte = prochain
    ? tr.t('accueil_prochain_trophee', descTrophee(prochain), prochain.seuil - Math.min(Trophees.valeur(p, prochain.f.cle), prochain.seuil))
    : tr.t('trophees_tous');
  return h('button', { class: 'ligne-paliers ligne-grade', onclick: () => ouvrir('paliers'), 'aria-label': `${tr.t('grade_titre', nomMetal(g))}. ${texte}` },
    medailleGrade(g, 26), h('span', {}, `${texte}  ›`));
}

const pratique = () => ({ minutes: store.minutesParJour(), notes: store.nombreNotes(), meilleureSerie: store.meilleureSerie() });

/** Des confettis par-dessus l'écran, 2,8 s ; rien si l'on a demandé moins d'animations. */
function confettis() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const c = h('canvas', { class: 'confettis', 'aria-hidden': 'true' });
  document.body.append(c);
  const ctx = c.getContext('2d');
  if (!ctx) { c.remove(); return; }
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const couleurs = ['#C99A2E', '#1F6F5C', '#E05A47', '#3B6EC4', '#F2C94C', '#8E4FB5'];
  const pieces = Array.from({ length: 140 }, () => ({ x: Math.random(), vx: (Math.random() - 0.5) * 0.25, vy: 0.55 + Math.random() * 0.6,
    tour: (Math.random() - 0.5) * 8 * Math.PI, s: (6 + Math.random() * 8) * dpr, c: couleurs[Math.floor(Math.random() * couleurs.length)],
    rond: Math.random() < 0.25, retard: Math.random() * 0.35 }));
  const debut = performance.now();
  const image = (t) => {
    const u0 = Math.min(1, (t - debut) / 2800);
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of pieces) {
      const u = Math.max(0, Math.min(1, (u0 - p.retard) / (1 - p.retard)));
      if (u <= 0) continue;
      const x = (p.x + p.vx * u) * c.width; const y = (-0.05 + p.vy * u + 0.6 * u * u) * c.height;
      ctx.save(); ctx.globalAlpha = Math.min(1, (1 - u) * 2); ctx.fillStyle = p.c; ctx.translate(x, y); ctx.rotate(p.tour * u);
      if (p.rond) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 2 * Math.PI); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (u0 < 1) requestAnimationFrame(image); else c.remove();
  };
  requestAnimationFrame(image);
}

/** La vitrine : les trophées gagnés en couleur, les autres en attente, avec ce qu'il faut pour les gagner. */
// Les couleurs des métaux : clair, foncé, sombre (la tranche, le socle). Gris pour ce qui reste à gagner.
const TEINTES = {
  bronze: ['#F3C49A', '#A0602E', '#6E3E1C'], argent: ['#F4F6F8', '#9AA3AC', '#5E6770'],
  or: ['#FFE48A', '#C9961A', '#8A6206'], platine: ['#F7FAFF', '#8CA2C4', '#55688A'], aucun: ['#E3E5E7', '#B6BABE', '#8E9398'],
};
let numeroSvg = 0;
/** Un objet de trophée (tools/trophees_formes.py), au métal donné, avec l'icône de la famille en emblème. */
function objetTrophee(forme, metal, icone, taille) {
  const [clair, fonce, sombre] = TEINTES[metal ?? 'aucun'];
  const id = `t${++numeroSvg}`;
  const f = FORMES[forme];
  const remplis = { m: `url(#${id}m)`, mr: `url(#${id}r)`, md: sombre, v: 'rgba(170,215,255,.75)', vc: 'rgba(235,247,255,.9)', r: metal ? '#D43B3B' : '#B9BDC1', w: 'rgba(255,255,255,.5)' };
  const NS = 'http://www.w3.org/2000/svg';
  const el = (nom, attrs, ...enfants) => { const e = document.createElementNS(NS, nom); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.append(...enfants); return e; };
  const [ex, ey, et] = f.embleme;
  return el('svg', { viewBox: '0 0 100 100', width: taille, height: taille, class: 'objet-svg', 'aria-hidden': 'true' },
    el('defs', {},
      el('linearGradient', { id: `${id}m`, x1: '0', y1: '0', x2: '1', y2: '1' }, el('stop', { offset: '0', 'stop-color': clair }), el('stop', { offset: '1', 'stop-color': fonce })),
      el('radialGradient', { id: `${id}r`, cx: '.35', cy: '.3', r: '.75' }, el('stop', { offset: '0', 'stop-color': '#FFFFFF' }), el('stop', { offset: '.35', 'stop-color': clair }), el('stop', { offset: '1', 'stop-color': fonce }))),
    ...f.parts.map(([matiere, d]) => el('path', { d, fill: remplis[matiere] })),
    ICONES[icone]
      // L'icône de la famille au trait (16/10), du ton sombre du métal, centrée sur l'emblème.
      // Trait d'épaisseur constante à l'écran (au moins 1,3 px) et emblème d'au moins 20 % : lisible en liste (audit du 16/10).
      ? ((cote) => el('path', { d: ICONES[icone], transform: `translate(${ex - cote / 2} ${ey - cote / 2}) scale(${cote / 24})`,
        fill: 'none', stroke: sombre, 'stroke-width': Math.max(1.3, taille / 45), 'vector-effect': 'non-scaling-stroke',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: metal ? '1' : '.7' }))(Math.max(et * 1.15, 20))
      : el('text', { x: ex, y: ey, 'font-size': et, 'text-anchor': 'middle', 'dominant-baseline': 'central', opacity: metal ? '1' : '.45' }, icone));
}

// --- Les trophées : outils partagés par l'écran, l'accueil et le bilan (16/10) ---------------
const dessinTrophee = (e, m, taille) => objetTrophee(e.f.forme, m, e.f.icone, taille);
const descTrophee = (e) => tr.p(`trophee_${e.f.cle}_desc`, e.seuil);
const nomMetal = (m) => tr.t(`metal_${m}`);
const medailleGrade = (m, taille) => h('span', { class: 'medaille-grade', 'aria-hidden': 'true' }, objetTrophee('medaille', m, '★', taille));
const moinsAnime = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** Le jour de gain de chaque trophée gagné (Trophees.datesGain) : l'historique rejoué. */
function datesTrophees() {
  return Trophees.datesGain(store.minutesParJour(), store.joursAvecNote(), (d) => store.isExempt(d));
}
const dateLongue = (iso) => new Intl.DateTimeFormat(tr.langue, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

/** Un texte en plusieurs paragraphes (VueJour.paragraphes, 19/10) : un bloc par paragraphe, un écart entre eux. */
const paragraphes = (t) => String(t ?? '').split(/\n+/).map((x) => x.trim()).filter(Boolean).map((x) => h('span', { class: 'para' }, x));

/** Le détail d'un trophée (16/10, point 1) : l'objet, ce qu'il demande, le jour gagné ou la progression. */
function detailTrophee(e, p, dates, rangGlobal, apres = null) {
  const gagne = Trophees.gagne(p, e);
  const m = gagne ? Trophees.grade(rangGlobal) : null;
  const v = Math.min(Trophees.valeur(p, e.f.cle), e.seuil);
  feuille(descTrophee(e), (f, fermer) => {
    f.classList.add('feuille-trophee');
    f.prepend(h('div', { class: `detail-objet${gagne ? ' neuf-retourne' : ''}` }, dessinTrophee(e, m, 120)));
    f.append(
      h('p', { class: 'detail-famille' }, `${tr.t(`trophee_${e.f.cle}`)} · ${tr.t('trophee_niveau_court', e.rang, e.f.seuils.length)}`),
      gagne
        ? h('p', { class: 'detail-date' }, dates[e.cle] ? tr.t('trophee_gagne_le', dateLongue(dates[e.cle])) : tr.t('trophee_gagne'))
        : h('div', {}, h('div', { class: 'trophee-barre grande', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.round(Trophees.fraction(p, e) * 100)}%` })),
          h('p', { class: 'trophee-compte' }, tr.t('trophee_encore', v, e.seuil, e.seuil - v))),
      gagne ? h('p', { class: 'indice' }, tr.t('trophee_detail_grade', nomMetal(m), rangGlobal)) : '',
      h('div', { class: 'actions' }, h('button', { type: 'button', onclick: fermer }, tr.t('celebration_continue'))));
  }, apres);
}

/**
 * Un trophée gagné (19/10) : sa fiche s'ouvre d'elle-même, l'objet se retourne, des
 * confettis tombent et des étincelles du métal jaillissent ; plusieurs, l'une après l'autre.
 */
function feterTrophees(nouveaux) {
  const p = pratique();
  const dates = datesTrophees();
  const faits = Trophees.chemin.filter((x) => Trophees.gagne(p, x));
  const suivant = (i) => {
    const n = nouveaux[i];
    if (!n) return;
    const e = Trophees.chemin.find((x) => x.cle === `${n.famille.cle}:${n.rang}`);
    if (!e) { suivant(i + 1); return; }
    const rang = faits.indexOf(e) + 1 || faits.length;
    detailTrophee(e, p, dates, rang, () => suivant(i + 1));
    confettis();
    setTimeout(() => etincelles(document.querySelector('.feuille-trophee .detail-objet'), Trophees.grade(rang)), 700);
  };
  suivant(0);
}

/** Une image du grade à partager (16/10, point 9) : dessinée ici, rien n'est envoyé. */
async function partagerGrade(g, n) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1080;
  const x = c.getContext('2d');
  const style = getComputedStyle(document.documentElement);
  const fond = style.getPropertyValue('--brand-dark').trim() || '#173C32';
  const encre = style.getPropertyValue('--mint').trim() || '#DFF5E8';
  x.fillStyle = fond; x.fillRect(0, 0, 1080, 1080);
  const svg = objetTrophee('medaille', g, '★', 520);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  await img.decode().catch(() => {});
  x.drawImage(img, 280, 150, 520, 520);
  x.fillStyle = encre; x.textAlign = 'center';
  x.font = '700 76px system-ui, sans-serif';
  x.fillText(tr.t('grade_titre', nomMetal(g)), 540, 790);
  x.font = '400 46px system-ui, sans-serif';
  x.fillText(tr.t('grade_sous_max', n), 540, 860);
  x.globalAlpha = 0.7; x.font = '600 38px system-ui, sans-serif';
  x.fillText('MyHitbodedut', 540, 990);
  const texte = `${tr.t('grade_partage_texte', nomMetal(g), n)}\n${tr.t('partage_lien', LIEN_WEB)}`;
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const fichier = blob ? new File([blob], 'grade.png', { type: 'image/png' }) : null;
  try {
    if (fichier && navigator.canShare?.({ files: [fichier] })) { await navigator.share({ files: [fichier], text: texte }); return; }
    if (navigator.share) { await navigator.share({ text: texte }); return; }
  } catch (err) { if (err?.name === 'AbortError') return; }
  if (blob) {
    const a = h('a', { href: URL.createObjectURL(blob), download: 'grade.png' });
    document.body.append(a); a.click(); a.remove();
  }
}

/** Des étincelles de la couleur du grade autour d'un élément (16/10, animation E). */
function etincelles(el, m) {
  if (!el || moinsAnime()) return;
  const [clair, fonce] = TEINTES[m ?? 'or'];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * 2 * Math.PI + Math.random() * 0.4;
    const d = 38 + Math.random() * 26;
    const e = h('span', { class: 'etincelle', 'aria-hidden': 'true' });
    e.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    e.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    e.style.background = k % 2 ? clair : fonce;
    e.style.animationDelay = `${Math.random() * 180}ms`;
    el.append(e);
    setTimeout(() => e.remove(), 1400);
  }
}

/** Un nombre qui monte de 0 à sa valeur (16/10, animation D). */
function monteNombre(el, fin, texte) {
  if (moinsAnime()) { el.textContent = texte(fin); return; }
  const debut = performance.now();
  const pas = (t) => { const u = Math.min(1, (t - debut) / 700); el.textContent = texte(Math.round(fin * (1 - (1 - u) ** 3))); if (u < 1) requestAnimationFrame(pas); };
  el.textContent = texte(0);
  requestAnimationFrame(pas);
}

let filtreTrophees = null;

/**
 * Les trophées en ligne (15/10, PaliersActivity ; lot du 16/10) : le grade en tête, les trois
 * plus proches et le partage ; un filtre par famille ; une ligne verticale, les gagnés au-dessus
 * (matériau du grade d'alors, une bannière à chaque passage), « Tu es ici » et le prochain objectif
 * au milieu, les suivants en gris dessous. Chaque trophée s'ouvre en détail. À l'ouverture, la
 * ligne se remplit jusqu'à « Tu es ici », les nouveaux se retournent et scintillent ; un nouveau
 * grade se fête une fois, la médaille passant de l'ancien matériau au nouveau.
 */
function ecranPaliers() {
  const bilan = bilanPaliers();
  store.setPaliersVus(Paliers.marques(Paliers.etats(bilan), bilan));
  const p = pratique();
  const dates = datesTrophees();
  const r = Paliers.records(bilan.minutes, (d) => { const j = jourJuif(d, false); return `${j.anneeHebraique}-${j.moisHebreu}`; });
  const faits = Trophees.chemin.filter((e) => Trophees.gagne(p, e));
  const rangDe = new Map(faits.map((e, i) => [e.cle, i + 1]));
  const n = faits.length;
  const g = Trophees.grade(n);
  const suivant = Trophees.SEUILS_GRADES.find((x) => x > n);
  const vus = store.tropheesVus();
  const neufs = vus ? new Set(faits.filter((e) => !vus.has(e.cle)).map((e) => e.cle)) : new Set();
  const famille = filtreTrophees;
  const dans = (e) => !famille || e.f.cle === famille;
  const prochain = famille ? Trophees.chemin.find((e) => e.f.cle === famille && !Trophees.gagne(p, e)) ?? null : Trophees.prochain(p);
  const futurs = Trophees.chemin.filter((e) => dans(e) && !Trophees.gagne(p, e) && e !== prochain);
  const passage = (k) => !famille && k > 0 && Trophees.SEUILS_GRADES.includes(k);
  const de = Trophees.SEUILS_GRADES.filter((x) => x <= n).pop();
  const ouvrirDetail = (e) => detailTrophee(e, p, dates, rangDe.get(e.cle) ?? n + 1);

  // En tête : le grade, la barre vers le suivant, les trois plus proches, le partage.
  const proches = Trophees.plusProches(p, 3);
  const tete = h('div', { class: 'carte grade-tete' },
    h('div', { class: 'grade-ligne' }, medailleGrade(g, 48), h('div', { class: 'trophee-texte' },
      h('p', { class: 'grade-nom' }, tr.t('grade_titre', nomMetal(g))),
      h('p', { class: 'grade-sous' }, suivant ? tr.t('grade_sous', n, suivant - n, nomMetal(Trophees.grade(suivant))) : tr.t('grade_sous_max', n)),
      suivant ? h('div', { class: `grade-barre ${g}`, 'aria-hidden': 'true' }, h('span', { 'data-largeur': `${Math.round(((n - de) / (suivant - de)) * 100)}%` })) : null)),
    proches.length ? h('div', { class: 'grade-proches' }, h('p', { class: 'grade-proches-titre' }, tr.t('trophees_proches_titre')),
      ...proches.map((e) => h('button', { type: 'button', class: 'proche', onclick: () => ouvrirDetail(e) },
        h('span', { class: 'proche-objet' }, dessinTrophee(e, null, 30)),
        h('span', { class: 'proche-texte' }, descTrophee(e)),
        h('span', { class: 'proche-compte' }, tr.t('trophee_progres', Math.min(Trophees.valeur(p, e.f.cle), e.seuil), e.seuil))))) : null,
    n > 0 ? h('button', { type: 'button', class: 'lien-bouton grade-partager', onclick: () => partagerGrade(g, n) }, tr.t('grade_partager')) : null);

  // Le filtre par famille (16/10, point 6).
  const puces = h('div', { class: 'filtre-trophees', role: 'radiogroup', 'aria-label': tr.t('trophees_filtre', famille ? tr.t(`trophee_${famille}`) : tr.t('trophees_filtre_tous')) },
    [null, ...Trophees.FAMILLES.map((f) => f.cle)].map((cle) => h('button', {
      type: 'button', class: 'puce-choix', role: 'radio', 'aria-checked': String(cle === famille),
      onclick: () => { filtreTrophees = cle; rendre(); },
    }, cle ? tr.t(`trophee_${cle}`) : tr.t('trophees_filtre_tous'))));

  const banniere = (m, k, atteint) => h('div', { class: `grade-banniere ${atteint ? m : 'avenir'}` }, medailleGrade(atteint ? m : null, 34),
    h('div', {}, h('strong', {}, tr.t(atteint ? 'grade_atteint' : 'grade_titre', nomMetal(m))), h('small', {}, tr.t('grade_au', k))));
  const etape = (e, m, sous, gagne) => h('button', { type: 'button', class: `ligne-etape${gagne ? ' gagne' : ''}${neufs.has(e.cle) ? ' neuf' : ''}`, onclick: () => ouvrirDetail(e) },
    h('span', { class: `ligne-noeud ${m ?? 'avenir'}` }, h('span', { class: 'ligne-trait' }), h('span', { class: 'ligne-objet', 'data-metal': m ?? '' }, dessinTrophee(e, m, gagne ? 52 : 44))),
    h('span', { class: 'trophee-texte' }, h('span', { class: 'trophee-but' }, descTrophee(e)), sous ? h('span', { class: 'trophee-compte petit' }, sous) : null));
  const ligne = [];
  const faitsVus = faits.filter(dans);
  faitsVus.forEach((e) => {
    const k = rangDe.get(e.cle);
    if (passage(k)) ligne.push(banniere(Trophees.grade(k), k, true));
    ligne.push(etape(e, Trophees.grade(k), dates[e.cle] ? tr.t('trophee_gagne_le', dateLongue(dates[e.cle])) : tr.t('trophee_gagne'), true));
  });
  let ici = null;
  if (prochain) {
    if (passage(n + 1)) ligne.push(banniere(Trophees.grade(n + 1), n + 1, false));
    const v = Math.min(Trophees.valeur(p, prochain.f.cle), prochain.seuil);
    const fr = Trophees.fraction(p, prochain);
    ici = h('button', { type: 'button', class: `carte ligne-ici${fr >= 0.9 ? ' presque' : ''}`, onclick: () => ouvrirDetail(prochain) },
      h('span', { class: 'ici-tag' }, tr.t('trophees_ici')),
      h('span', { class: 'trophee-ligne' }, h('span', { class: 'trophee-objet' }, dessinTrophee(prochain, null, 64)),
        h('span', { class: 'trophee-texte' }, h('span', { class: 'trophee-but grand' }, descTrophee(prochain)),
          h('span', { class: 'trophee-barre grande', 'aria-hidden': 'true' }, h('span', { 'data-largeur': `${Math.round(fr * 100)}%` })),
          h('span', { class: 'trophee-compte', 'data-valeur': String(v) }, tr.t('trophee_encore', v, prochain.seuil, prochain.seuil - v)))));
    ligne.push(ici);
  } else ligne.push(h('p', { class: 'trophee-but grand' }, tr.t('trophees_tous')));
  futurs.slice(0, 15).forEach((e, k) => {
    const c = n + 2 + k;
    if (passage(c)) ligne.push(banniere(Trophees.grade(c), c, false));
    const v = Trophees.valeur(p, e.f.cle);
    ligne.push(etape(e, null, v > 0 ? tr.t('trophee_progres', Math.min(v, e.seuil), e.seuil) : null, false));
  });
  if (futurs.length > 15) ligne.push(h('p', { class: 'indice ligne-fin' }, tr.t('trophees_autres', futurs.length - 15)));

  // Un nouveau grade : la fête, une fois (pas la première ouverture, pas le bronze).
  const niveau = n === 0 ? 0 : Trophees.METAUX.indexOf(g) + 1;
  const vu = store.gradeVu();
  const fete = vu !== null && niveau > vu && g !== 'bronze';
  store.setGradeVu(niveau);
  store.setTropheesVus(Trophees.gagnes(p));
  const ecran = h('div', { class: 'ecran avec-bandeau ecran-trophees' }, bandeau(tr.t('trophees_paliers_titre'), { dessin: 'char_arms_raised' }),
    h('div', { class: 'defile', tabindex: '0' }, h('div', { class: 'contenu' },
      tete, puces,
      h('div', { class: 'ligne-trophees' }, ...ligne),
      h('div', { class: 'carte carte-palier' }, h('p', { class: 'palier-nom' }, tr.t('paliers_records')),
        ...[tr.t('record_serie', valeurPalier('serie', store.meilleureSerie())), tr.t('record_jour', tr.duree(r.jour)),
          tr.t('record_semaine', tr.duree(r.semaine)), tr.t('record_mois', tr.duree(r.mois))].map((x) => h('p', { class: 'palier-record' }, x))))));

  requestAnimationFrame(() => {
    const d = ecran.querySelector('.defile');
    if (d && ici) d.scrollTop = Math.max(0, ici.offsetTop - d.clientHeight / 3);
    // B : la ligne se remplit jusqu'à « Tu es ici », les dernières étapes une à une.
    const gagnes = [...ecran.querySelectorAll('.ligne-etape.gagne')];
    if (!moinsAnime()) gagnes.forEach((el, i) => { el.style.setProperty('--retard', `${Math.max(0, i - (gagnes.length - 6)) * 90}ms`); el.classList.add('pousse'); });
    // D : les barres partent de zéro, le compte monte, le presque-atteint pulse.
    requestAnimationFrame(() => ecran.querySelectorAll('[data-largeur]').forEach((b) => { b.style.width = b.dataset.largeur; }));
    const cpt = ecran.querySelector('.ligne-ici .trophee-compte');
    if (cpt && prochain) monteNombre(cpt, Number(cpt.dataset.valeur), (x) => tr.t('trophee_encore', x, prochain.seuil, prochain.seuil - x));
    // A + E : les nouveaux se retournent et scintillent.
    ecran.querySelectorAll('.ligne-etape.neuf .ligne-objet').forEach((o, i) => setTimeout(() => etincelles(o, o.dataset.metal || g), 500 + i * 120));
  });
  if (fete) ecran.append(feteGrade(Trophees.grade(Math.max(0, Trophees.SEUILS_GRADES[Trophees.METAUX.indexOf(g) - 1])), g, n, suivant));
  return ecran;
}

/** C : la fête d'un nouveau grade — rayons lents, la médaille passe de l'ancien matériau au nouveau. */
function feteGrade(ancien, g, n, suivant) {
  const voile = h('div', { class: 'grade-fete', role: 'dialog', 'aria-modal': 'true', 'aria-label': tr.t('grade_nouveau', nomMetal(g)) },
    h('div', { class: 'grade-fete-carte' },
      h('div', { class: 'grade-morph' }, h('span', { class: 'rayons', 'aria-hidden': 'true' }),
        h('span', { class: 'morph-ancien' }, medailleGrade(ancien, 140)), h('span', { class: 'morph-nouveau' }, medailleGrade(g, 140))),
      h('h2', {}, tr.t('grade_nouveau', nomMetal(g))), h('p', {}, tr.t('grade_sous_max', n)),
      suivant ? h('p', { class: 'indice' }, tr.t('grade_prochain', nomMetal(Trophees.grade(suivant)), suivant)) : null,
      h('button', { type: 'button', class: 'principal', onclick: () => voile.remove() }, tr.t('celebration_continue'))));
  setTimeout(() => etincelles(voile.querySelector('.grade-morph'), g), 1200);
  return voile;
}

/** Le bilan de la semaine écoulée (16/10, point 7) : à la première ouverture de la semaine, une fois. */
function bilanDeLaSemaine() {
  // Pas par-dessus la présentation du premier lancement (revue du 16/10) : il attendra la prochaine ouverture.
  if (document.querySelector('.presentation')) return;
  // Rien à calculer quand le bilan de cette semaine a déjà été montré.
  const debut = Trophees.debutSemaine(store.today());
  const semaineResumee = new Date(`${debut}T12:00:00Z`); semaineResumee.setUTCDate(semaineResumee.getUTCDate() - 7);
  const vue = semaineResumee.toISOString().slice(0, 10);
  if (store.bilanVu() === vue) return;
  store.setBilanVu(vue);
  const b = Trophees.bilanSemaine(store.today(), store.minutesParJour(), datesTrophees());
  if (!b) return;
  feuille(tr.t('bilan_titre'), (f, fermer) => {
    f.classList.add('feuille-bilan');
    f.append(...[
      h('p', { class: 'bilan-total' }, tr.t('bilan_minutes', tr.duree(b.minutes), tr.p('palier_n_jours', b.jours))),
      b.ecart > 0 && b.precedente > 0 ? h('p', { class: 'message' }, tr.t('bilan_plus', tr.duree(b.ecart))) : null,
      b.record ? h('p', { class: 'bilan-record' }, tr.t('bilan_record')) : null,
      b.trophees.length ? h('p', { class: 'message' }, tr.t('bilan_trophees')) : null,
      b.trophees.length ? h('div', { class: 'bilan-trophees' }, ...b.trophees.slice(0, 6).map((e) => h('span', { class: 'bilan-trophee', title: descTrophee(e) }, dessinTrophee(e, Trophees.grade(Trophees.chemin.filter((x) => Trophees.gagne(pratique(), x)).indexOf(e) + 1), 40)))) : null,
      h('div', { class: 'actions' }, h('button', { type: 'button', onclick: fermer }, tr.t('celebration_continue')))].filter(Boolean));
  });
}

function ecranCalendrier() {
  const aujourdhui = isoLocal(new Date());
  const choisi = jourCalendrier ?? aujourdhui;
  const civil = store.calendrierCivil();
  const israel = store.inIsrael();
  const moisCourt = new Intl.DateTimeFormat(tr.langue, { month: 'short', timeZone: 'UTC' });
  const date = (iso) => new Date(`${iso}T12:00:00Z`);
  let grille;
  let titre;
  let sousTitre;
  let decale;
  if (civil) {
    const [a, m] = moisCalendrier ?? choisi.split('-').map(Number);
    grille = semaines(a, m);
    const jours = grille.flat().filter(Boolean);
    const premier = jourJuif(jours[0], israel);
    const dernier = jourJuif(jours.at(-1), israel);
    titre = h('p', { class: 'mois-principal' }, new Intl.DateTimeFormat(tr.langue, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(a, m - 1, 15))));
    sousTitre = h('p', { class: 'mois-second mois-hebreu', lang: 'he', dir: 'rtl' },
      premier.moisEtAnnee === dernier.moisEtAnnee ? premier.moisEtAnnee : `${premier.moisEtAnnee} – ${dernier.moisEtAnnee}`);
    decale = (n) => { const d = new Date(Date.UTC(a, m - 1 + n, 1)); moisCalendrier = [d.getUTCFullYear(), d.getUTCMonth() + 1]; rendre(); };
  } else {
    const debut = moisHebreuCalendrier ?? debutMoisHebreu(choisi);
    grille = semainesHebreu(debut);
    const jours = grille.flat().filter(Boolean);
    const [d0, d1] = [date(jours[0]), date(jours.at(-1))];
    const memeAnnee = d0.getUTCFullYear() === d1.getUTCFullYear();
    const mois = (d, an) => new Intl.DateTimeFormat(tr.langue, { month: 'long', ...(an ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(d);
    titre = h('p', { class: 'mois-principal mois-hebreu', lang: 'he', dir: 'rtl' }, jourJuif(debut, israel).moisEtAnnee);
    // Seule l'initiale de la plage prend la majuscule (« Septembre – octobre 2026 »).
    const plage = `${mois(d0, !memeAnnee)} – ${mois(d1, true)}`;
    sousTitre = h('p', { class: 'mois-second' }, plage.charAt(0).toLocaleUpperCase(tr.langue) + plage.slice(1));
    decale = (n) => { moisHebreuCalendrier = moisHebreuVoisin(debut, n); rendre(); };
  }
  const bascule = (versCivil) => { store.setCalendrierCivil(versCivil); moisCalendrier = null; moisHebreuCalendrier = null; rendre(); };
  // Les initiales des jours, du dimanche (4/10/2026) au samedi.
  const initiales = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(tr.langue, { weekday: 'narrow', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, 9, 4 + i, 12))));
  return h('div', { class: 'ecran' }, barre(tr.t('calendrier_title')),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      h('div', { class: 'carte carte-calendrier' },
        h('div', { class: 'vue-calendrier', role: 'group', 'aria-label': tr.t('calendrier_vue') },
          h('button', { class: civil ? '' : 'actif', 'aria-pressed': String(!civil), onclick: () => bascule(false) }, tr.t('calendrier_vue_hebreu')),
          h('button', { class: civil ? 'actif' : '', 'aria-pressed': String(civil), onclick: () => bascule(true) }, tr.t('calendrier_vue_civil'))),
        h('div', { class: 'mois-tete' },
          h('button', { class: 'icone-bouton mois-precedent', 'aria-label': tr.t('calendrier_precedent'), dir: 'ltr', onclick: () => decale(-1) }, tr.rtl ? '›' : '‹'),
          h('div', { class: 'mois-titres' }, titre, sousTitre),
          h('button', { class: 'icone-bouton mois-suivant', 'aria-label': tr.t('calendrier_suivant'), dir: 'ltr', onclick: () => decale(1) }, tr.rtl ? '‹' : '›')),
        h('div', { class: 'grille-jours' },
          initiales.map((x) => h('span', { class: 'jour-initiale', 'aria-hidden': 'true' }, x)),
          grille.flat().map((d) => {
            if (!d) return h('span', { class: 'case vide' });
            const j = jourJuif(d, israel, mukafChoma());
            const quantieme = Number(d.slice(8));
            // Le 1er d'un mois civil porte le nom du mois, pour qu'on lise où il bascule.
            const civilTexte = !civil && quantieme === 1 ? `1 ${moisCourt.format(date(d))}` : String(quantieme);
            const hebreu = h('span', { class: civil ? 'case-bas case-hebreu' : 'case-haut case-hebreu', lang: 'he', dir: 'rtl' }, j.jourEnLettres);
            const civ = h('span', { class: civil ? 'case-haut case-civil' : 'case-bas case-civil' }, civilTexte);
            return h('button', {
              class: ['case', d === aujourdhui ? 'aujourdhui' : '', d === choisi ? 'choisi' : '', j.chome ? 'chome' : '', j.fetes.length ? 'fete' : ''].filter(Boolean).join(' '),
              'aria-pressed': String(d === choisi),
              'aria-label': `${d} · ${j.dateHebraique}${j.fetes.length ? ` · ${j.fetes.map((f) => tr.t(`fete_${f}`)).join(', ')}` : ''}`,
              onclick: () => { jourCalendrier = d; rendre(); },
            }, ...(civil ? [civ, hebreu] : [hebreu, civ]));
          })),
        h('button', { class: 'lien-aujourdhui', onclick: () => { jourCalendrier = aujourdhui; moisCalendrier = null; moisHebreuCalendrier = null; rendre(); } }, tr.t('calendrier_aujourdhui'))),
      carteJour(choisi),
      // Un jour passé : y ajouter du temps fait hors du téléphone (16/10).
      choisi <= aujourdhui ? h('button', { type: 'button', class: 'secondaire ajout-temps', onclick: () => ajoutTemps(choisi) }, tr.t('jour_ajouter_temps')) : null,
      listeZmanim(choisi),
      ...piedZmanim())));
}

// Les choix d'Apparence.kt et de Store.Ouverture (14/10).
const MODES = ['auto', 'clair', 'sombre'];
const FONDS = ['vert', 'blanc', 'sable', 'bleu', 'rose', 'contraste'];
const ACCENTS = ['vert', 'bleu', 'violet', 'bordeaux', 'ambre', 'turquoise'];
const OUVERTURES = [['aujourdhui', 'nav_today'], ['textes', 'nav_texts'], ['zmanim', 'nav_zmanim']];

function ecranReglages() {
  const courante = LANGUES.find((l) => l.code === tr.langue);
  return h('div', { class: 'ecran' }, barre(tr.t('settings_title')),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      h('div', { class: 'carte' },
        ligne({
          nom: tr.t('settings_language'), etat: courante.nom,
          onclick: () => choisirDans(tr.t('settings_language'), LANGUES.map((l) => l.nom),
            LANGUES.indexOf(courante), async (i) => {
              store.setLangueApp(LANGUES[i].code);
              tr = await chargeTraduction(LANGUES[i].code);
              appliqueApparence();
              rendre();
            }),
        }),
        ligne({ nom: tr.t('reglage_lieu'), etat: store.lieu()?.nom ?? tr.t('reglage_lieu_aucun'), onclick: choisirLieu }),
        // À Jérusalem, l'usage des 40 minutes est proposé, jamais imposé.
        ligne({ nom: tr.t('reglage_allumage'), onclick: choisirAllumage,
          etat: [libelleAllumage(store.allumage()), mukafChoma() && store.allumage() !== 40 ? tr.t('reglage_allumage_proposition') : null].filter(Boolean).join(' · ') }),
        store.siddurNusah() === 'sefard' ? ligne({ nom: tr.t('reglage_tahanoun_tichri'), onclick: choisirTahanounTichri,
          etat: tr.t(store.sansTahanounFinTichri() ? 'reglage_tahanoun_tichri_sans' : 'reglage_tahanoun_tichri_dit') }) : null),
      // Personnalisation (14/10) : les couleurs d'Android (palettes.css), la police, l'écran d'ouverture.
      h('div', { class: 'carte' },
        h('h3', {}, tr.t('section_appearance')),
        h('p', { class: 'indice' }, tr.t('section_appearance_hint')),
        ...[['settings_mode', MODES, store.modeApparence, store.setModeApparence, 'mode'],
          ['settings_fond', FONDS, store.fond, store.setFond, 'fond'],
          ['settings_accent', ACCENTS, store.accent, store.setAccent, 'accent']].map(([nom, liste, lit, ecrit, prefixe]) => {
          const i = Math.max(0, liste.indexOf(lit()));
          return ligne({ nom: tr.t(nom), etat: tr.t(`${prefixe}_${liste[i]}`),
            onclick: () => choisirDans(tr.t(nom), liste.map((x) => tr.t(`${prefixe}_${x}`)), i, (j) => { ecrit(liste[j]); appliqueApparence(); rendre(); }) });
        }),
        ligne({ nom: tr.t('settings_police'), etat: tr.t(`police_${store.lecturePolice()}`), onclick: choisirPolice }),
        // Grand texte (14/10) : les textes de lecture à 140 % ; « Aa » règle toujours finement.
        h('label', { class: 'ligne' }, h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('settings_grand_texte'))),
          h('input', { type: 'checkbox', role: 'switch', class: 'interrupteur', checked: store.lectureEchelle() >= 1.4, 'aria-label': tr.t('settings_grand_texte'),
            onchange: (e) => { store.setLectureEchelle(e.target.checked ? 1.4 : 1); rendre(); } })),
        ligne({ nom: tr.t('settings_ouverture'), etat: tr.t(OUVERTURES.find(([c]) => c === store.ouverture())[1]),
          onclick: () => choisirDans(tr.t('settings_ouverture'), OUVERTURES.map(([, n]) => tr.t(n)), OUVERTURES.findIndex(([c]) => c === store.ouverture()),
            (j) => { store.setOuverture(OUVERTURES[j][0]); rendre(); }) })),
      h('div', { class: 'carte' },
        h('h3', {}, tr.t('section_zmanim_ecran')),
        h('p', { class: 'indice' }, tr.t('section_zmanim_ecran_hint')),
        ...[['reglage_levana', store.levanaAffichee, store.setLevanaAffichee],
          ['hilloulot_afficher', store.hilloulotAffichees, store.setHilloulotAffichees],
          ['halakha_afficher', store.halakhaAffichee, store.setHalakhaAffichee]].map(([nom, lit, ecrit]) =>
          h('label', { class: 'ligne' }, h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t(nom))),
            h('input', { type: 'checkbox', role: 'switch', class: 'interrupteur', checked: lit(), 'aria-label': tr.t(nom),
              onchange: (e) => { ecrit(e.target.checked); rendre(); } }))),
        // Birkat haLevana (14/10) : selon le noussa'h, ou l'un des trois usages.
        ligne({ nom: tr.t('levana_usage_titre'),
          etat: store.levanaUsage() === 'auto' ? `${tr.t('levana_usage_auto')} · ${tr.t(`levana_usage_${usageLevanaCourant()}`)}` : tr.t(`levana_usage_${store.levanaUsage()}`),
          onclick: () => { const choix = ['auto', ...Object.keys(USAGES_LEVANA)];
            choisirDans(tr.t('levana_usage_titre'), choix.map((c) => tr.t(c === 'auto' ? 'levana_usage_auto' : `levana_usage_${c}`)), choix.indexOf(store.levanaUsage()),
              (j) => { store.setLevanaUsage(choix[j]); rendre(); }); } }),
        ligne({ nom: tr.t('halakha_source_titre'), etat: tr.t(SOURCES_HALAKHA.find(([c]) => c === store.sourceHalakha())[1]),
          onclick: () => choisirDans(tr.t('halakha_source_titre'), SOURCES_HALAKHA.map(([, n]) => tr.t(n)), SOURCES_HALAKHA.findIndex(([c]) => c === store.sourceHalakha()),
            (j) => { store.setSourceHalakha(SOURCES_HALAKHA[j][0]); rendre(); }) })),
      h('div', { class: 'carte' }, ligne({ nom: tr.t('settings_onboarding'), onclick: presentation })),
      // Réinitialiser l'application (12/10) : en dernier, avec une confirmation.
      h('div', { class: 'carte carte-reinit' },
        h('h3', {}, tr.t('reset_title')),
        h('p', { class: 'indice' }, tr.t('reset_hint')),
        h('button', { class: 'bouton-danger', onclick: () => confirmer(tr.t('reset_confirm_title'), tr.t('reset_confirm_text'), tr.t('reset_confirm_yes'), () => {
          store.reinitialiser();
          location.replace(location.pathname);
        }) }, tr.t('reset_action'))))));
}

// --- La présentation du premier lancement (Onboarding.kt, 16/10) --------------------------
// Les mêmes écrans qu'Android, un à la fois, avec une sortie à tout moment ; sur l'écran de
// la pratique, la durée habituelle se choisit d'un toucher. Le site n'a pas de rappels :
// l'écran « jour après jour » n'en parle pas, et l'écran de la promesse parle du navigateur.
const PRESENTATION_VERSION = 2;
const PRESENTATION = [
  { cle: 'pratique', titre: 'onboarding_practice', corps: 'onboarding_practice_body', image: 'char_open_arms' },
  { cle: 'seance', titre: 'onboarding_session', corps: 'onboarding_session_body', image: 'char_praying', duree: true },
  { cle: 'jours', titre: 'onboarding_days', corps: 'onboarding_days_body_web', image: 'char_writing' },
  { cle: 'textes', titre: 'onboarding_texts', corps: 'onboarding_texts_body', image: 'char_tehilim' },
  { cle: 'reglages', titre: 'onboarding_yours', corps: 'onboarding_yours_body', image: 'char_pointing' },
  { cle: 'adresse', titre: 'onboarding_adresse', corps: 'onboarding_adresse_body', image: 'char_dancing', adresse: true },
  { cle: 'prive', titre: 'onboarding_private', corps: 'onboarding_private_body_web', image: 'char_thumbs_up' },
];
const DUREES_PRESENTATION = [5, 10, 15, 30];

function presentation() {
  let i = 0;
  const voile = h('div', { class: 'presentation', role: 'dialog', 'aria-modal': 'true' });
  const fermer = () => {
    store.setOnboardedVersion(PRESENTATION_VERSION);
    voile.remove();
    rendre();
  };
  const dessiner = () => {
    const e = PRESENTATION[i];
    const dernier = i === PRESENTATION.length - 1;
    const puces = (valeurs, courante, libelle, choisir) => h('div', { class: 'presentation-choix', role: 'radiogroup' },
      valeurs.map((v) => h('button', { class: 'puce-choix', role: 'radio', 'aria-checked': String(v === courante),
        onclick: () => { choisir(v); dessiner(); } }, libelle(v))));
    voile.setAttribute('aria-label', tr.t(e.titre));
    voile.replaceChildren(h('div', { class: 'presentation-page' },
      h('span', { class: 'presentation-etape', dir: 'ltr' }, tr.t('onboarding_step', i + 1, PRESENTATION.length)),
      h('div', { class: 'presentation-scene' }, h('img', { src: `img/${e.image}.webp`, alt: '' })),
      h('h1', { class: 'presentation-titre' }, tr.t(e.titre)),
      h('p', { class: 'presentation-corps' }, tr.t(e.corps)),
      e.duree ? puces(DUREES_PRESENTATION, store.targetMinutes(), (m) => tr.duree(m), (m) => store.setTargetMinutes(m)) : null,
      e.adresse ? puces(['m', 'f'], store.adresse(), (a) => tr.t(a === 'm' ? 'adresse_tsadik' : 'adresse_tsadeket'), (a) => store.setAdresse(a)) : null,
      h('button', { class: 'principal', onclick: () => { if (dernier) fermer(); else { i++; dessiner(); } } },
        tr.t(dernier ? 'onboarding_start' : 'onboarding_next')),
      h('div', { class: 'presentation-bas' },
        h('button', { class: 'texte-lien', style: i === 0 ? 'visibility:hidden' : '', onclick: () => { i--; dessiner(); } }, tr.t('onboarding_back')),
        h('button', { class: 'texte-lien', style: dernier ? 'visibility:hidden' : '', onclick: fermer }, tr.t('onboarding_skip')))));
    voile.querySelector('.principal').focus();
  };
  dessiner();
  document.body.append(voile);
}

// --- Boîtes de dialogue ---------------------------------------------------------------
/**
 * Ajouter du temps à un jour passé (16/10, AjoutTemps.kt) : une hitbodedout faite hors du
 * téléphone s'inscrit après coup, sur n'importe quel jour jusqu'à aujourd'hui, même un jour déjà
 * fait (les minutes s'ajoutent). montrer : l'action « montrer la durée sur la bande ».
 */
function ajoutTemps(iso, montrer = null) {
  if (iso > store.today()) return;
  const r = store.record(iso);
  const minutes = r?.faite ? r.minutes : null;
  const titre = new Intl.DateTimeFormat(tr.langue, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
  feuille(titre, (f, fermer) => {
    f.append(h('p', { class: 'message' }, minutes === null ? tr.t('jour_rien') : tr.t('jour_fait', tr.duree(minutes))),
      h('div', { class: 'actions' },
        montrer && minutes !== null ? h('button', { type: 'button', onclick: () => { fermer(); montrer(); } }, tr.t('jour_montrer_duree')) : '',
        h('button', { type: 'button', onclick: fermer }, tr.t('action_back')),
        h('button', { type: 'button', class: 'fort', onclick: () => {
          fermer();
          choisirDuree((m) => {
            store.addSession(m, { date: iso });
            signale(tr.t('jour_ajoute', tr.duree(m)));
            rendre();
          }, tr.t('offline_how_long'));
        } }, tr.t('jour_ajouter_temps'))));
  });
}

/** La ville de la liste la plus proche, à moins de 60 km (Villes.plusProche). */
function villePlusProche(liste, lat, lon, maxKm = 60) {
  const rad = (x) => (x * Math.PI) / 180;
  const km = (v) => {
    const a = Math.sin(rad(v.latitude - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(v.latitude)) * Math.sin(rad(v.longitude - lon) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, a)));
  };
  let m = null; let dm = Infinity;
  for (const v of liste) { const d = km(v); if (d < dm) { dm = d; m = v; } }
  return dm <= maxKm ? m : null;
}

/** Une confirmation : titre, message, « Retour » et l'action (les AlertDialog de SessionActivity). */
function confirmer(titre, message, action, onConfirme) {
  feuille(titre, (f, fermer) => {
    f.append(h('p', { class: 'message' }, message),
      h('div', { class: 'actions' },
        h('button', { onclick: fermer }, tr.t('action_back')),
        h('button', { onclick: () => { fermer(); onConfirme(); } }, action)));
  });
}

/** NoteDialog : une note libre sur la journée, illustration de joie au-dessus. */
function ecrireNote(date, apres = () => {}) {
  feuille(tr.t('note_title'), (f, fermer) => {
    const champ = h('textarea', { rows: 4, placeholder: tr.t('note_hint'), 'aria-label': tr.t('note_title') });
    champ.value = store.record(date)?.note ?? '';
    f.append(h('img', { class: 'note-art', src: `img/${joie()}.webp`, alt: '' }), champ,
      h('div', { class: 'actions' },
        h('button', { onclick: () => { fermer(); apres(); } }, tr.t('action_later')),
        h('button', { onclick: () => { store.setNote(date, champ.value.trim()); fermer(); apres(); } }, tr.t('action_save'))));
  });
}

// --- La carte de ’hizouk (view_chizuk.xml) -------------------------------------------
// Le texte tiré pour l'écran de séance, et celui du bravo après une annulation.
let chizukSeance = null;
let chizukBravo = null;

function tireChizuk(moment) {
  if (!chizuk) return null;
  const item = ChizukBag.tirer(store, chizuk, moment);
  chizukSeance = item ? { moment, item } : null;
  return chizukSeance;
}

function carteChizuk(tire, { compacte = false } = {}) {
  if (!tire) return null;
  const { moment, item } = tire;
  const traduction = ChizukRules.traduction(item, tr.langue);
  return h('section', { class: `chizuk${compacte ? ' compacte' : ''}` },
    h('div', { class: 'chizuk-tete' },
      h('div', { class: 'chizuk-art' }, h('img', { src: `img/${ART_DU_MOMENT[moment]}.webp`, alt: '' })),
      h('h2', { class: 'chizuk-moment' }, tr.t(moment === 'demande' ? 'chizuk_demande_title' : `moment_${moment}`))),
    // L'hébreu, de droite à gauche en toute langue.
    h('p', { class: 'chizuk-he ajuste', lang: 'he', dir: 'rtl' }, ChizukRules.hebreu(chizuk, item)),
    traduction ? h('hr', {}) : null,
    traduction ? h('p', { class: 'chizuk-trad ajuste' }, traduction) : null,
    h('p', { class: 'chizuk-ref' }, Reference.localise(item.ref, tr.langue)));
}

/**
 * Le corps qui se réduit jusqu'à tenir (autoSizeTextType d'Android) : la
 * carte garde sa hauteur, le texte ne déborde ni ne fait défiler.
 */
function ajusteLesTextes() {
  for (const el of app.querySelectorAll('.ajuste')) {
    const max = parseFloat(getComputedStyle(el).getPropertyValue('--corps-max')) || 19;
    let taille = max;
    el.style.fontSize = `${taille}px`;
    while (taille > 8 && el.scrollHeight > el.clientHeight + 1) {
      taille -= 1;
      el.style.fontSize = `${taille}px`;
    }
  }
}

// --- La séance (SessionActivity, SessionService) ----------------------------------------
let tic = null;
let etaitEnCours = false;
let verrouEcran = null;
/** Après « Terminer maintenant », la note est proposée au retour du bravo. */
let noteApresBravo = false;
/** { minutes } après une séance close, { annulee: true } après un abandon. */
let bravo = null;

async function gardeEcranAllume() {
  // FLAG_KEEP_SCREEN_ON d'Android. Refusé ou absent : l'écran s'éteint comme d'habitude.
  try { verrouEcran = await navigator.wakeLock?.request('screen'); } catch { verrouEcran = null; }
}
function relacheEcran() {
  verrouEcran?.release?.().catch(() => {});
  verrouEcran = null;
}

function demarreMusique() {
  // L'ambiance (19/10) suit son réglage, que la musique soit là ou non.
  joueAmbiance(store.ambiance(), store.musicVolume());
  if (!store.musicEnabled()) return;
  const m = morceauChoisi();
  if (!m) return;
  enEcoute = null;
  lecteur.src = m.fichier;
  lecteur.loop = true;
  if (volumeReglable) lecteur.volume = store.musicVolume() / 100;
  metadonnees(m);
  lecteur.play().catch(echecLecture);
}

/** Fondu court à la fin (MusicPlayer.stop) ; sur iPhone, où le volume ne se règle pas, l'arrêt est net. */
function arreteMusique() {
  arreteAmbiance();
  if (lecteur.paused) return;
  if (!volumeReglable) { lecteur.pause(); return; }
  const depart = lecteur.volume;
  let pas = 10;
  const fondu = setInterval(() => {
    pas -= 1;
    lecteur.volume = Math.max(0, (depart * pas) / 10);
    if (pas <= 0) { clearInterval(fondu); lecteur.pause(); lecteur.volume = depart; }
  }, 60);
}

// --- Le mini-lecteur de la pratique (MiniLecteur.kt, 19/10) ----------------------------
// Changer de morceau sans quitter la hitbodedout. Déplié : la pochette, le titre, la
// position, précédent, lecture, suivant. Replié : un disque qui tourne pendant la lecture,
// avec la photo du morceau ou, à défaut, le hassid à la guitare. Il vit hors de #app :
// le rendu de chaque seconde ne le reconstruit pas, et la barre ne saute pas sous le doigt.
const ICONES_LECTEUR = {
  lecture: 'M8 5v14l11-7z', pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  precedent: 'M6 6h2v12H6zm3.5 6 8.5 6V6z', suivant: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  replier: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
};
function iconeLecteur(nom) {
  const svg = s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.append(s('path', { d: ICONES_LECTEUR[nom], fill: 'currentColor' }));
  return svg;
}
let mini = null;
let miniDeplie = false;
let miniGlisse = false;

const minSec = (t) => { const x = Math.max(0, Math.floor(t || 0)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };

function morceauSuivant(sens) {
  if (!morceaux.length) return;
  const ici = Math.max(0, morceaux.findIndex((m) => m.id === morceauChoisi()?.id));
  const m = morceaux[(ici + sens + morceaux.length) % morceaux.length];
  store.setMusicEnabled(true);
  store.setMusicTrackId(m.id);
  demarreMusique();
  majMini();
}

function construireMini() {
  const disque = (cls) => h('button', { class: `mini-disque ${cls}` }, h('img', { alt: '' }));
  const ferme = disque('mini-replie');
  ferme.setAttribute('aria-label', tr.t('lecteur_ouvrir'));
  ferme.onclick = () => { miniDeplie = true; majMini(); mini.querySelector('.mini-panneau button')?.focus(); };
  const petit = disque('mini-petit');
  petit.tabIndex = -1;
  petit.setAttribute('aria-hidden', 'true');
  const barre = h('input', { type: 'range', class: 'mini-barre', min: 0, max: 1, step: 0.1, value: 0, 'aria-label': tr.t('lecteur_position') });
  barre.addEventListener('input', () => { miniGlisse = true; mini.querySelector('.mini-ecoule').textContent = minSec(barre.value); });
  barre.addEventListener('change', () => { miniGlisse = false; if (Number.isFinite(lecteur.duration)) lecteur.currentTime = Number(barre.value); });
  const bouton = (nom, libelle, action, cls = '') =>
    h('button', { class: `mini-bouton ${cls}`, 'aria-label': tr.t(libelle), onclick: action }, iconeLecteur(nom));
  const lecture = bouton('lecture', 'lecteur_lecture', () => {
    if (!lecteur.paused) { lecteur.pause(); majMini(); return; }
    if (!store.musicEnabled() || !lecteur.src) { store.setMusicEnabled(true); demarreMusique(); } else lecteur.play().catch(echecLecture);
    majMini();
  }, 'mini-lecture');
  mini = h('div', { class: 'mini-lecteur', hidden: true },
    ferme,
    h('div', { class: 'mini-panneau', role: 'region', 'aria-label': tr.t('music_title') },
      h('div', { class: 'mini-tete' }, petit, h('div', { class: 'mini-titre' }),
        bouton('replier', 'lecteur_replier', () => { miniDeplie = false; majMini(); ferme.focus(); })),
      barre,
      h('div', { class: 'mini-temps' }, h('span', { class: 'mini-ecoule' }), h('span', { class: 'mini-total' })),
      h('div', { class: 'mini-commandes' },
        bouton('precedent', 'lecteur_precedent', () => {
          if (lecteur.currentTime > 3) { lecteur.currentTime = 0; return; }
          morceauSuivant(-1);
        }),
        lecture,
        bouton('suivant', 'lecteur_suivant', () => morceauSuivant(1)))));
  document.body.append(mini);
  for (const ev of ['timeupdate', 'play', 'pause', 'loadedmetadata', 'ended']) lecteur.addEventListener(ev, majMini);
}

function majMini() {
  const montrer = store.isSessionRunning() && ecranCourant() === 'seance';
  // La place du disque, réservée sous l'écran : il ne couvre jamais « Terminer ».
  document.body.classList.toggle('avec-mini', montrer);
  if (!montrer) { if (mini) mini.hidden = true; return; }
  if (!mini) construireMini();
  mini.hidden = false;
  mini.classList.toggle('deplie', miniDeplie);
  const m = store.musicEnabled() ? morceauChoisi() : null;
  const joue = !lecteur.paused && !lecteur.ended;
  mini.classList.toggle('joue', joue);
  mini.querySelector('.mini-titre').textContent = m ? titreMorceau(m) : tr.t('music_off_short');
  const image = m?.image ?? 'img/char_guitar.webp';
  for (const img of mini.querySelectorAll('.mini-disque img')) {
    if (img.getAttribute('src') !== image) img.src = image;
    img.classList.toggle('pochette', !!m?.image);
  }
  const lecture = mini.querySelector('.mini-lecture');
  lecture.replaceChildren(iconeLecteur(joue ? 'pause' : 'lecture'));
  lecture.setAttribute('aria-label', tr.t(joue ? 'lecteur_pause' : 'lecteur_lecture'));
  const duree = Number.isFinite(lecteur.duration) ? lecteur.duration : 0;
  const barre = mini.querySelector('.mini-barre');
  if (!miniGlisse) {
    barre.max = Math.max(duree, 1);
    barre.value = lecteur.currentTime || 0;
    mini.querySelector('.mini-ecoule').textContent = minSec(lecteur.currentTime);
  }
  mini.querySelector('.mini-total').textContent = minSec(duree);
}

/** Lance une séance ; une durée choisie devient aussi la durée habituelle. */
function commencer(minutes) {
  if (minutes > 0) store.setTargetMinutes(minutes);
  store.beginSession(minutes);
  etaitEnCours = true;
  tireChizuk('ouverture');
  demarreMusique();
  gardeEcranAllume();
  // Le décompte s'affiche en haut : l'écran repart du début.
  delete app.dataset.ecran;
  rendre();
}

/**
 * SessionService.finishSession : le sujet se lit avant la clôture, les
 * minutes s'inscrivent, le bravo attend. Une séance arrêtée à zéro minute
 * n'inscrit rien.
 */
// Le jour de la séance qui vient de se clore : la note lui revient, pas au
// jour où l'on touche « Continuer » (une séance de 23 h 40 finit demain).
let dateNote = null;

function cloreSeance({ avantTerme }) {
  const sujet = store.sessionTheme();
  const { minutes, date } = store.endSession({ avantTerme });
  const inscrite = minutes > 0 || !avantTerme;
  if (inscrite) {
    store.addSession(minutes, { theme: sujet, date });
    store.setPendingCelebration(minutes);
    dateNote = date;
  }
  etaitEnCours = false;
  arreteMusique();
  relacheEcran();
  // Le mot de clôture, sur l'écran de séance (moment « cloture »).
  tireChizuk('cloture');
  return inscrite;
}

/** « Terminer maintenant » : la note est proposée après le bravo, ou tout de suite s'il n'y en a pas. */
function terminerMaintenant() {
  if (cloreSeance({ avantTerme: true })) noteApresBravo = true;
  else setTimeout(() => ecrireNote(dateNote ?? store.today(), rendre), 50);
  rendre();
}

function annulerSeance() {
  store.endSession({ avantTerme: true });
  etaitEnCours = false;
  arreteMusique();
  relacheEcran();
  chizukBravo = chizuk ? ChizukBag.tirer(store, chizuk, 'relance') : null;
  bravo = { annulee: true };
  history.pushState({ interne: true }, '', '#bravo');
  rendre();
}

const deuxChiffres = (n) => String(n).padStart(2, '0');

function compteur() {
  const mode = store.sessionCounter();
  const t = Date.now();
  if (mode === 'masque') return { texte: '', legende: tr.t('session_hidden_caption') };
  const ms = mode === 'ecoule'
    ? Math.max(0, t - store.sessionStartedAt())
    : Math.max(0, store.sessionEndsAt() - t);
  return {
    texte: `${deuxChiffres(Math.floor(ms / 60000))}:${deuxChiffres(Math.floor(ms / 1000) % 60)}`,
    legende: mode === 'ecoule' ? tr.t('session_open_caption') : tr.t('session_target', tr.duree(store.sessionTarget())),
  };
}

/**
 * La pratique calme (16/10, point 2, comme PratiqueCalme d'Android) : six
 * secondes sans toucher, et tout s'efface sauf le minuteur, sa lueur et
 * « Terminer » ; le fond s'assombrit. Un toucher n'importe où ramène tout
 * pour six secondes, sans déclencher ce qu'il y avait dessous.
 */
const CALME_MS = 6000;
let minuteurCalme = null;
let gesteAvale = false;
const feuilleOuverte = () => !!document.querySelector('.voile, .presentation, .grade-fete');
function attendreCalme() {
  clearTimeout(minuteurCalme);
  minuteurCalme = setTimeout(() => {
    const e = app.querySelector('.ecran.seance');
    if (!e || !store.isSessionRunning()) return;
    // Une fenêtre ouverte (« Terminer ? ») : pas de calme derrière elle (revue du 16/10).
    if (feuilleOuverte()) { attendreCalme(); return; }
    e.classList.add('calme');
  }, CALME_MS);
}
function arreteCalme() {
  clearTimeout(minuteurCalme);
  minuteurCalme = null;
}
function reveilCalme(ev) {
  if (ecranCourant() !== 'seance' || !store.isSessionRunning()) return;
  const e = app.querySelector('.ecran.seance');
  // Seul un toucher sur l'écran calme est avalé ; une touche réveille sans rien perdre.
  if (e?.classList.contains('calme')) {
    e.classList.remove('calme');
    if (ev.type === 'pointerdown' && e.contains(ev.target)) {
      gesteAvale = true;
      ev.preventDefault();
      ev.stopPropagation();
    }
  }
  attendreCalme();
}
addEventListener('pointerdown', reveilCalme, { capture: true });
addEventListener('keydown', reveilCalme, { capture: true });
// Le geste avalé ne vaut que pour son propre clic : rien ne reste en suspens après lui.
const relache = () => { if (gesteAvale) setTimeout(() => { gesteAvale = false; }, 0); };
addEventListener('pointerup', relache, { capture: true });
addEventListener('pointercancel', relache, { capture: true });
addEventListener('click', (ev) => {
  if (!gesteAvale) return;
  gesteAvale = false;
  ev.preventDefault();
  ev.stopPropagation();
}, { capture: true });

/** Chaque seconde : le décompte, et la fin quand elle arrive, écran allumé ou au retour. */
function demarreTic() {
  if (tic) return;
  tic = setInterval(() => {
    if (etaitEnCours && !store.isSessionRunning()) {
      cloreSeance({ avantTerme: false });
      rendre();
      return;
    }
    const el = app.querySelector('.decompte');
    if (el && store.isSessionRunning()) el.textContent = compteur().texte;
  }, 1000);
}
function arreteTic() {
  clearInterval(tic);
  tic = null;
}

// La lecture continue parfois écran verrouillé ; ses événements servent
// alors d'horloge pour arrêter la musique et clore la séance à son terme.
lecteur.addEventListener('timeupdate', () => {
  if (etaitEnCours && !store.isSessionRunning()) {
    cloreSeance({ avantTerme: false });
    // Sans ce rendu, la séance était close mais l'écran restait sur le décompte.
    rendre();
  }
});

/**
 * « Je ne sais pas quoi dire » (QuestionsBlocage.kt, propositions 3 et 15,
 * 19/10) : une question à la fois, d'après « מה אומרים? » du guide du propriétaire.
 */
const QUESTIONS_BLOCAGE = ['question_merci', 'question_raconter', 'question_ressenti', 'question_besoins', 'question_force',
  'question_bilan', 'question_pardon', 'question_decision', 'question_demain', 'question_fin'];
let questionSeance = -1;
let questionChange = false;

function ecranSeance() {
  const enCours = store.isSessionRunning();
  if (!enCours) questionSeance = -1;
  etaitEnCours = enCours;
  const fait = store.isDone();
  const sujet = store.sessionTheme();
  const morceau = store.musicEnabled() ? morceauChoisi() : null;
  const aBlocage = chizuk && ChizukRules.pourMoment(chizuk, 'blocage').length > 0;
  const c = enCours ? compteur() : null;

  const corps = [
    h('div', { class: 'seance-titre' }, tr.t('session_screen_title')),
    h('div', { class: 'scene' }, h('img', { src: `img/${enCours ? pendant() : fait ? joie() : appel()}.webp`, alt: '' })),
    enCours
      // La lueur de la pratique (16/10) respire derrière le minuteur.
      ? h('div', { class: 'decompte-cadre' }, h('div', { class: 'souffle', 'aria-hidden': 'true' }),
        c.texte ? h('div', { class: 'decompte', role: 'timer' }, c.texte) : h('div', { class: 'decompte-vide' }))
      : h('div', { class: 'decompte' }, tr.duree(store.targetMinutes())),
    // Fait, le grand chiffre reste la durée de la prochaine : la légende dit ce qui a été fait (13/10).
    h('p', { class: 'legende' }, enCours ? c.legende : fait ? tr.t('session_idle_done', tr.duree(store.record()?.minutes ?? 0)) : tr.t('session_idle_caption')),
    morceau ? h('p', { class: 'legende petite' }, tr.t('session_music_line', titreMorceau(morceau))) : null,
    carteChizuk(chizukSeance),
    enCours && aBlocage ? h('button', { class: 'texte-clair blocage', onclick: () => { tireChizuk('blocage'); if (questionSeance < 0) questionSeance = 0; rendre(); } }, tr.t('chizuk_stuck')) : null,
    enCours && questionSeance >= 0 ? h('div', { class: `question-seance${questionChange && !moinsDeMouvement() ? ' fondu-neuf' : ''}` },
      h('p', { class: 'question-rang' }, tr.t('question_rang', questionSeance + 1, QUESTIONS_BLOCAGE.length)),
      h('p', { class: 'question-texte' }, tr.t(QUESTIONS_BLOCAGE[questionSeance])),
      h('button', { class: 'texte-clair', onclick: () => { questionSeance = (questionSeance + 1) % QUESTIONS_BLOCAGE.length; questionChange = true; rendre(); questionChange = false; } }, tr.t('question_suivante'))) : null,
    h('button', { class: 'texte-clair', onclick: choisirSujet },
      sujet ? tr.t('session_theme_chosen', tr.t(`theme_${sujet}`)) : tr.t('session_theme_none')),
  ];

  if (enCours) {
    corps.push(
      h('button', {
        class: 'principal', onclick: () => confirmer(tr.t('session_finish_title'), tr.t('session_finish_message'),
          tr.t('session_finish_now'), terminerMaintenant),
      }, tr.t('session_finish_now')),
      h('button', {
        class: 'texte-clair', onclick: () => confirmer(tr.t('session_cancel_title'), tr.t('session_cancel_message'),
          tr.t('session_cancel'), annulerSeance),
      }, tr.t('session_cancel')));
  } else {
    // Les durées proposées, en deux rangées de trois, puis la durée réglable et la séance sans durée.
    corps.push(
      h('div', { class: 'durees' }, DureeSeance.PROPOSEES.map((m) =>
        h('button', { class: 'duree', onclick: () => commencer(m) }, tr.duree(m)))),
      h('button', { class: 'texte-clair', onclick: () => saisirDuree(commencer) }, tr.t('duration_custom')),
      h('button', { class: 'texte-clair', onclick: () => commencer(0) }, tr.t('session_open')),
      // « Commencer simplement » (proposition 15) : chacun démarre tout de suite.
      h('div', { class: 'simplement' },
        h('button', { class: 'texte-clair', onclick: () => commencer(store.targetMinutes()) }, tr.t('simplement_parler')),
        h('button', { class: 'texte-clair', onclick: () => { commencer(store.targetMinutes()); ecrireNote(store.today(), rendre); } }, tr.t('simplement_ecrire')),
        h('button', { class: 'texte-clair', onclick: () => { commencer(store.targetMinutes()); ouvrir('siddur'); } }, tr.t('simplement_prier')),
        h('button', { class: 'texte-clair', onclick: () => { commencer(store.targetMinutes()); questionSeance = 0; rendre(); } }, tr.t('simplement_question'))),
      h('button', { class: 'principal', onclick: () => commencer(store.targetMinutes()) },
        tr.t('session_start', tr.duree(store.targetMinutes()))));
  }

  return h('div', { class: 'ecran seance' },
    h('header', { class: 'barre' },
      h('button', { class: 'retour', 'aria-label': tr.t('action_back'), onclick: retour })),
    // La scène et ses chiffres, puis le reste : l'un sous l'autre, ou côte à côte
    // sur un téléphone couché (app.css, « Téléphone couché »).
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      h('div', { class: 'seance-scene' }, corps.slice(0, 5)),
      h('div', { class: 'seance-actions' }, corps.slice(5)))));
}

// --- Le bravo (CelebrationActivity) -------------------------------------------------
let danseEnCours = null;

function ecranBravo() {
  const annulee = !!bravo.annulee;
  const adresse = store.adresse();
  const titre = annulee
    ? tr.t(adresse === 'm' ? 'annulation_hazak' : adresse === 'f' ? 'annulation_hizki' : 'annulation_neutral')
    : tr.t(adresse === 'm' ? 'celebration_tsadik' : adresse === 'f' ? 'celebration_tsadeket' : 'celebration_neutral');
  const sousTitre = annulee ? tr.t('annulation_subtitle')
    : bravo.minutes > 0 ? tr.p('celebration_minutes', bravo.minutes) : null;
  const continuer = () => {
    bravo = null;
    chizukBravo = null;
    retour();
    if (noteApresBravo) {
      noteApresBravo = false;
      setTimeout(() => ecrireNote(dateNote ?? store.today(), rendre), 50);
    }
  };
  // Un jour la danse, le lendemain la guitare, le surlendemain le pouce levé (12-13/10).
  const seul = [null, 'char_guitar', 'char_thumbs_up'][Math.floor(Date.now() / 86400000) % 3];
  return h('div', { class: 'ecran bravo' },
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      h('div', { class: 'scene danse' },
        h('div', { class: 'danseur' },
          // Seul (guitare ou pouce levé), le personnage se balance au rythme de la danse.
          h('img', { class: 'pose-a', src: `img/${annulee ? 'char_walking' : seul ?? 'char_dancing'}.webp`, alt: '' }),
          annulee ? null : h('img', { class: 'pose-b', src: `img/${seul ?? 'char_dancing_joy'}.webp`, alt: '' }))),
      h('h1', { class: 'bravo-titre' }, titre),
      sousTitre ? h('p', { class: 'bravo-sous-titre' }, sousTitre) : null,
      annulee && chizukBravo ? carteChizuk({ moment: 'relance', item: chizukBravo }, { compacte: true }) : null,
      h('button', { class: 'principal', onclick: continuer }, tr.t('celebration_continue')),
      // Partager la séance faite (12/10), avec le lien de la version web.
      !annulee && bravo.minutes > 0 ? h('button', { class: 'lien-bouton bravo-partage', onclick: () => partagerSeance(bravo.minutes) }, tr.t('partage_action')) : null)));
}

const LIEN_WEB = 'https://hil123.github.io/myhitbodedut-web/';
/** Le texte d'une séance faite et le lien de la version web : le partage du téléphone, sinon le presse-papiers. */
async function partagerSeance(minutes) {
  const serie = store.streak?.() ?? 0;
  const texte = [tr.t('partage_texte', tr.p('partage_minutes', minutes)), serie >= 2 ? tr.t('partage_serie', serie) : null,
    tr.t('partage_lien', LIEN_WEB)].filter(Boolean).join('\n');
  try {
    if (navigator.share) { await navigator.share({ text: texte }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(texte); signale(tr.t('partage_copie')); } catch { /* rien d'autre à faire */ }
}

/**
 * La danse du hassid : à chaque temps il saute, retombe en pliant les
 * genoux, et change de jambe ; des notes montent de la scène. Rien si le
 * téléphone demande moins d'animations.
 */
function danse() {
  arreteDanse();
  if (bravo?.annulee || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const scene = app.querySelector('.scene.danse');
  const danseur = app.querySelector('.danseur');
  const poseA = app.querySelector('.pose-a');
  const poseB = app.querySelector('.pose-b');
  if (!scene || !danseur || !poseB) return;
  const debut = performance.now();
  const periode = 2 * DanseMesure.TEMPS_MS;
  const image = (t) => {
    const p = DanseMesure.pas(((t - debut) % periode) / periode);
    danseur.style.transform = `translateY(${-16 * p.hauteur}px) scale(${1 + 0.04 * p.flexion}, ${1 - 0.05 * p.flexion}) rotate(${6 * p.balance}deg)`;
    poseA.style.opacity = String(1 - p.poseB);
    poseB.style.opacity = String(p.poseB);
    danseEnCours.image = requestAnimationFrame(image);
  };
  const SIGNES = ['♪', '♫', '♪', '✦'];
  const note = () => {
    const l = scene.clientWidth;
    const hauteur = scene.clientHeight;
    if (!l) return;
    const n = h('span', { class: 'note', 'aria-hidden': 'true' }, SIGNES[Math.floor(Math.random() * SIGNES.length)]);
    n.style.fontSize = `${18 + Math.floor(Math.random() * 8)}px`;
    n.style.left = `${l * ((Math.random() < 0.5 ? 0.18 : 0.72) + Math.random() * 0.1)}px`;
    n.style.top = `${hauteur * 0.55}px`;
    scene.append(n);
    const anim = n.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${(Math.random() - 0.5) * 30}px, ${-hauteur * 0.45}px) rotate(${(Math.random() - 0.5) * 40}deg)`, opacity: 0 },
    ], { duration: 1700, easing: 'cubic-bezier(0, 0, 0.2, 1)' });
    anim.onfinish = () => n.remove();
  };
  danseEnCours = { image: requestAnimationFrame(image), notes: setInterval(note, DanseMesure.TEMPS_MS + 180) };
  note();
}
function arreteDanse() {
  if (!danseEnCours) return;
  cancelAnimationFrame(danseEnCours.image);
  clearInterval(danseEnCours.notes);
  danseEnCours = null;
}

// --- Navigation --------------------------------------------------------------------------
// Chaque écran secondaire est une entrée d'historique : le bouton retour
// et le geste de retour ramènent à l'accueil, sur l'onglet quitté.
function ecranCourant() {
  const e = location.hash.slice(1);
  return ['musique', 'reglages', 'seance', 'bravo', 'tehilim', 'lecture', 'siddur', 'priere', 'tikkun', 'bibliotheque', 'livres', 'source', 'zmanim', 'calendrier', 'paliers', 'hilloulot', 'halakha', 'recherche', 'hizouk', 'parcours'].includes(e) ? e : 'accueil';
}
function ouvrir(ecran) {
  // L'entrée sur l'écran de séance tire le mot d'ouverture (SessionActivity.onCreate).
  if (ecran === 'seance' && ecranCourant() !== 'seance') tireChizuk('ouverture');
  if (ecranCourant() !== ecran) history.pushState({ interne: true }, '', `#${ecran}`);
  rendre();
}

/**
 * Le retour. Ouverte directement sur un écran secondaire (application
 * relancée), la page n'a pas d'historique où revenir : on rentre à l'accueil.
 */
function retour() {
  if (history.state?.interne) history.back();
  else { history.replaceState(null, '', location.pathname); rendre(); }
}
window.addEventListener('popstate', () => {
  // Le retour d'un renvoi (« Hallel › ») rouvre la prière d'où l'on venait.
  if (history.state?.priere) priere = history.state.priere;
  rendre();
});

/** Un renvoi du jour : la prière [cible] en haut de page ; le retour ramène à [depuis]. */
function ouvrirRenvoi(depuis, cible) {
  history.replaceState({ ...(history.state ?? {}), priere: depuis }, '', location.hash);
  history.pushState({ interne: true, priere: cible }, '', '#priere');
  priere = cible;
  rendre();
  const defile = app.querySelector('.defile');
  if (defile) defile.scrollTop = 0;
}

function rendre() {
  appliquerPolice();
  // Une séance arrivée à son terme pendant que le téléphone dormait.
  if (store.isSessionOver()) cloreSeance({ avantTerme: false });
  // Le bravo d'une séance close attend le prochain écran ouvert.
  if (['accueil', 'seance'].includes(ecranCourant())) {
    const minutes = store.takePendingCelebration();
    if (minutes !== null) {
      bravo = { minutes };
      history.pushState({ interne: true }, '', '#bravo');
    }
  }
  if (ecranCourant() === 'bravo' && !bravo) history.replaceState(null, '', location.pathname);
  // La position de défilement survit à un nouveau rendu du même écran.
  const avant = app.querySelector('.defile')?.scrollTop ?? 0;
  const ecran = ecranCourant();
  // L'horloge tourne tant qu'une hitbodedout est en cours, quel que soit l'écran : sinon sa fin
  // n'était vue qu'au toucher suivant (audit du 16/10).
  if (ecran !== 'seance' && !store.isSessionRunning()) arreteTic();
  if (ecran !== 'bravo') arreteDanse();
  queueMicrotask(majMini);
  const memeEcran = app.dataset.ecran === `${ecran}/${onglet}`;
  app.replaceChildren();
  if (ecran === 'musique') app.append(ecranMusique());
  else if (ecran === 'reglages') app.append(ecranReglages());
  else if (ecran === 'zmanim') app.append(ecranZmanim());
  else if (ecran === 'calendrier') app.append(ecranCalendrier());
  else if (ecran === 'paliers') app.append(ecranPaliers());
  else if (ecran === 'hilloulot') app.append(ecranHilloulot());
  else if (ecran === 'halakha') app.append(ecranHalakha());
  else if (ecran === 'recherche') app.append(ecranRecherche());
  else if (ecran === 'seance') app.append(ecranSeance());
  else if (ecran === 'hizouk') app.append(ecranHizouk());
  else if (ecran === 'parcours') app.append(ecranParcours());
  else if (ecran === 'bravo') app.append(ecranBravo());
  else if (ecran === 'tehilim') app.append(ecranTehilim());
  else if (ecran === 'lecture') app.append(ecranLecture());
  else if (ecran === 'siddur') app.append(ecranSiddur());
  else if (ecran === 'priere') app.append(ecranPriere());
  else if (ecran === 'tikkun') app.append(ecranTikkun());
  else if (ecran === 'bibliotheque') app.append(ecranBibliotheque());
  else if (ecran === 'livres') app.append(ecranLivres());
  else if (ecran === 'source') app.append(ecranSource());
  else {
    app.append(h('div', { class: 'ecran avec-onglets' },
      h('div', { class: 'defile' }, onglet === 'textes' ? panneauTextes() : panneauAujourdhui()),
      onglets()));
  }
  app.dataset.ecran = `${ecran}/${onglet}`;
  if (memeEcran) app.querySelector('.defile').scrollTop = avant;
  // Les effets (19/10) : un écran qu'on ouvre entre, ses cartes l'une après l'autre ;
  // un écran redessiné sur place (chaque seconde pendant la séance) ne rejoue rien.
  else effetsEntree(ecran);
  // L'accueil qui apparaît s'anime seul : anneaux, puis saut ou fête (04/10).
  const accueil = ecran === 'accueil' && onglet === 'aujourdhui';
  if (!accueil) { accueilAnime = false; facePlaque = 'hassid'; clearTimeout(minuteurPlaque); }
  else if (!accueilAnime) { accueilAnime = true; setTimeout(animerAccueil, 950); }
  // Le bilan de la semaine écoulée, une fois, à la première ouverture de la semaine (16/10).
  if (accueil && !document.querySelector('.presentation')) setTimeout(bilanDeLaSemaine, 1400);
  // En quittant la lecture, le bouton se replie ; l'écran suivant le retrouve en pastille.
  if (!ECRANS_LUS.includes(ecran)) { reglagesOuverts = false; choixNusahOuvert = false; }
  ajusteLesTextes();
  if (ecran === 'seance' || store.isSessionRunning()) demarreTic();
  if (ecran === 'seance' && store.isSessionRunning()) attendreCalme(); else arreteCalme();
  if (ecran === 'bravo') danse();
}

// --- Démarrage ---------------------------------------------------------------------------
async function demarrer() {
  tr = await chargeTraduction(langueInitiale(store.langueApp(), navigator.languages));
  appliqueApparence();
  const [m, t, c] = await Promise.all([
    fetch('data/musique.json').then((r) => r.json()),
    fetch('data/tikkun_haklali.json').then((r) => r.json()),
    fetch('data/chizuk.json').then((r) => r.json()),
  ]);
  morceaux = m;
  tikkun = t;
  chizuk = c;
  // Rouvert sur l'écran de séance : son mot d'ouverture.
  if (ecranCourant() === 'seance') tireChizuk('ouverture');
  if (store.ouverture() === 'zmanim' && ecranCourant() === 'accueil') history.pushState({ interne: true }, '', '#zmanim');
  rendre();
  // Le premier lancement, ou une présentation qui a changé depuis (Onboarding.VERSION).
  if (store.onboardedVersion() < PRESENTATION_VERSION) presentation();
  // Revenir à l'application redessine l'écran : un autre jour, une séance
  // arrivée à son terme, le décompte qui a continué pendant le sommeil.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    accueilAnime = false;
    facePlaque = 'hassid';
    if (store.isSessionRunning()) gardeEcranAllume();
    rendre();
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
demarrer();

// L'écran d'ouverture (15/10) : le 'hassid devant le tziyoun une seconde et demie, puis un fondu ;
// une seule fois par session (un rechargement ne le rejoue pas).
{
  const ouverture = document.getElementById('ouverture');
  let deja = false;
  try { deja = sessionStorage.getItem('ouverture-vue') === '1'; sessionStorage.setItem('ouverture-vue', '1'); } catch { /* stockage refusé : on le montre */ }
  if (ouverture) {
    if (deja) ouverture.remove();
    else setTimeout(() => { ouverture.classList.add('fin'); setTimeout(() => ouverture.remove(), 400); }, 1500);
  }
}

// La banderole du haut s'efface quand on fait défiler vers le bas, et revient en haut
// de la page (13/10) ; seulement si la page la dépasse, sinon elle reviendrait aussitôt.
document.addEventListener('scroll', (e) => {
  const d = e.target;
  if (!(d instanceof Element) || !d.classList.contains('defile')) return;
  const ecran = d.closest('.avec-bandeau');
  const bandeau = ecran?.querySelector('.bandeau');
  if (!bandeau) return;
  if (d.scrollTop > 8 && d.scrollHeight - d.clientHeight > bandeau.offsetHeight) ecran.classList.add('bandeau-cache');
  else if (d.scrollTop <= 0) ecran.classList.remove('bandeau-cache');
}, true);
