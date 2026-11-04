// L'application : l'accueil (MainActivity), la séance (SessionActivity),
// le bravo (CelebrationActivity), la musique (MusicActivity) et un premier
// écran de réglages. Les écrans suivants arrivent par étapes ; ce qui
// n'existe pas encore est montré, mais inerte (classe « a-venir »).

import { chargeTraduction, formate, langueInitiale, LANGUES } from './i18n.js';
import { Anneaux, CycleTehilim, LanguesTexte, DureeSeance, JaugeSemaine, LibraryRules, Plaque, Reference, Salutation, SiddurMoment, SignetsSiddur, SourceDuJour, Parcours } from './regles.js';
import { ART_DU_MOMENT, ChizukBag, ChizukRules } from './chizuk.js';
import { AMBIANCES, arreter as arreteAmbiance, jouer as joueAmbiance } from './ambiance.js';
import { MelangeMusique, estQuota, nomDonne, renomme, titreDeFichier } from './musique.js';
import * as MorceauxPerso from './morceaux-perso.js';
import { DanseMesure } from './seance.js';
import { creeStore, memoire, repriseValable } from './store.js';
import { ajouteJours, heureDans, isoDans, isoLocal } from './calendrier.js';
import { JERUSALEM_GEONAMES, RAPPELS_TEFILA, dansIsrael, USAGES_LEVANA, aJerusalem, calendrier, jour as jourJuif, jourDeLaPriere, levana, rappelsTefila, usageLevana } from './calendrier-juif.js';
import { conditionsPour, index as indexAjouts, libelleJour, vrai as ajoutVrai } from './siddur-jour.js';
import { Dedicace, JournalPlus } from './regles.js';
import { aerer } from './aeration.js';
import { distanceKm } from './direction.js';
import * as Paliers from './paliers.js';
import * as Trophees from './trophees.js';
import { FORMES, ICONES } from './trophees-formes.js';
import { pour as halakhotPour, recherche as rechercheHalakha, source as sourceHalakha } from './halakha.js';
import { pour as yalkutPour, recherche as rechercheYalkut, source as sourceYalkut, texteCarte, titreCarte } from './yalkut.js';
import { ajouts as ajoutsDuJour, dateHilloula, debutMoisHebreu, hilloulotPour, clesHilloulotPour, prochainJourHilloula, lienArticle, rechercheHilloula, horaires, illustration as illustrationDuJour, lienHalakha, lienHyomi, momentDuSiddour, moisHebreuVoisin, semaines, semainesHebreu } from './jour-affiche.js';
import { ALLUMAGES, heure as heureZman, jour as zmanimDuJour } from './zmanim.js';
import * as Vol from './vol.js';
import * as Boussole from './boussole.js';
import * as Tikkun from './tikkun.js';
import { RELAIS_VOL } from './relais.js';
import { chemin as cheminPersonnage } from './personnage.js';
// La hitbodedout guidée (02/11, Hitbodedut.kt, GuideSujets.kt).
import { Hitbodedut, MOUVEMENTS, invitationSujet } from './hitbodedut.js';

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
    else if (k === 'src') el.setAttribute(k, perso(v));
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat()) {
    if (e === null || e === undefined || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(meteg(String(e))));
  }
  return el;
}
// Le meteg (U+05BD) tombe sur la voyelle dans Noto Serif Hebrew et Noto Rashi : un patah
// devient un faux qamats, un segol se brouille (capture du 29/10, עָלֶֽיהָ). David, Miriam et
// Varela ne l'ont pas et l'empruntent à la première. Masqué à l'affichage par U+034F, invisible
// et de même longueur, comme PoliceHebraique.ABSENTS ; seule Frank Ruhl le dessine à part.
const SANS_METEG = new Set(['serif', 'rachi', 'david', 'miriam', 'arrondie']);
// La police lue une fois par affichage (02/11) : meteg passe sur chaque morceau de texte, et
// relire les réglages à chaque fois coûtait des milliers de lectures pour un livre entier.
let policeAffichee = null;
const meteg = (t) => (SANS_METEG.has(policeAffichee ??= store.lecturePolice()) ? t.replace(/\u05BD/g, '\u034F') : t);
// Le personnage au féminin pour qui a choisi צדקת (personnage.js) : chaque
// image passe par ici, celles de h() comme celles écrites en SVG.
const perso = (src) => cheminPersonnage(src, store.adresse());
// L'écran d'ouverture est écrit dans index.html : on le reprend dès le départ.
for (const img of document.querySelectorAll('#ouverture img.hassid')) img.setAttribute('src', perso(img.getAttribute('src')));
const SVG = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// --- Les sujets (Theme.kt), dans l'ordre de la liste Android ----------------------
const SUJETS = ['emotions', 'gratitude', 'decisions', 'famille', 'zivoug', 'parnassa', 'avoda', 'difficultes', 'croissance', 'autre'];

// --- Le jour affiché et le moment du lieu (02/11) ------------------------------
// Un seul « aujourd'hui » à l'écran : celui du téléphone, pour le journal, la série, le
// calendrier, les zmanim, la halakha, les hilloulot, les Tehilim et les rappels de tefila
// — sinon, avec une ville dans un autre fuseau, calendrier et journal montraient deux jours
// différents autour de minuit. Seul le moment de la prière suit l'heure de la ville choisie
// (prière du moment, sortie des étoiles, 'Hanouka, Méguila, bannière, Levana, salutation) :
// c'est là qu'on prie.
const jourLieu = (t = new Date()) => isoDans(t, store.lieu()?.fuseau);
const heureLieu = (t = new Date()) => heureDans(t, store.lieu()?.fuseau);

// --- Le hassid (Character.kt) : stable sur une journée, change le lendemain -------
const JOIE = ['char_dancing_joy', 'char_dancing', 'char_guitar', 'char_thumbs_up', 'char_open_arms'];
function duJour(pool, sel) {
  const [a, m, j] = store.today().split('-').map(Number);
  const jourEpoque = Math.round(Date.UTC(a, m - 1, j) / 86400000) + sel * 7;
  return pool[((jourEpoque % pool.length) + pool.length) % pool.length];
}
const APPEL = ['char_praise', 'char_pointing', 'char_walking', 'char_tehilim', 'char_thinking', 'char_welcome', 'char_open_arms'];
const PENDANT = ['char_open_arms', 'char_praying', 'char_standing_back', 'char_praise'];
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
  // L'icône suit צדיק / צדקת et la couleur des boutons, comme sur Android (IconeLanceur) ;
  // iOS la lit au moment de « Sur l'écran d'accueil » (web/tools/icones.mjs).
  const icone = `icones/apple-touch-icon-${store.adresse() === 'f' ? 'f' : 'm'}-${store.accent()}.png`;
  for (const lien of document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="icon"]')) lien.setAttribute('href', icone);
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

// Le nom donné (MusicLibrary.nameOf), sinon le titre livré, ou celui du fichier ajouté.
const titreMorceau = (m) => nomDonne(store.musicNames(), m.id) ?? (m.perso ? m.titre || tr.t('music_unnamed') : tr.t(m.titre));
const morceauChoisi = () => morceaux.find((m) => m.id === store.musicTrackId()) ?? morceaux[0] ?? null;

// La lecture aléatoire de la séance (SessionService.jouerAuHasard, 28/09) : le morceau qui
// joue vraiment (Store.musicNow), le sac du tirage, et les morceaux joués pour « précédent ».
const melange = new MelangeMusique();
let morceauJoue = null;
let lectureAuHasard = false;
let joues = [];
/** En lecture aléatoire, le morceau qui joue, pas le morceau choisi (SessionActivity.renderMusicLine). */
const morceauEnCours = () => (store.musicShuffle() ? morceaux.find((m) => m.id === morceauJoue) : null) ?? morceauChoisi();
/** « Musique : Aléatoire » tant que le premier tirage n'a pas eu lieu. */
const titreEnCours = (m) => (store.musicShuffle() && !morceauJoue ? tr.t('music_shuffle_short') : titreMorceau(m));
lecteur.addEventListener('ended', () => {
  if (lectureAuHasard && store.isSessionRunning() && store.musicEnabled()) jouerAuHasard();
});

/** Un morceau ajouté, tel que la bibliothèque le montre : lu depuis une adresse blob:. */
const versMorceau = (e) => ({ id: e.id, titre: e.titre, perso: true, fichier: URL.createObjectURL(e.blob), source: e.source });

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
  lectureAuHasard = false;
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
      pastille(tr.t('start_music'), morceau ? (store.musicShuffle() ? tr.t('music_shuffle_short') : titreMorceau(morceau)) : tr.t('start_music_off'), () => ouvrir('musique'))),

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
    // « Je l'ai faite sans le téléphone » (MainActivity.today_offline, 02/11) : tant qu'aujourd'hui
    // ou hier reste à inscrire, et hors séance en cours.
    (!fait || hierOuvert()) && !store.isSessionRunning()
      ? h('button', { class: 'texte-bouton', onclick: declarerHorsTelephone }, tr.t('action_done_offline')) : null,
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

/** « Mon parcours » (ParcoursActivity) : les chiffres, le mois en barres, les sujets et l'humeur (02/11). */
function ecranParcours() {
  const b = Parcours.bilan(store.jours());
  // L'humeur sur les journées du journal seulement, comme Android (jours.keys).
  const notes = store.journalPlusTout();
  const humeur = JournalPlus.humeur(store.jours().map((r) => notes[r.date] ?? JournalPlus.lire(null)));
  const mois = graphiqueDuMois();
  const totalMois = mois.minutes.reduce((s, m) => s + m, 0);
  const joursMois = mois.minutes.filter((m) => m > 0).length;
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
      // Le mois, en barres, sur le vert du bandeau (ParcoursActivity, 02/11).
      h('h2', { class: 'section' }, tr.t('parcours_mois')),
      h('div', { class: 'carte-mois' },
        h('p', { class: 'carte-mois-total' }, totalMois === 0 ? tr.t('parcours_mois_vide') : tr.p('parcours_mois_total', joursMois, tr.duree(totalMois), joursMois)),
        mois.graphique),
      h('h2', { class: 'section' }, tr.t('parcours_sujets')),
      h('div', { class: 'carte' }, b.sujets.length
        ? b.sujets.map(([s, n]) => h('div', { class: 'sujet-parcours' },
          h('div', { class: 'sujet-tete' }, h('span', {}, tr.t(`theme_${s}`)), h('span', { class: 'sujet-fois' }, tr.p('parcours_fois', n))),
          h('div', { class: 'sujet-piste' }, h('div', { class: 'sujet-plein', style: `width: ${Math.max(4, Math.round((100 * n) / max))}%` }))))
        : h('p', { class: 'parcours-vide' }, tr.t('parcours_sujets_vide'))),
      // L'humeur, quand elle a été notée : grande, avant → après (ParcoursActivity, 02/11).
      humeur ? h('h2', { class: 'section' }, tr.t('parcours_humeur')) : null,
      humeur ? h('div', { class: 'carte parcours-humeur' },
        h('p', { class: 'parcours-humeur-emojis', role: 'img', 'aria-label': `${humeur.avant}/5 ${tr.rtl ? '←' : '→'} ${humeur.apres}/5` },
          `${JournalPlus.HUMEURS[humeur.avant - 1]}  ${tr.rtl ? '←' : '→'}  ${JournalPlus.HUMEURS[humeur.apres - 1]}`),
        h('p', { class: 'parcours-humeur-legende' }, `${tr.t('parcours_humeur_legende')} · ${tr.p('parcours_humeur_jours', humeur.jours)}`)) : null)));
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
  if (t) cartes.push(carteMaintenant(t, undefined, undefined, tr.t(Salutation.mot(heureLieu(heure).heures))));
  const zone = store.lieu()?.fuseau ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const l = levana(jourLieu(heure), zone, { usage: usageLevanaCourant() });
  const lv = siddur.textes.find((x) => x.id === 'birkat_halevana');
  if (lv && typeof l.etat === 'string' && heureLieu(heure).heures >= 14) {
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
        // Un seul « Commencer » sur l'accueil, celui du haut : la source invite à lire.
        h('button', { class: 'secondaire', onclick: () => { entreeBiblio = p.source.id; ouvrir('source'); } }, tr.t('source_du_jour_lire')))));
  }
  return cartes.length ? [h('div', { class: 'accueil-moment' }, ...cartes)] : [];
}

function pastille(libelle, valeur, onclick) {
  return h('button', { class: 'pastille', onclick },
    h('span', { class: 'libelle' }, libelle), h('span', { class: 'valeur' }, valeur));
}

function ligne({ nom, etat, onclick, aVenir = false, fin = null, class: classe = '' }) {
  return h('button', { class: `ligne${aVenir ? ' a-venir' : ''}${classe ? ` ${classe}` : ''}`, onclick, 'aria-disabled': aVenir ? 'true' : null },
    h('span', { class: 'corps' }, h('div', { class: 'nom' }, nom), etat ? h('div', { class: 'etat' }, etat) : null),
    fin, h('span', { class: 'chevron', 'aria-hidden': 'true' }));
}

function etatTikkun() {
  if (!tikkun) return '';
  // TikkunActivity.render (02/11) : tikkun.js.
  const { cle, args } = Tikkun.progres(tikkun, store.tikkunDone());
  return tr.t(cle, ...args);
}

function etatMusique() {
  const m = morceauChoisi();
  if (!store.musicEnabled()) return tr.t('music_off_summary');
  if (!m) return tr.t('music_none_summary');
  if (store.musicShuffle()) return volumeReglable ? tr.t('music_shuffle_summary', store.musicVolume()) : tr.t('music_shuffle');
  return volumeReglable ? tr.t('music_on_summary', titreMorceau(m), store.musicVolume()) : titreMorceau(m);
}

// --- Tehilim (Tehilim.kt, TehilimActivity.kt) ------------------------------------
// Le livre entier, chargé au premier besoin : 327 ko qu'on ne lit pas à chaque ouverture.
let tehilim = null;
// Les traductions du domaine public (04/11) : { fr: { psaumes }, en: { psaumes } }.
let tehilimTrad = {};
let lecture = null;

// --- Les langues de lecture (LanguesTexte, 04/11) ------------------------------------
const languesLecture = () => LanguesTexte.mode(store.lectureLangues(), tr.langue);
/**
 * Des paragraphes hébreux et leurs traductions (paragraphes_fr / _en, 04/11), dans les langues
 * choisies : fait(p) rend un paragraphe hébreu.
 */
const paragraphesTraduits = (heb, fr, en, fait) => heb.flatMap((p, i) => {
  const textes = LanguesTexte.textes(languesLecture(), p, fr?.[i], en?.[i]);
  const avecHe = textes.some(([l]) => l === 'he');
  return textes.map(([l, t]) => (l === 'he' ? fait(t) : paraTraduction(l, t, !avecHe)));
});
/** Une traduction affichée : de gauche à droite, en romain ; plus discrète sous l'hébreu. */
const paraTraduction = (langue, texte, seule) => h('p', { class: `traduction${seule ? ' seule' : ''}`, lang: langue, dir: 'ltr' }, texte);
/** Le choix des six façons de lire : la feuille, et l'écran redessiné. */
function choisirLangues() {
  feuille(tl('lecture_langues'), (f, fermer) => {
    const actuel = languesLecture();
    f.append(h('div', { role: 'radiogroup', 'aria-label': tl('lecture_langues') }, LanguesTexte.MODES.map((m) => h('button', {
      type: 'button', class: 'choix choix-radio', role: 'radio', 'aria-checked': String(m === actuel),
      onclick: () => { fermer(); store.setLectureLangues(m); rendreEtViser('.lecture-langues'); },
    }, h('span', { class: 'radio', 'aria-hidden': 'true' }), tr.t(`langues_${m.replace('+', '_')}`)))));
  });
  document.querySelector('.feuille [aria-checked="true"]')?.focus();
}
function chargeTehilim() {
  if (tehilim) return true;
  fetch('data/tehilim.json').then((r) => r.json()).then((d) => { tehilim = d.psaumes; tehilimTrad = d.traductions ?? {}; rendre(); });
  return false;
}

/** Le jour du mois hébraïque et la longueur du mois (29 ou 30), par le calendrier du navigateur. */
function jourHebreu(date = new Date()) {
  // Le jour affiché (02/11) : midi UTC de la date du téléphone, lu en UTC.
  const midi = new Date(`${isoLocal(date)}T12:00:00Z`);
  const jour = (d) => Number(new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', timeZone: 'UTC' }).format(d));
  const j = jour(midi);
  const demain = new Date(midi.getTime() + 86400000);
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
  const auj = new Date(`${isoLocal(new Date())}T12:00:00Z`);
  const semaine = CycleTehilim.deLaSemaine(auj.getUTCDay());
  const nomJour = new Intl.DateTimeFormat(tr.langue, { weekday: 'long', timeZone: 'UTC' }).format(auj);
  const pret = chargeTehilim();
  const versets = pret ? tehilim.reduce((n, ch) => n + ch.length, 0) : null;
  return h('div', { class: 'ecran' }, barre(tr.t('tehilim_title')),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      versets ? h('p', { class: 'indice' }, tr.t('tehilim_count', 150, versets.toLocaleString(tr.langue))) : null,
      // Les marque-pages des Tehilim (28/10), en tête : la même feuille que la Bibliothèque.
      ...[ligneSignets('t')].filter(Boolean).map((l) => h('div', { class: 'carte' }, l)),
      h('div', { class: 'carte' },
        ligne({ nom: tr.t('tehilim_month'), etat: tr.t('tehilim_month_state', nombreTehilim(jour), libellePortion(portion)), onclick: () => lire(portion) }),
        ligne({ nom: tr.t('tehilim_week'), etat: tr.t('tehilim_week_state', nomJour.charAt(0).toLocaleUpperCase(tr.langue) + nomJour.slice(1), libellePortion(semaine)), onclick: () => lire(semaine) })),
      h('h2', { class: 'section' }, tr.t('tehilim_all')),
      h('div', { class: 'grille-psaumes' }, Array.from({ length: 150 }, (_, i) => i + 1).map((n) =>
        h('button', { class: 'case-psaume', 'aria-label': libellePortion(CycleTehilim.portion(n, n)), onclick: () => lire(CycleTehilim.portion(n, n)) },
          nombreTehilim(n)))))));
}

/** La clé des marque-pages des Tehilim (28/10) : le psaume en section, le verset en bloc. */
const CLE_TEHILIM = 't:tehilim';

/** Un verset ; un appui long le marque ou le démarque, comme un paragraphe du siddour. */
function verset(n, v, texte) {
  const marque = () => store.marques().some((m) => m.cle === CLE_TEHILIM && m.section === n && m.bloc === v);
  const p = h('p', { class: `verset${marque() ? ' marque-page' : ''}`, 'data-place': `${n}:${v}` },
    h('span', { class: 'num', 'aria-hidden': 'true' }, `${Reference.lettres(v)} `), texte);
  let minuteur = null;
  const poser = () => {
    const pose = store.basculerMarque({ cle: CLE_TEHILIM, nusah: '', section: n, bloc: v, apercu: `${Reference.lettres(n)}, ${Reference.lettres(v)} · ${apercuMarque(texte, 5)}` });
    p.classList.toggle('marque-page', pose);
    signale(tr.t(pose ? 'marque_posee' : 'marque_retiree'));
  };
  p.addEventListener('contextmenu', (e) => { e.preventDefault(); clearTimeout(minuteur); poser(); });
  p.addEventListener('touchstart', () => { minuteur = setTimeout(() => { minuteur = null; poser(); }, 550); }, { passive: true });
  for (const ev of ['touchend', 'touchmove', 'touchcancel']) p.addEventListener(ev, () => clearTimeout(minuteur), { passive: true });
  return p;
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
    // Les langues choisies (04/11) : verset par verset, l'hébreu et/ou la traduction.
    const mode = languesLecture();
    const trad = (l, v) => tehilimTrad[l]?.psaumes?.[n - 1]?.[v - 1];
    blocs.push(h('div', { class: 'psaume', lang: 'he', dir: 'rtl' }, quels.flatMap((v) => {
      if (mode === 'he') return [verset(n, v, tous[v - 1])];
      const textes = LanguesTexte.textes(mode, tous[v - 1], trad('fr', v), trad('en', v));
      const avecHe = textes.some(([l]) => l === 'he');
      return textes.map(([l, t], k) => (l === 'he' ? verset(n, v, t)
        : paraTraduction(l, avecHe || k > 0 ? t : `${v}  ${t}`, !avecHe)));
    })));
  }
  const aller = (n) => { lecture = CycleTehilim.portion(n, n); rendre(); app.querySelector('.defile').scrollTop = 0; };
  const ecran = ecranLu(libellePortion(p), h('div', { class: 'contenu lecture' },
      h('p', { class: 'indice' }, tr.p('tehilim_verses', total, total)),
      ...blocs), { avecNusah: false, pied: seul ? h('div', { class: 'lecture-nav' },
      h('button', { class: 'secondaire', style: p.debut > 1 ? null : 'visibility:hidden', onclick: () => aller(p.debut - 1) }, tr.t('tehilim_previous')),
      h('button', { class: 'principal', style: p.debut < 150 ? null : 'visibility:hidden', onclick: () => aller(p.debut + 1) }, tr.t('tehilim_next'))) : null });
  if (marqueAOuvrir?.cle === CLE_TEHILIM) { const m = marqueAOuvrir; marqueAOuvrir = null; requestAnimationFrame(() => allerAMarque(ecran, m)); }
  return ecran;
}

// --- Siddour (SiddurActivity.kt, SiddurLectureActivity.kt) ------------------------
const siddurs = {};
let siddur = null;
let priere = null;
const NUSAH = [['edot', 'siddur_nusah_edot'], ['sefard', 'siddur_nusah_sefard'], ['ashkenaz', 'siddur_nusah_ashkenaz']];
/** Le siddour du nusah choisi, chargé au premier besoin (un fichier par nusah). */
/** Les livres entiers de la bibliothèque (data/livres.json, au format du siddour), chargés au premier besoin. */
let livres = null;
let livresDemandes = false;
let livresEchec = false;
/** Les livres dont le fichier n'est pas venu (02/11) : id → instant de l'échec. Un livre en panne
 * ne bloque plus les autres ; il se redemande de lui-même après 30 s, ou tout de suite par « Réessayer ». */
const livresEchoues = new Map();
const livreEnPanne = (id) => Date.now() - (livresEchoues.get(id) ?? -Infinity) < 30000;
/** Pendant le premier téléchargement des livres (16 Mo), ou après son échec (02/11) : jamais un écran vide. */
function attenteLivres(id = null) {
  if (livresEchec || (id && livreEnPanne(id))) {
    return h('div', { class: 'carte attente-livres' }, h('p', {}, tr.t('livres_echec_web')),
      h('button', { type: 'button', class: 'secondaire', onclick: () => { livresEchec = false; livresEchoues.clear(); chargeLivres(); rendre(); } }, tr.t('livres_reessayer_web')));
  }
  return h('div', { class: 'carte attente-livres', role: 'status' }, h('span', { class: 'attente-rond', 'aria-hidden': 'true' }), h('p', {}, tr.t('livres_chargement_web')));
}
function chargeLivres() {
  if (livres) return true;
  // Après un échec, on attend « Réessayer » : relancer à chaque affichage bouclerait.
  if (livresDemandes || livresEchec) return false;
  livresDemandes = true;
  // La table seule (02/11) : titres, groupes, nombre de chapitres. Chaque livre a son fichier.
  fetch('data/livres/table.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { livres = d; rendre(); })
    .catch(() => { livresDemandes = false; livresEchec = true; rendre(); });
  return false;
}
/** Un livre, son texte chargé au premier besoin dans son entrée de la table (02/11). */
const livresEnCours = new Set();
function chargeLivre(id, { silencieux = false, apres = null } = {}) {
  if (!chargeLivres()) return false;
  const t = livres.textes.find((x) => x.id === id);
  if (!t) return true;
  if (t.sections) return true;
  if (livresEnCours.has(id) || livreEnPanne(id)) return false;
  livresEnCours.add(id);
  fetch(`data/livres/${id}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { t.sections = d.sections; livresEchoues.delete(id); livresEnCours.delete(id); if (!silencieux) rendre(); })
    .catch(() => { livresEnCours.delete(id); livresEchoues.set(id, Date.now()); if (!silencieux) rendre(); })
    .finally(() => apres?.());
  return false;
}
/**
 * Tous les livres, pour la recherche (02/11) : un fichier après l'autre, sans redessiner à chaque
 * arrivée (le champ perdait le doigt et les résultats bougeaient), puis un seul nouvel affichage.
 * Ceux que la recherche a fait venir sont rendus à la mémoire quand on la quitte (16 Mo en tout).
 */
const livresDeRecherche = new Set();
let rechercheLivresEnCours = false;
function chargeTousLesLivres() {
  if (!chargeLivres()) return false;
  const manquants = livres.textes.filter((t) => !t.sections && !livreEnPanne(t.id));
  if (!manquants.length) return true;
  if (rechercheLivresEnCours) return false;
  rechercheLivresEnCours = true;
  const suivant = () => {
    // Quittée en chemin : on s'arrête là, la suite reviendra avec la prochaine recherche.
    const t = ecranCourant() === 'recherche' ? livres.textes.find((x) => !x.sections && !livreEnPanne(x.id) && !livresEnCours.has(x.id)) : null;
    if (!t) { rechercheLivresEnCours = false; if (ecranCourant() === 'recherche') rendre(); return; }
    livresDeRecherche.add(t.id);
    chargeLivre(t.id, { silencieux: true, apres: suivant });
  };
  suivant();
  return false;
}
function rendreLivresDeRecherche() {
  const ouvert = priere?.startsWith('livre:') ? priere.slice(6) : null;
  for (const id of livresDeRecherche) {
    if (id === ouvert || id === 'meguilat_esther') continue;
    const t = livres?.textes.find((x) => x.id === id);
    if (t) delete t.sections;
    livresDeRecherche.delete(id);
  }
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
// Les anciennes adresses du Tikoun découpé (02/11), qui mènent au texte entier (04/11).
ECRANS_LUS.push('tikkun-trait', 'tikkun-psaume', 'tikkun-partie');

/** Les chaînes nouvelles, tant qu'Android ne les a pas encore : le français. */
const CHAINES_LECTURE = {
  lecture_reglages: 'Réglages de lecture',
  lecture_nuit: 'Lecture sur fond noir',
  lecture_plus: 'Lettres plus grandes',
  lecture_moins: 'Lettres plus petites',
  lecture_masquer: 'Masquer le bouton',
  lecture_masque_info: 'Bouton masqué. Touchez le texte pour le faire revenir.',
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

/**
 * Deux touchers sur le texte (28/10, « faire réapparaître le bandeau en appuyant 2 fois ») :
 * masqué, le bouton revient ; l'appui long reste aux marque-pages. Un seul toucher, bouton
 * visible, appelle [simple] (la pastille effacée par le défilement revient).
 */
function doubleToucherPourRamener(zone, simple = null) {
  let dernier = null;
  zone.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.target.closest('button, a, input, select')) return;
    const double = dernier && e.timeStamp - dernier.t < 350 && Math.hypot(e.clientX - dernier.x, e.clientY - dernier.y) < 40;
    dernier = double ? null : { t: e.timeStamp, x: e.clientX, y: e.clientY };
    if (store.lectureMasquee()) { if (double) ramenerLecture(); return; }
    simple?.();
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
      // « אA » : les langues du texte (04/11) — hébreu, français, anglais, ou deux à la fois.
      bouton({ class: 'lecture-langues', lang: 'en', dir: 'ltr', 'aria-label': tl('lecture_langues'), title: tr.t(`langues_${languesLecture().replace('+', '_')}`), onclick: choisirLangues }, 'אA'),
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
 * Un écran de lecture de texte saint : le texte à la taille choisie, de
 * nuit si demandé, et le bouton de lecture au-dessus du pied d'écran.
 */
function ecranLu(titre, contenu, { avecNusah = false, pied = null, bande = null, entete = null } = {}) {
  const defile = h('div', { class: 'defile' }, contenu);
  const ctrl = reglagesLecture({ avecNusah });
  // Le niveau de lecture (IndicateurDefilement.kt, 28/10) : un trait fin au bord droit, montré pendant le défilement.
  const curseur = h('div', { class: 'niveau-curseur' });
  const niveau = h('div', { class: 'niveau', 'aria-hidden': 'true' }, curseur);
  let estompe = null;
  const reveiller = () => {
    const total = defile.scrollHeight;
    const vu = defile.clientHeight;
    if (total <= vu + 1) return;
    const part = Math.min(1, Math.max(0, defile.scrollTop / (total - vu)));
    const longueur = Math.max(8, (vu / total) * 100);
    curseur.style.height = `${longueur}%`;
    curseur.style.top = `${part * (100 - longueur)}%`;
    niveau.classList.add('visible');
    clearTimeout(estompe);
    estompe = setTimeout(() => niveau.classList.remove('visible'), 1500);
  };
  defile.addEventListener('scroll', reveiller, { passive: true });
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
  doubleToucherPourRamener(defile, () => ctrl?.querySelector('.lecture-pastille')?.classList.remove('cachee'));
  return h('div', { class: `ecran lu${store.lectureSombre() ? ' nuit' : ''}`, style: `--echelle: ${store.lectureEchelle()}` },
    entete ?? barre(titre),
    bande,
    h('div', { class: `lu-zone${pied ? '' : ' sans-pied'}` }, defile, niveau, ctrl),
    pied);
}

/**
 * Le balisage du siddour, en nœuds : seuls <b>, <small> et <br> existent dans
 * siddur.json (tools/siddur_construction.py) ; tout le reste reste du texte.
 */
function riche(html) {
  const racine = document.createDocumentFragment();
  const pile = [racine];
  for (const morceau of html.split(/(<\/?b>|<\/?small>|<br><br>|<br>)/)) {
    if (!morceau) continue;
    const ouvre = morceau.match(/^<(b|small)>$/);
    if (ouvre) { const el = document.createElement(ouvre[1]); pile.at(-1).append(el); pile.push(el); }
    else if (/^<\/(b|small)>$/.test(morceau)) { if (pile.length > 1) pile.pop(); }
    // Une ligne vide dans un paragraphe (aération, 28/10) : un saut plus court qu'entre deux paragraphes.
    else if (morceau === '<br><br>') pile.at(-1).append(h('span', { class: 'saut', 'aria-hidden': 'true' }));
    else if (morceau === '<br>') pile.at(-1).append(document.createElement('br'));
    else pile.at(-1).append(document.createTextNode(meteg(morceau)));
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
        onclick: () => { fermer(); if (!courant) { store.setLecturePolice(cle); policeAffichee = null; appliquerPolice(); rendreEtViser('.lecture-police'); } },
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
  const isoHeure = jourLieu(heure);
  const hallelHanouka = pret && moment === 'chaharit' && jourJuif(isoHeure, store.inIsrael()).fetes.includes('hanouka')
    ? siddur.textes.find((x) => x.id === 'hallel') : null;
  // Birkat haIlanot (14/10), le mois où on la dit (SiddurMoment.ilanot).
  const ilanot = pret && ilanotDuMois(isoHeure) ? siddur.textes.find((x) => x.id === 'birkat_hailanot') : null;
  // Pourim (13/10) : la Méguila sous Arvit (la nuit qui ouvre Pourim) et sous Cha'harit (SiddurMoment.megila).
  // Les livres (7 Mo) ne se chargent que les jours de Méguila.
  const esther = megilaDuMoment(moment, isoHeure) && chargeLivre('meguilat_esther') ? livres.textes.find((x) => x.id === 'meguilat_esther') : null;
  const puce = h('button', {
    type: 'button', class: 'puce-bandeau', 'aria-haspopup': 'dialog', 'aria-label': `${tr.t('siddur_choose')} : ${nomNusah}`, onclick: choisirNusah,
  }, h('span', {}, nomNusah), icone('replier'));
  return h('div', { class: 'ecran avec-bandeau' }, bandeau(tr.t('siddur_title'), { puce, dessin: 'char_praying' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu liste-siddour' },
      // Les marque-pages du siddour (28/10), en tête : la même feuille, sans les livres.
      ...(pret ? [ligneSignets('s')].filter(Boolean).map((l) => h('div', { class: 'carte' }, l)) : []),
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
  const pret = livre ? chargeLivre(priere.slice(6)) : chargeSiddur();
  if (!pret) return h('div', { class: 'ecran', 'data-attente': '' }, barre(tr.t(livre ? 'livres_title' : 'siddur_title')), h('div', { class: 'defile' }, livre ? h('div', { class: 'contenu' }, attenteLivres(priere.slice(6))) : null));
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
  // Après la sortie des étoiles du lieu, les autres textes relèvent aussi de demain (28/10).
  const lieuSortie = store.lieu();
  const isoMaintenant = jourLieu(maintenant);
  const tset = lieuSortie ? zmanimDuJour(lieuSortie, isoMaintenant).find((z) => z.cle === 'tset')?.instant : null;
  const jourDuTexte = jourJuif(jourDeLaPriere(x.id, isoMaintenant, heureLieu(maintenant).heures, !!tset && maintenant >= tset), store.inIsrael(), mukafChoma());
  const nusah = store.siddurNusah();
  const c = conditionsPour(nusah, store.inIsrael(), jourDuTexte.conditions, store.sansTahanounFinTichri(), hemisphereSud());
  const nom = (a, condition) => tr.t(libelleJour(a.libelle, condition, nusah, c));
  // Marque-pages (15/10, SiddurLectureActivity) : un appui long sur un paragraphe le marque ou le démarque.
  const cleMarque = `${livre ? 'l' : 's'}:${x.id}`;
  const nusahMarque = livre ? '' : store.siddurNusah();
  // Lus une fois pour tout le texte (02/11) : un livre a des milliers de paragraphes.
  const marquesDuTexte = new Set(store.marques().filter((m) => m.cle === cleMarque && m.nusah === nusahMarque).map((m) => `${m.section}:${m.bloc}`));
  const marquee = (si, i) => marquesDuTexte.has(`${si}:${i}`);
  const rangSection = new Map(x.sections.map((s, k) => [s, k]));
  const paragraphe = (s, i, texte) => {
    const b = s.blocs[i];
    const si = rangSection.get(s);
    const p = h('p', { class: `${b.c !== undefined ? 'consigne' : 'priere'}${marquee(si, i) ? ' marque-page' : ''}${livre ? ' marque-etude' : ''}`, lang: 'he', dir: 'rtl', 'data-place': `${si}:${i}` }, riche(b.c !== undefined ? (texte ?? b.c) : aerer(texte ?? b.t)));
    if (p.firstChild?.nodeName === 'B') p.firstChild.classList.add('premier-mot');
    // Un verset traduit (Esther, Chir HaChirim, 04/11) : la traduction sous l'hébreu, ou seule.
    if (b.c === undefined && (b.fr || b.en)) {
      const textes = LanguesTexte.textes(languesLecture(), b.t, b.fr, b.en);
      const avecHe = textes.some(([l]) => l === 'he');
      const traductions = textes.filter(([l]) => l !== 'he').map(([l, t]) => paraTraduction(l, t, !avecHe));
      if (traductions.length) {
        if (!avecHe) p.replaceChildren();
        p.append(...traductions);
        if (!avecHe) { p.setAttribute('dir', 'ltr'); p.removeAttribute('lang'); }
      }
    }
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
  // Une variante enchâssée hors du jour (המלך הקדוש, מוריד הטל…) : retirée du paragraphe,
  // repliée dessous (28/10, SiddurJour.lignes). Celle du jour se lit dans le texte même.
  const avecIndices = (s, si, i) => {
    const tous = idx.indices.get(`${si}:${i}`) ?? [];
    const hors = tous.filter((a) => a.retire && !ajoutVrai(a.si, c));
    const brut = s.blocs[i].t ?? s.blocs[i].c;
    const reduit = hors.reduce((t, a) => t.replace(a.retire, ''), brut).trim();
    const du = tous.filter((a) => !a.retire && ajoutVrai(a.si, c));
    const pli = hors.length && reduit !== brut
      ? ajout(nom(hors[0], hors[0].si), false, hors.map((a) => h('p', { class: 'priere hors-jour', lang: 'he', dir: 'rtl' }, a.texte)), hors[0].si) : null;
    return [paragraphe(s, i, reduit !== brut ? reduit : undefined), pli, ...du.map((a) => h('p', { class: 'indice-jour' },
      h('span', {}, `${tr.t('siddur_aujourdhui')} : `), h('span', { lang: 'he', dir: 'rtl' }, a.texte))), ...renvois(si, i)];
  };
  // Le corps d'une section, sans son titre : construit d'un coup pour une prière, à la demande pour un livre.
  const corpsDe = (s, si) => {
      const section = idx.sections.get(si);
      if (section) return [ajout(nom(section, section.si), ajoutVrai(section.si, c), s.blocs.map((_, i) => paragraphe(s, i)), section.si), ...renvois(si)];
      const corps = [];
      for (let i = 0; i < s.blocs.length; i++) {
        const a = idx.blocs.get(`${si}:${i}`);
        if (!a) { corps.push(...avecIndices(s, si, i).filter(Boolean), ...seuls(si, i)); continue; }
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
    return [...corps, ...renvois(si)];
  };
  // Un livre sans traduction, quand on en a demandé une (04/11) : on le dit, l'hébreu reste.
  const sansTraduction = livre && LanguesTexte.manque(languesLecture(), x.sections.some((s) => s.blocs.some((b) => b.fr || b.en)));
  // Une longue prière (Cha'harit, 04/11) se construit comme un livre, section par section à
  // l'approche de l'écran : construite et mise en page d'un coup, son ouverture gelait l'écran
  // (0,5 s mesurée sur un téléphone moyen, Chromium ralenti 4 fois : 0,4 s de construction et
  // 0,4 s de mise en page forcée par la bande des signets). Une courte reste d'un seul tenant.
  const parSections = livre || (x.sections.length > 3 &&
    x.sections.reduce((t, s) => t + hauteurEstimee(s), 0) > 6 * Math.max(600, window.innerHeight));
  const contenu = h('div', { class: 'contenu lecture siddour' },
    sansTraduction ? h('p', { class: 'indice' }, tl('lecture_sans_traduction')) : null,
    annotations ? h('p', { class: 'indice note-ajouts' }, tr.t('siddur_jour_ajouts', jourDuTexte.dateHebraique,
      tr.t(store.inIsrael() ? 'region_israel' : 'region_diaspora'))) : null,
    ...x.sections.flatMap((s, si) => {
      // Le titre traduit (04/11), sous l'hébreu ou à sa place.
      const titres = s.titre ? LanguesTexte.textes(languesLecture(), s.titre, s.titre_fr, s.titre_en) : [];
      const t = plusieurs && s.titre ? h('h2', { class: 'psaume-titre', lang: titres[0][0], dir: titres[0][0] === 'he' ? 'rtl' : 'ltr' }, titres[0][1],
        ...titres.slice(1).map(([l, x]) => h('span', { class: 'titre-traduit', lang: l, dir: 'ltr' }, x))) : null;
      if (t) titres.push({ titre: s.titre, el: t });
      if (!parSections) return [t, ...corpsDe(s, si)];
      // Un livre (02/11) : chaque chapitre dans sa propre boîte, vide tant qu'il n'approche pas de
      // l'écran, à la hauteur estimée. Le livre entier construit et mis en page d'un coup faisait
      // tomber Safari sur iPhone (« Un problème récurrent est survenu »), là où Android ne
      // dessine que les lignes visibles (RecyclerView). Sans content-visibility (03/11) : WebKit
      // mettait en page ces chapitres de lui-même, en retard, et le texte sautait pendant l'élan.
      const haut = hauteurEstimee(s);
      const boite = h('section', { class: 'livre-chapitre', 'data-section': si, 'data-base': Math.round(haut / calibrage / 1.1), style: `min-height: ${haut}px` }, t);
      chapitresARemplir.set(boite, () => {
        if (!chapitresARemplir.has(boite)) return;
        chapitresARemplir.delete(boite);
        boite.append(...corpsDe(s, si).filter(Boolean));
        boite.style.minHeight = '';
      });
      return [boite];
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
  if (parSections) { const d = ecran.querySelector('.defile'); if (d) { d.classList.add('defile-livre'); remplirAuDefilement(d); ancrerChapitres(d); } }
  if (marqueAOuvrir?.cle === cleMarque) { const m = { ...marqueAOuvrir, priere }; marqueAOuvrir = null; requestAnimationFrame(() => {
    // Redessiné entre-temps (un livre arrivé, « Aa ») : on vise l'écran qui l'a remplacé, s'il est encore ce texte.
    const e = ecran.isConnected ? ecran : (app.dataset.ecran?.startsWith('priere/') && priere === m.priere) ? app.querySelector('.ecran') : null;
    if (e) allerAMarque(e, m);
  }); return ecran; }
  const defile = ecran.querySelector('.defile');
  if (defile) {
    const place = store.positionLecture(cle);
    // Un livre reprend au paragraphe (02/11) : ses chapitres hors écran n'ont qu'une hauteur
    // estimée, un nombre de pixels n'y retomberait pas juste.
    const ancre = parSections && place > 0 ? store.ancreLecture(cle) : null;
    if (place > 0 && !rendreSurPlace) {
      requestAnimationFrame(() => {
        const [section, bloc] = (ancre ?? '').split(':').map(Number);
        if (ancre && ecran.querySelector(`.livre-chapitre[data-section="${section}"]`)) allerAMarque(ecran, { section, bloc }, 0);
        else defile.scrollTop = place;
      });
    }
    let minuteur = null;
    // Le premier paragraphe visible ; un titre ou une marge en haut : on descend un peu.
    const premierVu = () => {
      const r = defile.getBoundingClientRect();
      for (let y = r.top + 24; y < Math.min(r.bottom, r.top + 400); y += 24) {
        const el = document.elementFromPoint(r.left + r.width / 2, y)?.closest('[data-place]');
        if (el) return el.dataset.place;
      }
      return null;
    };
    defile.addEventListener('scroll', () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => {
        store.setPositionLecture(cle, Math.round(defile.scrollTop));
        if (parSections) store.setAncreLecture(cle, premierVu());
      }, 400);
    }, { passive: true });
  }
  return ecran;
}

// --- La recherche dans toute l'application (RechercheActivity.kt, 14/10) ------------------
let texteRecherche = '';
/** Où chercher (19/10) : tout, les prières, les halakhot, les livres ou les hilloulot (RechercheGlobale.Portee). */
let porteeRecherche = 'tout';
// Sans accents latins ni apostrophe typographique : « priere » trouve « Prières » (29/10).
const nuRecherche = (t) => t.normalize('NFD').replace(/[\u0300-\u036F’‘]/g, '').replace(/<[^>]+>/g, ' ').replace(/[־׀]/g, ' ').replace(/[\u0591-\u05C7"'״׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
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
    for (const s of t.sections ?? []) {
      const b = s.blocs.find((x) => x.t && nuRecherche(x.t).includes(q));
      if (b) { r.push({ t, extrait: extraitRecherche(b.t, q), livre }); break; }
    }
  }
  return r;
}
function ecranRecherche() {
  // Les livres ne se chargent plus à l'entrée (02/11) : seulement quand on cherche dedans.
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
    // Chaque livre arrivé relance l'affichage : les résultats se complètent au fil des fichiers.
    const liv = (p === 'tout' || p === 'sefarim') && livres ? (chargeTousLesLivres(), dansRecueil(livres, q, true)) : [];
    const halakhot = p === 'tout' || p === 'halakhot';
    const yy = halakhot && livreYalkut ? rechercheYalkut(livreYalkut, texteRecherche).slice(0, 30) : [];
    const bih = halakhot && livreHalakha ? rechercheHalakha(livreHalakha, texteRecherche).slice(0, 30) : [];
    const hil = (p === 'tout' || p === 'hilloulot') && tableHilloulot() ? rechercheHilloula(tableHilloulot(), texteRecherche).slice(0, 30) : [];
    yalkutDuJour(); livreDuJour();
    const total = sid.length + liv.length + yy.length + bih.length + hil.length;
    groupes.push(h('p', { class: 'jour-sous-titre' }, tr.t('hilloulot_resultats', total)));
    const groupe = (nom, l) => (l.length ? [h('h2', { class: 'section' }, tr.t(nom)), ...l] : []);
    // Les titres des groupes reprennent les noms des filtres (audit 1.390).
    groupes.push(...groupe('recherche_tefilot', sid.map((r) => resultat(r.t.titre.he, r.extrait, () => { priere = r.t.id; ouvrir('priere'); }))));
    groupes.push(...groupe('recherche_livres', liv.map((r) => resultat(r.t.titre.he, r.extrait, () => { priere = `livre:${r.t.id}`; ouvrir('priere'); }))));
    groupes.push(...groupe('recherche_halakhot', [...yy.map((x) => resultat(sourceYalkut(x), extraitRecherche(x.t, q), () => { rechercheHalakhaTexte = texteRecherche; ouvrir('halakha'); })),
      ...bih.map((x) => resultat(sourceHalakha(x, (n) => Reference.lettres(n)), extraitRecherche(x.texte, q), () => { rechercheHalakhaTexte = texteRecherche; ouvrir('halakha'); }))]));
    // Le nom dans la langue de l'interface s'il existe, sinon l'hébreu (RechercheGlobale.resultatHilloula).
    const nomHilloula = nomTraduitHilloula;
    groupes.push(...groupe('hilloulot_title', hil.map(([, x]) => resultat(nomHilloula(x) ?? x.he,
      [nomHilloula(x) ? `\u2068${x.he}\u2069` : null, x.a || null].filter(Boolean).join(' · '),
      () => { rechercheHilloulot = texteRecherche; ouvrir('hilloulot'); }))));
  }
  return h('div', { class: 'ecran' }, barre(tr.t('recherche_titre')),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' }, h('div', { class: 'carte' }, champ,
      h('div', { class: 'puces-recherche', role: 'radiogroup', 'aria-label': tr.t('recherche_titre') },
        [['tout', 'recherche_tout'], ['tefilot', 'recherche_tefilot'], ['halakhot', 'recherche_halakhot'], ['sefarim', 'recherche_sefarim'], ['hilloulot', 'hilloulot_title']]
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
const apercuMarque = (t, mots = 6) => t.replace(/<[^>]+>/g, ' ').replace(/[־׀]/g, ' ').replace(/[\u0591-\u05C7]/g, '').trim().split(/\s+/).slice(0, mots).join(' ');
/** Le marque-page à rejoindre à l'ouverture du texte (depuis la Bibliothèque). */
let marqueAOuvrir = null;
/** Va au paragraphe marqué ; replié aujourd'hui, à sa section (le premier paragraphe qui suit). */
/** Les chapitres de livre pas encore construits, et de quoi les construire (02/11). */
const chapitresARemplir = new WeakMap();
const remplirChapitre = (boite) => chapitresARemplir.get(boite)?.();

/**
 * Remplit les chapitres d'un livre à l'approche de l'écran (02/11) : 1,5 écran d'avance dans
 * chaque sens, et les deux premiers d'emblée pour que l'ouverture ne montre pas de vide.
 */
function remplirAuDefilement(defile) {
  const boites = [...defile.querySelectorAll('.livre-chapitre')];
  boites.slice(0, 2).forEach(remplirChapitre);
  if (!('IntersectionObserver' in window)) { boites.forEach(remplirChapitre); return; }
  const io = new IntersectionObserver((entrees) => {
    if (!defile.isConnected) { io.disconnect(); return; }
    for (const e of entrees) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const ancre = remplissages.get(defile);
      if (ancre) ancre(e.target, () => remplirChapitre(e.target)); else remplirChapitre(e.target);
    }
  }, { root: defile, rootMargin: '150% 0px' });
  for (const b of boites) if (chapitresARemplir.has(b)) io.observe(b);
}

function allerAMarque(ecran, m, marge = 8) {
  const defile = ecran.querySelector('.defile');
  // Dans un livre, le chapitre visé n'est peut-être pas encore construit.
  const boite = ecran.querySelector(`.livre-chapitre[data-section="${m.section}"]`);
  if (boite) remplirChapitre(boite);
  const cible = ecran.querySelector(`[data-place="${m.section}:${m.bloc}"]`);
  // offsetParent est nul dans un pli fermé (display: none), pas dans un chapitre de livre
  // simplement pas encore mis en page.
  const visible = cible && cible.offsetParent !== null ? cible
    : [...ecran.querySelectorAll('[data-place]')].find((p) => p.offsetParent !== null && Number(p.dataset.place.split(':')[0]) >= m.section);
  if (!visible || !defile) return;
  viserJusquaStable(defile, () => defile.scrollTop + visible.getBoundingClientRect().top - defile.getBoundingClientRect().top - marge);
}

/**
 * Défile jusqu'à [cible()], puis recommence image après image tant qu'elle bouge (02/11) :
 * les chapitres de livre mis en page en arrivant remplacent leur hauteur estimée par la vraie.
 */
const visees = new WeakMap();
function viserJusquaStable(defile, cible) {
  // Un doigt qui reprend la main arrête la visée : on ne lutte pas contre lui.
  const jeton = {};
  visees.set(defile, jeton);
  if (!defile.dataset.vise) {
    defile.dataset.vise = '1';
    for (const geste of ['touchstart', 'wheel', 'keydown']) defile.addEventListener(geste, () => visees.delete(defile), { passive: true });
  }
  // La mise en page d'un chapitre arrivé à l'écran se fait après les rappels de l'image :
  // on attend quelques images immobiles avant de s'arrêter.
  const pas = (reste, stables) => {
    if (visees.get(defile) !== jeton) return;
    const y = Math.round(cible());
    const immobile = Math.abs(defile.scrollTop - y) < 1;
    if (!immobile) defile.scrollTop = y;
    const suite = immobile ? stables + 1 : 0;
    if (reste > 0 && suite < 6) requestAnimationFrame(() => pas(reste - 1, suite));
  };
  pas(40, 0);
}

/**
 * L'ancrage du défilement (02/11) : un chapitre de livre commencé au-dessus de l'écran, mis en
 * page en y revenant, prend sa vraie hauteur à la place de l'estimée. Sans compensation, le
 * texte lu sauterait ; Safari ne la fait pas de lui-même (overflow-anchor), on la fait ici.
 *
 * Pendant un geste (doigt posé, ou élan qui continue), écrire scrollTop arrête net l'élan sur
 * iPhone. Un chapitre qui raccourcit garde donc sa hauteur par une marge en tête (son texte
 * reste collé au suivant, rien ne bouge) ; la marge s'en va au repos, compensée alors. Seul
 * un chapitre qui grandit au-delà de sa marge oblige encore à écrire scrollTop : l'estimation
 * est prise un peu large pour que ce soit rare.
 */
function ancrerChapitres(defile) {
  if (!('ResizeObserver' in window)) return;
  const hauteurs = new WeakMap();
  const marges = new Set();
  let doigt = false;
  let dernierDefilement = 0;
  let minuteur = null;
  const enGeste = () => doigt || performance.now() - dernierDefilement < 200;
  const marge = (c) => parseFloat(c.style.paddingTop) || 0;
  // Au repos : chaque marge hors de la vue disparaît (au-dessus, l'observateur compense ;
  // en dessous, rien de visible ne bouge). Une marge sous les yeux attend qu'on s'en éloigne.
  const auRepos = () => {
    if (!defile.isConnected) { marges.clear(); return; }
    if (enGeste()) { attendre(); return; }
    const r = defile.getBoundingClientRect();
    let delta = 0;
    for (const c of [...marges]) {
      const b = c.getBoundingClientRect();
      if (b.top >= r.top && b.top <= r.bottom) continue;
      // Compensée ici : l'observateur ne regarde que le contenu, pas la marge.
      if (b.top < r.top) delta -= marge(c);
      c.style.paddingTop = '';
      marges.delete(c);
    }
    if (delta) defile.scrollTop += delta;
  };
  const attendre = () => { clearTimeout(minuteur); if (marges.size) minuteur = setTimeout(auRepos, 250); };
  defile.addEventListener('touchstart', () => { doigt = true; }, { passive: true });
  for (const fin of ['touchend', 'touchcancel']) defile.addEventListener(fin, () => { doigt = false; dernierDefilement = performance.now(); attendre(); }, { passive: true });
  defile.addEventListener('scroll', () => { dernierDefilement = performance.now(); attendre(); }, { passive: true });
  /** Ce qu'un chapitre a changé de hauteur de contenu, rattrapé ; rend ce qu'il reste à défiler. */
  const ajuster = (c, hauteur, haut, geste) => {
    const avant = hauteurs.get(c);
    hauteurs.set(c, hauteur);
    // Commencé au-dessus de l'écran : tout ce qui suit, dont le texte lu, en serait déplacé.
    if (avant === undefined || c.getBoundingClientRect().top >= haut) return 0;
    let d = hauteur - avant;
    if (geste && d < 0) {
      c.style.paddingTop = `${marge(c) - d}px`;
      marges.add(c);
      d = 0;
    } else if (geste && d > 0 && marge(c) > 0) {
      const pris = Math.min(marge(c), d);
      c.style.paddingTop = marge(c) - pris > 0.5 ? `${marge(c) - pris}px` : '';
      if (!c.style.paddingTop) marges.delete(c);
      d -= pris;
    }
    return d;
  };
  const ro = new ResizeObserver((entrees) => {
    if (!defile.isConnected) { ro.disconnect(); return; }
    const haut = defile.getBoundingClientRect().top;
    const geste = enGeste();
    let delta = 0;
    // La hauteur du contenu seul (contentRect, connu de tous les Safari qui ont l'observateur) :
    // la marge mise ou retirée ici ne relance pas l'observateur (« ResizeObserver loop » dans WebKit).
    for (const e of entrees) delta += ajuster(e.target, e.contentRect.height, haut, geste);
    if (Math.abs(delta) >= 0.5) defile.scrollTop += delta;
    attendre();
  });
  for (const c of defile.querySelectorAll('.livre-chapitre')) ro.observe(c);
  // Un chapitre rempli au défilement est rattrapé sur-le-champ, avant d'être dessiné : WebKit
  // dessine le nouveau texte une image avant de prévenir l'observateur, et le texte lu sautait
  // le temps de cette image (mesuré dans WebKit le 03/11).
  remplissages.set(defile, (c, remplir) => {
    const contenu = () => c.getBoundingClientRect().height - marge(c);
    if (!hauteurs.has(c)) hauteurs.set(c, contenu());
    remplir();
    const vraie = contenu();
    apprendreHauteur(Number(c.dataset.base), vraie);
    const d = ajuster(c, vraie, defile.getBoundingClientRect().top, enGeste());
    if (Math.abs(d) >= 0.5) defile.scrollTop += d;
    attendre();
  });
}
/** Par zone de lecture : le remplissage d'un chapitre avec son ancrage immédiat (ancrerChapitres). */
const remplissages = new WeakMap();

/**
 * La hauteur probable d'un chapitre de livre, avant sa mise en page (02/11) : assez juste pour
 * que la barre de défilement et les sauts de chapitre ne trompent pas. Calibré sur Chromium,
 * 390 px de large, Frank Ruhl à 19 px ; l'échelle de lecture s'y applique.
 */
/**
 * Ce que l'appareil fait vraiment de l'estimation (03/11) : les polices de Safari ne sont pas
 * celles de Chromium. Chaque chapitre construit en donne le rapport ; la moyenne, gardée sur
 * l'appareil, corrige les estimations suivantes. Un chapitre plus long que prévu oblige à
 * écrire scrollTop pendant l'élan ; plus court, il ne coûte rien (ancrerChapitres).
 */
const CLE_CALIBRAGE = 'myhitbodedut-calibrage-livres';
let calibrage = (() => { try { const v = Number(localStorage.getItem(CLE_CALIBRAGE)); return v >= 0.6 && v <= 1.8 ? v : 1; } catch { return 1; } })();
let calibrageAEcrire = null;
function apprendreHauteur(brute, vraie) {
  // L'estimation brute du chapitre (sans calibrage), prise à sa création.
  if (!(brute > 200) || !(vraie > 0)) return;
  const rapport = Math.min(1.8, Math.max(0.6, vraie / brute));
  calibrage = Math.min(1.8, Math.max(0.6, calibrage * 0.8 + rapport * 0.2));
  clearTimeout(calibrageAEcrire);
  calibrageAEcrire = setTimeout(() => { try { localStorage.setItem(CLE_CALIBRAGE, calibrage.toFixed(3)); } catch { /* stockage refusé */ } }, 2000);
}
function hauteurEstimee(section) {
  const echelle = Number(store.lectureEchelle()) || 1;
  const largeur = Math.max(240, Math.min(window.innerWidth, 600) - 40);
  const parLigne = Math.max(12, largeur / (8.6 * echelle));
  const ligne = 19 * echelle * 1.75;
  let h = 60 * echelle;
  for (const b of section.blocs) {
    const lettres = (b.t ?? b.c ?? '').replace(/<[^>]+>/g, '').replace(/[\u0591-\u05C7]/g, '').length;
    h += Math.ceil(lettres / parLigne) * (b.c !== undefined ? ligne * 0.65 : ligne) + 30 * echelle;
  }
  // Un peu large (02/11) : un chapitre qui raccourcit en arrivant ne force pas l'élan (ancrerChapitres).
  return Math.round(h * calibrage * 1.1);
}

/** Le nom d'une hilloula dans la langue de l'interface, FR → EN (audit 1.390) ; null en hébreu ou sans traduction. */
const nomTraduitHilloula = (x) => (tr.langue === 'fr' ? x.fr || x.en : tr.langue === 'en' ? x.en : null) || null;

/** Le titre hébreu d'une clé « s:id » ou « l:id », ou null tant que son recueil n'est pas chargé. */
function titreCle(cle) {
  if (cle === CLE_TEHILIM) return tr.t('tehilim_title');
  const livre = cle.startsWith('l:');
  if (livre ? !chargeLivres() : !chargeSiddur()) return null;
  return (livre ? livres : siddur).textes.find((t) => t.id === cle.slice(2))?.titre.he ?? null;
}
const ouvrirCle = (cle) => { priere = cle.startsWith('l:') ? `livre:${cle.slice(2)}` : cle.slice(2); ouvrir('priere'); };

/** La ligne « סימניות · n » (28/10) : tous les marque-pages, ou ceux d'un recueil (« s », « l »). */
function ligneSignets(recueil = null) {
  const marques = store.marques().filter((m) => (!recueil || m.cle.startsWith(`${recueil}:`)) && titreCle(m.cle));
  return marques.length ? ligne({ nom: h('span', { class: 'nom-marque' }, iconeMarque(recueil === 'l', 18), tr.t('marques_titre')), etat: String(marques.length),
    onclick: () => listeSignets(marques, titreCle, ouvrirSignet) }) : null;
}

/** Ouvre le texte d'un marque-page, à sa place : un paragraphe du siddour ou d'un livre, ou un verset des Tehilim. */
function ouvrirSignet(m) {
  marqueAOuvrir = m;
  if (m.cle === CLE_TEHILIM) { lire(CycleTehilim.portion(m.section, m.section)); return; }
  ouvrirCle(m.cle);
}

/** « Reprendre la lecture » et les favoris, en tête de la Bibliothèque (RepriseFavoris.kt). */
function repriseFavoris() {
  const titre = titreCle;
  const lignes = [];
  const derniere = store.derniereLecture();
  if (derniere && titre(derniere)) lignes.push(ligne({ nom: tr.t('reprise_titre'), etat: titre(derniere), onclick: () => ouvrirCle(derniere) }));
  for (const cle of store.favoris()) {
    const t = titre(cle);
    if (t) lignes.push(ligne({ nom: `★ ${t}`, onclick: () => ouvrirCle(cle) }));
  }
  // Les marque-pages (15/10) : une seule ligne (28/10), qui ouvre la liste filtrée par recueil et par texte.
  const signets = ligneSignets();
  if (signets) lignes.push(signets);
  return lignes.length ? h('div', { class: 'carte' }, ...lignes) : null;
}

/**
 * Tous les marque-pages (28/10) : d'abord tous, puis filtrés par recueil (סידור, ספרים)
 * ou par texte (שחרית, מנחה…), dans l'ordre du recueil.
 */
function listeSignets(marques, titre, ouvrirMarque) {
  const ordre = (cle) => { if (cle.startsWith('t:')) return 5000; const l = cle.startsWith('l:') ? livres : siddur; return (cle.startsWith('l:') ? 1e4 : 0) + (l?.textes.findIndex((t) => t.id === cle.slice(2)) ?? 0); };
  const textes = [...new Set(marques.map((m) => m.cle))].sort((a, b) => ordre(a) - ordre(b));
  const filtres = [['*', tr.t('recherche_tout')]];
  if (marques.some((m) => m.cle.startsWith('s:'))) filtres.push(['s', tr.t('siddur_title')]);
  if (marques.some((m) => m.cle.startsWith('t:'))) filtres.push(['t', tr.t('tehilim_title')]);
  if (marques.some((m) => m.cle.startsWith('l:'))) filtres.push(['l', tr.t('livres_title')]);
  // Un texte par puce, pour le siddour et les livres ; les Tehilim n'en ont qu'un, déjà nommé.
  const parTexte = textes.filter((c) => !c.startsWith('t:'));
  if (parTexte.length > 1) filtres.push(...parTexte.map((c) => [c, titre(c)]));
  let filtre = '*';
  feuille(tr.t('marques_titre'), (f, fermer) => {
    const puces = h('div', { class: 'puces-recherche puces-signets', role: 'radiogroup', 'aria-label': tr.t('marques_titre') });
    const liste = h('div', { class: 'liste-signets' });
    const remplir = () => {
      puces.replaceChildren(...filtres.map(([cle, nom]) => h('button', { type: 'button', class: 'puce-choix', role: 'radio', lang: cle.includes(':') ? 'he' : null,
        'aria-checked': String(cle === filtre), onclick: () => { filtre = cle; remplir(); } }, nom)));
      const garde = marques.filter((m) => filtre === '*' || (filtre.includes(':') ? m.cle === filtre : m.cle.startsWith(`${filtre}:`)))
        .sort((a, b) => ordre(a.cle) - ordre(b.cle) || a.section - b.section || a.bloc - b.bloc);
      liste.replaceChildren(...garde.map((m) => h('button', { class: 'choix signet-choix', onclick: () => { fermer(); ouvrirMarque(m); } },
        h('span', { class: 'nom-marque' }, iconeMarque(m.cle.startsWith('l:'), 16), titre(m.cle)), h('span', { class: 'apercu', lang: 'he', dir: 'rtl' }, `${m.apercu}…`))));
    };
    remplir();
    f.append(puces, liste);
  });
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
const JAMAIS_DU_JOUR = new Set(['minyan', 'beit_avel', 'oubli', 'cheva_berakhot', 'zimun', 'facultatif']);

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
  // Dans un livre, on mesure la boîte du chapitre, pas son titre : mesurer ce qui est dedans
  // forcerait la mise en page du chapitre entier, et donc du livre à chaque défilement (02/11).
  const position = (el) => (el.closest('.livre-chapitre') ?? el).getBoundingClientRect().top - defile.getBoundingClientRect().top + defile.scrollTop;
  const signets = titres.map(({ titre, el }, i) => h('button', {
    type: 'button', class: 'signet', lang: 'he',
    onclick: () => {
      choisi = i; marque(i);
      viserJusquaStable(defile, () => position(el) - 6);
    },
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

// --- Le Tikoun HaKlali (TikkunFlowActivity.kt) : le texte entier, d'un trait ---------
// « להמשיך מזה לזה ברצף אחד, ללא הפסק » : l'ouverture, les dix psaumes à la suite, la
// clôture ; rien à toucher entre les psaumes. Puis ce qui se dit après sans en faire partie :
// la kavana du milouy et la prière de Rabbi Natan, chacune avec sa note. Le Tikoun découpé
// psaume par psaume (liste, un écran par psaume ou par partie) est retiré (04/11) ; ses
// anciennes adresses (#tikkun-trait, #tikkun-psaume, #tikkun-partie) mènent ici.
const ECRANS_TIKKUN = ['tikkun-trait', 'tikkun-psaume', 'tikkun-partie'];

function ecranTikkun() {
  if (!tikkun) return h('div', { class: 'ecran' }, barre(tr.t('tikkun_title')), h('div', { class: 'defile' }));
  const titre = (texte) => h('h2', { class: 'psaume-titre' }, texte);
  const paragraphe = (texte) => h('p', { class: 'verset paragraphe' }, texte);
  const mode = languesLecture();
  const blocs = [];
  for (const b of Tikkun.avant(tikkun)) blocs.push(titre(b.titre.he), ...paragraphesTraduits(b.paragraphes, b.paragraphes_fr, b.paragraphes_en, paragraphe));
  for (const p of tikkun.psaumes) {
    blocs.push(titre(tr.t('tikkun_psalm_he', Reference.lettres(p.numero))));
    for (const v of p.versets) {
      const c = Tikkun.coupe(v);
      const textes = LanguesTexte.textes(mode, v.he, v.fr, v.en);
      const avecHe = textes.some(([l]) => l === 'he');
      if (avecHe) {
        blocs.push(h('p', { class: 'verset' }, c ? c[0] : v.he));
        if (v.arret) blocs.push(h('p', { class: 'arret' }, v.arret.note));
        if (c) blocs.push(h('p', { class: 'verset suite' }, c[1]));
      }
      textes.filter(([l]) => l !== 'he').forEach(([l, t]) => blocs.push(paraTraduction(l, t, !avecHe)));
    }
  }
  const cloture = Tikkun.bloc(tikkun, Tikkun.CLOTURE);
  if (cloture) blocs.push(titre(cloture.titre.he), ...paragraphesTraduits(cloture.paragraphes, cloture.paragraphes_fr, cloture.paragraphes_en, paragraphe));
  for (const b of [Tikkun.KAVANA, Tikkun.PRIERE].map((c) => Tikkun.bloc(tikkun, c)).filter(Boolean)) {
    const note = Tikkun.sousTitreBloc(b, tr.langue);
    blocs.push(titre(b.titre.he), note ? h('p', { class: 'arret', dir: 'auto' }, note) : null,
      // La formule de la kavana est centrée : c'est un tableau de lettres, pas une phrase.
      b.formule ? h('p', { class: 'verset formule' }, b.formule) : null,
      ...paragraphesTraduits(b.paragraphes, b.paragraphes_fr, b.paragraphes_en, paragraphe));
  }
  const fini = () => {
    // Tout dire d'un trait vaut les dix psaumes.
    for (const p of tikkun.psaumes) store.setTikkunDone(p.numero, true);
    retour();
    feterTikkun();
  };
  // Pas d'image dans une prière (13/10).
  return ecranLu(tr.t('tikkun_title'), h('div', { class: 'contenu lecture tikkun' },
    h('div', { class: 'psaume', lang: 'he', dir: 'rtl' }, blocs)), {
    pied: h('div', { class: 'lecture-nav' }, h('button', { class: 'principal tikkun-fini', onclick: fini }, tr.t('tikkun_flow_done'))),
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
      // Les marque-pages des livres (28/10), en tête : la même feuille, sans le siddour.
      livresPrets ? null : attenteLivres(),
      ...(livresPrets ? [ligneSignets('l')].filter(Boolean).map((l) => h('div', { class: 'carte' }, l)) : []),
      ...(livresPrets ? livres.groupes.flatMap((g) => [
        enteteGroupe(g.titre.he, titreTexte(g.titre)),
        h('div', { class: 'carte carte-sections' }, livres.textes.filter((x) => x.groupe === g.cle).map((x) =>
          ligneHebreu(x.titre.he, [titreTexte(x.titre) !== x.titre.he ? titreTexte(x.titre) : null, tr.p('livre_chapitres', x.chapitres ?? x.sections?.length ?? 0)].filter(Boolean).join(' · '),
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
      paragraphesTraduits(LibraryRules.paragraphes(bibliotheque, e), e.paragraphes_fr, e.paragraphes_en, (p) => h('p', { class: 'verset paragraphe-source' }, p))),
    // Ni note ni édition sous le texte : l'attribution passe par le lien vers Sefaria.
    e.url ? h('a', { class: 'principal lien-sefaria', href: e.url, target: '_blank', rel: 'noopener noreferrer' }, tr.t('library_open_sefaria')) : null));
}

// --- Conseils, Tefilot, Journal (02/11) : les écrans d'Android qui manquaient au site ----------

/** Les dix repères (Tips.kt, TipsActivity) : un numéro, un titre, un texte, une illustration. */
const CONSEILS = ['char_walking', 'char_thinking', 'char_open_arms', 'char_standing_back', 'char_tehilim',
  'char_writing', 'char_praise', 'char_praying', 'char_standing_back', 'char_open_arms'];
function ecranConseils() {
  return h('div', { class: 'ecran avec-bandeau' },
    bandeau(tr.t('tips_title'), { puce: h('p', { class: 'bandeau-sous-titre' }, tr.t('tips_hint')), dessin: 'char_walking' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu conseils' },
      CONSEILS.map((dessin, k) => h('article', { class: 'carte conseil' },
        h('div', { class: 'conseil-tete' },
          h('span', { class: 'conseil-numero', 'aria-hidden': 'true' }, String(k + 1)),
          h('h2', { class: 'conseil-titre' }, tr.t(`tip_${k + 1}_title`))),
        plateau(dessin, 'conseil-dessin'),
        h('p', { class: 'conseil-texte' }, tr.t(`tip_${k + 1}_body`)))))));
}

/**
 * Tefilot (TefilotActivity, Tefilot.kt) : les dix sujets dans l'ordre demandé, et sous chacun
 * ses prières de Likoutei Tefilot, lues dans la sous-section « tefilot-lt » de la bibliothèque.
 * Un sujet sans prière n'a pas de ligne ; une leçon qui parle d'autre chose est signalée.
 */
const SUJETS_TEFILA = ['hitbodedut', 'simcha', 'uman', 'kdusha', 'zera', 'parnassa', 'brit', 'geula', 'zivug', 'refua'];
function ecranTefilot() {
  const pret = chargeBibliotheque();
  const prieres = pret ? (bibliotheque.sections ?? []).flatMap((sec) => sec.sous_sections ?? [])
    .find((ss) => ss.id === 'tefilot-lt')?.entrees.filter((e) => e.type === 'source') ?? [] : [];
  return h('div', { class: 'ecran avec-bandeau' },
    bandeau(tr.t('tefilot_title'), { puce: h('p', { class: 'bandeau-sous-titre' }, tr.t('tefilot_hint')), dessin: 'char_praying' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu liste-siddour' },
      SUJETS_TEFILA.flatMap((sujet) => {
        const l = prieres.filter((e) => e.sujet === sujet);
        if (!l.length) return [];
        return [
          enteteGroupe(tr.t(`tefila_${sujet}`), tr.t('tefilot_count', l.length)),
          h('div', { class: 'carte carte-sections' }, l.map((e) => ligneHebreu(e.titre_he,
            [Reference.localise(e.ref, tr.langue), e.lecon_sur_le_sujet === 'non' ? tr.t('tefilot_warning') : null].filter(Boolean).join(' · '),
            () => { entreeBiblio = e.id; ouvrir('source'); }))),
        ];
      }))));
}

/** Les minutes du mois en barres (JournalPlus.Graphique), pour le journal et « Mon parcours » (02/11). */
function graphiqueDuMois() {
  const auj = new Date();
  const minutes = JournalPlus.minutesDuMois(store.minutesParJour(), auj.getFullYear(), auj.getMonth() + 1);
  const plus = Math.max(1, ...minutes);
  const nomMois = new Intl.DateTimeFormat(tr.langue, { month: 'long', year: 'numeric' }).format(auj);
  const graphique = h('div', { class: 'journal-graphique', role: 'img', 'aria-label': tr.t('journal_graphique', nomMois) },
    minutes.map((m, k) => h('span', {
      class: `journal-barre${k + 1 === auj.getDate() ? ' aujourdhui' : ''}${m > 0 ? ' faite' : ''}`,
      style: `height: ${m > 0 ? Math.max(8, Math.round((m / plus) * 100)) : 4}%`,
    })));
  return { minutes, graphique };
}

/**
 * Le journal (JournalActivity, 02/11) : le résumé, les minutes du mois en barres, puis chaque
 * journée de la plus récente à la plus ancienne, sa durée, ses sujets, sa note et le journal enrichi. Toucher une
 * journée rouvre sa note.
 */
function ecranJournal() {
  const jours = store.jours().sort((a, b) => (a.date < b.date ? 1 : -1));
  const faites = jours.filter((r) => r.faite).length;
  const { graphique } = graphiqueDuMois();
  // Le journal enrichi (JournalActivity, 02/11) : l'humeur, la gratitude et la chose à travailler sous la note.
  const notes = store.journalPlusTout();
  const formatJour = new Intl.DateTimeFormat(tr.langue, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const dateLisible = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const t = formatJour.format(new Date(y, m - 1, d));
    return t.charAt(0).toLocaleUpperCase(tr.langue) + t.slice(1);
  };
  const contenu = jours.length === 0
    ? h('div', { class: 'carte journal-vide' }, h('p', {}, tr.t('journal_empty')),
      h('button', { class: 'principal', onclick: () => ouvrir('seance') }, tr.t('journal_empty_action')))
    : h('div', { class: 'carte journal-liste' }, jours.map((r) => {
      const sujets = [...new Set(r.themes)].filter((c) => SUJETS.includes(c)).map((c) => tr.t(`theme_${c}`)).join(' · ');
      const enrichi = JournalPlus.resume(notes[r.date] ?? JournalPlus.lire(null), tr.t('journal_gratitude'), tr.t('journal_travail'),
        sujets ? tr.t('journal_sujets', sujets) : '', tr.rtl ? '←' : '→');
      const detail = [r.note, enrichi].filter((x) => x.trim()).join('\n');
      return h('button', { type: 'button', class: 'journal-jour', onclick: () => ecrireNote(r.date, rendre) },
        h('span', { class: 'journal-date' }, dateLisible(r.date)),
        h('span', { class: 'journal-duree' }, r.noteSeule ? tr.t('journal_note_only') : r.minutes > 0 ? tr.duree(r.minutes) : tr.t('today_declared')),
        detail ? h('span', { class: 'journal-note' }, detail) : null);
    }));
  return h('div', { class: 'ecran avec-bandeau' },
    bandeau(tr.t('journal_title'), { puce: h('div', {},
      h('p', { class: 'bandeau-sous-titre' }, tr.p('journal_summary', faites, faites, tr.duree(store.totalMinutes()))), graphique), dessin: 'char_writing' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' }, contenu)));
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
      ligne({ nom: tr.t('tefilot_title'), etat: tr.t('tefilot_hint'), onclick: () => ouvrir('tefilot') }),
      // Les livres entiers (13/10), puis les sources de la hitbodedout.
      ligne({ nom: tr.t('livres_title'), etat: tr.t('livres_hint'), onclick: () => ouvrir('livres') }),
      ligne({ nom: tr.t('library_title'), etat: tr.t('library_hint'), onclick: () => ouvrir('bibliotheque') }),
      ligne({ nom: tr.t('chizuk_demande_title'), etat: tr.t('chizuk_demande_hint'), onclick: () => { hizouk = null; ouvrir('hizouk'); } }),
      ligne({ nom: tr.t('tips_title'), etat: tr.t('tips_hint'), onclick: () => ouvrir('conseils') })),
    h('h2', { class: 'section' }, tr.t('section_around')),
    h('div', { class: 'carte' },
      ligne({ nom: tr.t('music_title'), etat: etatMusique(), onclick: () => ouvrir('musique') }),
      ligne({ nom: tr.t('settings_title'), onclick: () => ouvrir('reglages') })));
}

function onglets() {
  // Les cinq onglets d'Android (02/11) : le journal, longtemps masqué, a maintenant son écran.
  const items = [
    ['aujourdhui', 'nav_today'], ['textes', 'nav_texts'], ['zmanim', 'nav_zmanim'], ['journal', 'nav_journal'], ['reglages', 'settings_title'],
  ];
  return h('nav', { class: 'onglets' }, items.map(([cle, nom]) => h('button', {
    class: 'onglet',
    'data-onglet': cle,
    'aria-current': cle === onglet ? 'page' : null,
    onclick: () => {
      // Journal et Réglages ouvrent leur écran ; l'onglet actif ne bouge pas (MainActivity.wireTabs).
      if (cle === 'reglages' || cle === 'zmanim' || cle === 'journal') ouvrir(cle);
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
  const iso = jourLieu();
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
  const aleatoire = store.musicShuffle();
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
        // La lecture aléatoire (MusicActivity, music_shuffle, 28/09).
        ligneInterrupteur(tr.t('music_shuffle'), tr.t('music_shuffle_hint'), aleatoire, (v) => { store.setMusicShuffle(v); musiqueChangee(); }),
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
      h('p', { class: 'indice' }, tr.t('music_library_hint')),
      h('div', { class: 'carte' }, morceaux.map((m) => {
        // En lecture aléatoire, aucun morceau n'est « le » morceau de la séance.
        const coche = !aleatoire && m === choisi;
        return h('div', { class: `ligne morceau${coche ? ' choisi' : ''}` },
          h('button', {
            // Choisir un morceau, c'est quitter la lecture aléatoire.
            class: 'corps', onclick: () => { store.setMusicTrackId(m.id); store.setMusicShuffle(false); musiqueChangee(); rendre(); },
            'aria-pressed': String(coche),
          }, h('div', { class: 'nom' }, titreMorceau(m)), h('div', { class: 'etat' }, tr.t(m.perso ? 'music_origin_device' : 'music_origin_bundled'))),
          h('button', { class: 'renommer', 'aria-label': tr.t('music_rename'), onclick: () => renommerMorceau(m) }, iconeCrayon()),
          h('button', {
            class: 'ecouter', 'aria-pressed': String(enEcoute === m.id), onclick: () => ecouter(m),
          }, tr.t('music_preview')));
      })),
      h('button', { class: 'secondaire ajouter-morceau', onclick: choisirFichierAudio }, tr.t('music_add')))));
}

function iconeCrayon() {
  const svg = s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.append(s('path', { fill: 'currentColor', d: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' }));
  return svg;
}

// --- Les morceaux ajoutés (MusicActivity.addTrack, askRename ; 02/11) -------------------------
/** OpenDocument(audio/*) : un fichier de l'appareil, copié dans le navigateur. */
function choisirFichierAudio() {
  const champ = h('input', { type: 'file', accept: 'audio/*', hidden: true });
  champ.addEventListener('change', () => { const f = champ.files?.[0]; champ.remove(); if (f) ajouteMorceau(f); });
  document.body.append(champ);
  champ.click();
}

async function ajouteMorceau(fichier) {
  // Le même fichier, choisi deux fois, n'entre qu'une fois (MusicLibrary.addUserTrack).
  const source = `${fichier.name}|${fichier.size}|${fichier.lastModified}`;
  const deja = morceaux.find((m) => m.perso && m.source === source);
  if (deja) { store.setMusicTrackId(deja.id); rendre(); return; }
  const id = `perso:${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`}`;
  const entree = { id, titre: titreDeFichier(fichier.name), source };
  try {
    // Une copie lue en entier : le fichier choisi ne sera plus accessible au prochain démarrage.
    entree.blob = new Blob([await fichier.arrayBuffer()], { type: fichier.type || 'audio/mpeg' });
    await MorceauxPerso.ajoute(entree);
  } catch (e) {
    signale(tr.t(estQuota(e) ? 'music_add_quota_web' : 'music_add_failed'));
    return;
  }
  // Que le navigateur ne l'efface pas de lui-même quand la place manque.
  navigator.storage?.persist?.().catch(() => {});
  morceaux.push(versMorceau(entree));
  store.setMusicTrackId(id);
  rendre();
}

/** MusicActivity.askRename : le nom, puis « Retirer » pour un morceau ajouté, « Titre d'origine » pour un morceau livré renommé. */
function renommerMorceau(m) {
  const donne = nomDonne(store.musicNames(), m.id);
  const origine = m.perso ? m.titre || tr.t('music_unnamed') : tr.t(m.titre);
  feuille(tr.t('music_rename'), (f, fermer) => {
    const champ = h('input', { type: 'text', dir: 'auto', value: donne ?? '', placeholder: origine, 'aria-label': tr.t('music_rename'), maxlength: 120 });
    const nommer = (titre) => { store.setMusicNames(renomme(store.musicNames(), m.id, titre)); fermer(); rendre(); majMini(); };
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') nommer(champ.value); });
    const neutre = m.perso
      ? h('button', { class: 'neutre', onclick: () => { fermer(); confirmerRetrait(m); } }, tr.t('music_remove'))
      : donne ? h('button', { class: 'neutre', onclick: () => nommer('') }, tr.t('music_rename_reset')) : null;
    f.append(champ, h('div', { class: 'actions' }, neutre,
      h('button', { onclick: fermer }, tr.t('action_back')),
      h('button', { onclick: () => nommer(champ.value) }, tr.t('action_save'))));
    setTimeout(() => champ.select(), 0);
  });
}

/** Un morceau livré ne se retire pas ; un morceau ajouté, après confirmation. */
function confirmerRetrait(m) {
  if (!m.perso) return;
  confirmer(tr.t('music_remove_confirm_web', titreMorceau(m)), tr.t('music_remove_message_web'), tr.t('music_remove'), async () => {
    try { await MorceauxPerso.retire(m.id); } catch { signale(tr.t('music_play_failed')); return; }
    const jouait = lecteur.src === m.fichier && !lecteur.paused;
    if (lecteur.src === m.fichier) { lecteur.pause(); lecteur.removeAttribute('src'); lecteur.load(); enEcoute = null; }
    morceaux = morceaux.filter((x) => x !== m);
    URL.revokeObjectURL(m.fichier);
    if (store.musicTrackId() === m.id) store.setMusicTrackId(null);
    store.setMusicNames(renomme(store.musicNames(), m.id, ''));
    // Retiré pendant qu'il jouait en séance : la musique continue avec un autre.
    if (jouait && store.isSessionRunning()) demarreMusique();
    rendre();
  });
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
/**
 * La position du téléphone (16/10 ; précise depuis le 28/10, « en fonction de la position exacte ») :
 * haute précision, un point de moins d'une minute ; sans réponse, la dernière connue, même
 * ancienne. La ville la plus proche nomme le lieu. Silencieux : aucun message, aucune demande.
 */
function localiserPosition({ etat = null, apres = rendre, silencieux = false } = {}) {
  const dire = (cle) => { if (etat && !silencieux) etat.textContent = tr.t(cle); };
  if (!navigator.geolocation) { dire('zmanim_position_refusee'); return; }
  dire('zmanim_position_attente');
  const poser = (p, ancienne) => {
    const proche = villePlusProche(villes ?? [], p.coords.latitude, p.coords.longitude);
    store.setLieu({
      nom: proche ? tr.t('zmanim_position_pres', titreTexte(proche.nom)) : tr.t('zmanim_position'),
      latitude: p.coords.latitude, longitude: p.coords.longitude,
      // Le fuseau du téléphone ; Israël ou diaspora d'après le territoire (TerritoireIsrael, 16/10).
      altitude: proche?.altitude ?? 0, fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    store.setInIsrael(dansIsrael(p.coords.latitude, p.coords.longitude));
    if (ancienne && !silencieux) signale(tr.t('zmanim_position_ancienne'));
    apres();
  };
  const refus = () => dire('zmanim_position_refusee');
  navigator.geolocation.getCurrentPosition((p) => poser(p, false), (e) => {
    if (e.code === 1) { refus(); return; } // refusée : inutile d'insister
    if (!silencieux) navigator.geolocation.getCurrentPosition((p) => poser(p, true), refus, { maximumAge: Infinity, timeout: 10_000 });
  }, { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 });
}

/**
 * À l'ouverture des zmanim ou de la boussole : si le lieu est la position du téléphone (pas une
 * ville) et que la localisation est déjà permise, la reprendre sans rien dire, au plus toutes
 * les cinq minutes ; la page se redessine si le point a bougé de plus de 100 m.
 */
let dernierRafraichissement = 0;
function rafraichirPosition() {
  const lieu = store.lieu();
  if (!lieu || lieu.ville != null || !navigator.permissions || Date.now() - dernierRafraichissement < 300_000) return;
  dernierRafraichissement = Date.now();
  navigator.permissions.query({ name: 'geolocation' }).then((r) => {
    if (r.state !== 'granted') return;
    localiserPosition({ silencieux: true, apres: () => {
      const n = store.lieu();
      if (distanceKm(lieu.latitude, lieu.longitude, n.latitude, n.longitude) > 0.1) rendre();
    } });
  }).catch(() => {});
}

function choisirLieu() {
  chargeVilles();
  feuille(tr.t('zmanim_choisir_lieu'), (f, fermer) => {
    const etat = h('p', { class: 'message', 'aria-live': 'polite' });
    f.append(h('button', {
      class: 'choix',
      onclick: () => localiserPosition({ etat, apres: () => { fermer(); rendre(); } }),
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

// Les biographies d'autres sources (hilloulot_bios, 12/10), à part pour que la carte du jour
// reste légère ; par jour, une entrée par hilloula, dans le même ordre. Un fichier par mois
// (04/11) : l'écran ne télécharge plus les 6,9 Mo de l'année pour montrer un jour.
const biosMois = new Map();
function chargeBiosHilloulot(cles) {
  if (!tableHilloulot()) return; // la table arrive, puis un nouveau rendu redemande
  for (const mois of new Set(cles.map((k) => k.split('-')[0]))) {
    if (biosMois.has(mois)) continue;
    biosMois.set(mois, 'attente');
    fetch(`data/hilloulot_bios/${mois}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((bios) => {
        for (const [cle, ligne] of Object.entries(bios)) ligne.forEach((b, i) => { if (b && hilloulots[cle]?.[i]) hilloulots[cle][i].b = b; });
        biosMois.set(mois, 'ok');
        if (ecranCourant() === 'hilloulot') rendre();
      }).catch(() => { biosMois.delete(mois); });
  }
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
  doubleToucherPourRamener(defile);
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
        h('div', { class: 'mois-titres' }, h('p', { class: 'mois-principal mois-hebreu', lang: 'he', dir: 'rtl' }, j.dateHebraique), h('p', { class: 'mois-second' }, dateCivile(iso))),
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

// HilloulotActivity, réorganisé (04/11) : la recherche en tête, puis le jour et ses tsadikim
// en liste compacte, les mieux connus d'abord ; un nom touché déplie sa notice et ses
// biographies. La recherche range par date, de Tichri à Eloul, chaque date menant à son
// jour. L'interrupteur de la carte du jour, un réglage, est en bas.
const hilloulotDepliees = new Set();
const hilloulotRepliees = new Set();

function ficheHilloula(x) {
  // dir auto : la flèche reste au bout du nom, latin ou hébreu.
  const source = (nom, lien) => (lien ? h('a', { class: 'hilloula-source', dir: 'auto', href: lien, target: '_blank', rel: 'noopener' }, `${nom} ↗`)
    : h('p', { class: 'hilloula-source sans-lien', dir: 'auto' }, nom));
  return h('div', { class: 'hilloula-fiche' },
    x.t ? h('p', { class: 'hilloula-description', lang: 'he', dir: 'rtl' }, paragraphes(x.t)) : null,
    x.s.includes('w') ? source(tr.t('hilloula_source_wiki'), x.w ? lienArticle(x.w) : null) : null,
    x.s.includes('h') ? source(tr.t('hilloula_source_hyomi')) : null,
    x.s.includes('e') ? source(tr.t('hilloula_source_toratemet')) : null,
    // Les autres biographies (MyTzadik, המאיר לארץ), chacune suivie de sa source, comme le demande l'accord (12/10).
    ...(x.b ?? []).flatMap(([src, texte, lien]) => {
      const nom = tr.t(src === 'm' ? 'hilloula_source_mytzadik' : 'hilloula_source_hameir');
      // Une longue biographie se replie à huit lignes ; « Lire la suite » la déplie.
      const long = texte.length > 500;
      const p = h('p', { class: `hilloula-description hilloula-bio${long ? ' replie' : ''}`, lang: 'he', dir: 'rtl' }, paragraphes(texte));
      const bascule = long ? h('button', { type: 'button', class: 'lien-bouton hilloula-plus', 'aria-expanded': 'false', onclick: (e) => {
        const ouvert = p.classList.toggle('replie') === false;
        e.currentTarget.setAttribute('aria-expanded', String(ouvert));
        e.currentTarget.textContent = tr.t(ouvert ? 'hilloula_reduire' : 'hilloula_lire_plus');
      } }, tr.t('hilloula_lire_plus')) : null;
      return [p, bascule, source(nom, lien)];
    }),
    x.i ? source(tr.t('hilloula_source_hidabroot'), x.i) : null);
}

/** Un tsadik : le nom, la traduction et l'année dessous, le chevron s'il y a de quoi déplier. */
function ligneHilloula(x, id, ouvertParDefaut) {
  const details = Boolean(x.t || x.b?.length || x.i || x.w);
  const ouvert = details && (hilloulotDepliees.has(id) || (ouvertParDefaut && !hilloulotRepliees.has(id)));
  const traduit = nomTraduitHilloula(x);
  // Isolée (FSI … PDI) : l'année hébraïque ne renverse pas la ligne.
  const sous = [traduit, x.a ? tr.t('hilloula_annee', `\u2068${x.a}\u2069`) : null].filter(Boolean).join(' · ');
  const corps = [
    h('span', { class: 'hilloula-nom', lang: 'he' }, x.he),
    sous ? h('span', { class: 'hilloula-sous', dir: 'auto' }, sous) : null,
  ];
  const tete = details
    ? h('button', { type: 'button', class: 'hilloula-tete', 'aria-expanded': String(ouvert), onclick: () => {
      if (ouvert) { hilloulotDepliees.delete(id); hilloulotRepliees.add(id); } else { hilloulotDepliees.add(id); hilloulotRepliees.delete(id); }
      rendre();
    } }, h('span', { class: 'hilloula-textes' }, corps), h('span', { class: 'hilloula-chevron', 'aria-hidden': 'true' }))
    : h('div', { class: 'hilloula-tete' }, h('span', { class: 'hilloula-textes' }, corps));
  return h('div', { class: `hilloula-ligne${ouvert ? ' ouverte' : ''}`, dir: 'rtl' }, tete, ouvert ? ficheHilloula(x) : null);
}

function ecranHilloulot() {
  const table = tableHilloulot() ?? {};
  const aujourdhui = isoLocal(new Date());
  const iso = jourHilloulot ?? aujourdhui;
  const israel = store.inIsrael();
  const ashkenaz = store.siddurNusah() === 'ashkenaz';
  const champ = h('input', { type: 'search', class: 'champ-recherche', placeholder: tr.t('hilloulot_recherche'), 'aria-label': tr.t('hilloulot_recherche'), value: rechercheHilloulot, enterkeyhint: 'search',
    oninput: (e) => { rechercheHilloulot = e.target.value; rendre(); setTimeout(() => { const c = app.querySelector('.champ-recherche'); c?.focus(); c?.setSelectionRange(c.value.length, c.value.length); }, 0); } });
  let corps;
  if (rechercheHilloulot.trim().length >= 2) {
    const trouves = rechercheHilloula(table, rechercheHilloulot).slice(0, 60);
    chargeBiosHilloulot(trouves.map(([cle]) => cle));
    // Par date, dans l'ordre de l'année ; chaque date mène à son jour.
    const groupes = new Map();
    for (const [cle, x] of trouves) groupes.set(cle, [...(groupes.get(cle) ?? []), x]);
    corps = [h('p', { class: 'hilloulot-compte' }, tr.t('hilloulot_resultats', rechercheHilloula(table, rechercheHilloulot).length)),
      // Une seule carte : chaque date en tête de ses noms.
      groupes.size ? h('div', { class: 'carte carte-hilloulot' }, [...groupes].flatMap(([cle, noms]) => [
        h('div', { class: 'hilloulot-date' },
          h('h2', { lang: 'he' }, dateHilloula(cle, (n) => Reference.lettres(n))),
          h('button', { type: 'button', class: 'lien-bouton', onclick: () => {
            const jourIso = prochainJourHilloula(cle, aujourdhui, israel, ashkenaz);
            if (!jourIso) return;
            jourHilloulot = jourIso;
            for (const x of noms) hilloulotDepliees.add(`${jourIso}|${x.he}`);
            rechercheHilloulot = '';
            rendre();
            app.querySelector('.defile')?.scrollTo(0, 0);
          } }, tr.t('hilloulot_ouvrir_jour'))),
        ...noms.map((x) => ligneHilloula(x, `r|${cle}|${x.he}`, false)),
      ])) : null];
  } else {
    const j = jourJuif(iso, israel);
    const decale = (n) => { const [a, m, d] = iso.split('-').map(Number); jourHilloulot = new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10); rendre(); };
    const liste = hilloulotPour(table, iso, israel, ashkenaz);
    chargeBiosHilloulot(clesHilloulotPour(iso, israel, ashkenaz));
    const detaillees = liste.some((x) => x.t || x.w || x.i);
    corps = [
      h('div', { class: 'carte hilloulot-jour' },
        h('div', { class: 'mois-tete' },
          h('button', { class: 'icone-bouton mois-precedent', dir: 'ltr', 'aria-label': tr.t('jour_precedent'), onclick: () => decale(-1) }, tr.rtl ? '›' : '‹'),
          h('div', { class: 'mois-titres' }, h('p', { class: 'mois-principal mois-hebreu', lang: 'he', dir: 'rtl' }, j.dateHebraique), h('p', { class: 'mois-second' }, dateCivile(iso))),
          h('button', { class: 'icone-bouton mois-suivant', dir: 'ltr', 'aria-label': tr.t('jour_suivant'), onclick: () => decale(1) }, tr.rtl ? '‹' : '›')),
        iso !== aujourdhui ? h('button', { type: 'button', class: 'lien-bouton hilloulot-aujourdhui', onclick: () => { jourHilloulot = null; rendre(); } }, tr.t('calendrier_aujourdhui')) : null),
      ...(liste.length ? [
        h('p', { class: 'hilloulot-compte' }, tr.p('hilloulot_nombre', liste.length, liste.length) + (detaillees && liste.length > 1 ? ` · ${tr.t('hilloulot_toucher')}` : '')),
        h('div', { class: 'carte carte-hilloulot' }, liste.map((x) => ligneHilloula(x, `${iso}|${x.he}`, liste.length === 1))),
      ] : [h('p', { class: 'message' }, tr.t('hilloulot_aucune'))]),
      lienExterne(tr.t('hilloula_lien'), lienHyomi(iso)),
    ];
  }
  return h('div', { class: 'ecran avec-bandeau' }, bandeau(tr.t('hilloulot_title')),
    zoneReglable(h('div', { class: 'contenu ecran-hilloulot' },
      h('div', { class: 'carte hilloulot-recherche' }, (() => {
        const loupe = s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'loupe' });
        loupe.append(s('path', { d: 'M10.5 4a6.5 6.5 0 1 0 .001 0Z M15.5 15.5 21 21', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }));
        return loupe;
      })(), champ),
      ...corps,
      h('div', { class: 'carte' },
        h('label', { class: 'ligne' }, h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('hilloulot_afficher')), h('div', { class: 'etat' }, tr.t('hilloulot_afficher_detail'))),
          h('input', { type: 'checkbox', role: 'switch', class: 'interrupteur', checked: store.hilloulotAffichees(), 'aria-label': tr.t('hilloulot_afficher'),
            onchange: (e) => { store.setHilloulotAffichees(e.target.checked); rendre(); } }))))));
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
  rafraichirPosition();
  const lieu = store.lieu();
  const iso = isoLocal(new Date());
  const puce = h('button', {
    type: 'button', class: 'puce-bandeau', 'aria-haspopup': 'dialog', onclick: choisirLieu,
    'aria-label': `${tr.t('reglage_lieu')} : ${lieu ? lieu.nom : tr.t('reglage_lieu_aucun')}`,
  }, h('span', {}, lieu ? tr.t('zmanim_lieu_detail', lieu.nom, tr.t(store.inIsrael() ? 'region_israel' : 'region_diaspora')) : tr.t('zmanim_choisir_lieu')), icone('replier'));
  // Sans lieu, la grande carte « Choisir le lieu » suffit : pas de seconde pastille dans le bandeau.
  return h('div', { class: 'ecran avec-bandeau' }, bandeau(tr.t('zmanim_title'), { puce: lieu ? puce : null, dessin: 'char_torah' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      // Le jour seul, trois boutons, puis les horaires (14/10, « trop de choses avant les זמנים »).
      carteJour(iso, { complet: false }),
      h('div', { class: 'boutons-jour' },
        h('button', { class: 'secondaire', onclick: () => { jourHalakha = iso; rechercheHalakhaTexte = ''; ouvrir('halakha'); } }, tr.t('zmanim_bouton_halakha')),
        h('button', { class: 'secondaire', onclick: () => { jourHilloulot = iso; rechercheHilloulot = ''; ouvrir('hilloulot'); } }, tr.t('zmanim_bouton_hilloulot')),
        h('button', { class: 'secondaire', onclick: () => { jourCalendrier = iso; moisCalendrier = null; moisHebreuCalendrier = null; ouvrir('calendrier'); } }, tr.t('zmanim_calendrier')),
        // Le vol et la boussole rejoignent les boutons : les horaires du jour passent avant.
        // L'icône est un élément à part : elle reste au début du bouton, à droite en hébreu.
        h('button', { class: 'secondaire bouton-large', onclick: () => ouvrir('vol') }, h('span', { 'aria-hidden': 'true' }, '✈'), h('span', {}, tr.t('zmanim_bouton_vol'))),
        h('button', { class: 'secondaire bouton-large', onclick: () => ouvrir('boussole') }, h('span', { 'aria-hidden': 'true' }, '🧭'), h('span', {}, tr.t('zmanim_bouton_boussole')))),
      listeZmanim(iso),
      ...sousHoraires(iso),
      ...piedZmanim())));
}

// --- La boussole de Jérusalem (BoussoleActivity, 28/10) : boussole.js ------------------------
// Le hassid se tourne (design C, par défaut) ou la rose des vents. Le hassid suit
// le plus court chemin, la direction réelle ; la direction sur la carte reste en
// pointillé bleu. Le cap vient de l'orientation de l'appareil (iPhone : après un
// toucher, qui demande l'autorisation), corrigé de la déclinaison (WMM2025).
let capBoussole = null;
let boussoleEcoute = false;
let boussoleRecu = false;
/** « Boussole peu précise » (BoussoleActivity.onAccuracyChanged, 02/11) : caché tant que rien n'est dit. */
let boussoleACalibrer = false;
/** L'iPhone a dit oui : à la prochaine ouverture, on écoute sans redemander le toucher. */
let boussolePermise = false;
const SOURCE_BOUSSOLE = 'https://www.chabad.org/library/article_cdo/aid/3502321/jewish/Why-Do-We-Face-East-When-Praying-Or-Do-We.htm';
const COULEURS_BOUSSOLE = { ciel: '#DFF5E8', sol: '#CBEBD8', horizon: '#9CC9B0', encre: '#173C32', marque: '#16775A', or: '#B8780F', bleu: '#2E7DB3' };

/** Celle que suit le hassid, puis l'autre : le grand cercle d'abord, ou la carte de Mercator si on l'a choisie (03/11). */
function directionsBoussole(lieu) {
  const gc = Boussole.grandCercle(lieu.latitude, lieu.longitude);
  const rh = Boussole.carte(lieu.latitude, lieu.longitude);
  return store.boussoleCarte() ? [rh, gc] : [gc, rh];
}

function carteBoussole() {
  const lieu = store.lieu();
  return h('div', { class: 'carte' }, h('button', { class: 'ligne', onclick: () => ouvrir('boussole') },
    h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('boussole_title')),
      h('div', { class: 'etat' }, lieu ? tr.t('boussole_par_rapport_nord', Boussole.degres(directionsBoussole(lieu)[0])) : tr.t('boussole_carte_sous'))),
    h('span', { class: 'chevron', 'aria-hidden': 'true' })));
}

function consigneBoussole(gc, cap) {
  if (cap == null) return tr.t('boussole_par_rapport_nord', Boussole.degres(gc));
  const e = Boussole.ecart(gc, cap);
  if (Boussole.face(e)) return tr.t('boussole_face');
  return e > 0 ? tr.t('boussole_droite', Math.round(e)) : tr.t('boussole_gauche', Math.round(-e));
}

const echapper = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Le dessin, en SVG : la scène C, la rose vivante, ou la rose fixe (nord en haut) sans cap. */
function dessinBoussole(gc, rh, cap) {
  const c = COULEURS_BOUSSOLE;
  const texte = echapper(consigneBoussole(gc, cap));
  if (cap == null) {
    return `<svg viewBox="-160 -160 320 320" role="img" aria-label="${texte}"><rect x="-160" y="-160" width="320" height="320" fill="${c.ciel}"/>
      <circle r="126" fill="none" stroke="${c.horizon}" stroke-width="3"/>
      <image href="${perso('img/char_standing_back.webp')}" x="-34" y="-94" width="68" height="212"/>
      <g transform="rotate(${gc})"><path d="M0,-151 L14,-106 L0,-114 L-14,-106 Z" fill="${c.or}"/></g>
      <text y="-132" text-anchor="middle" font-size="22" font-weight="700" fill="${c.encre}">${echapper(tr.t('boussole_nord'))}</text>
      <text x="108" y="146" text-anchor="middle" font-size="26" fill="${c.encre}">${Boussole.degres(gc)}°</text></svg>`;
  }
  const e = Boussole.ecart(gc, cap), ok = Boussole.face(e);
  if (store.boussoleRose()) return roseGraduee(gc, rh, cap, ok, texte);
  const xg = Boussole.xHorizon(e), xr = Boussole.xHorizon(Boussole.ecart(rh, cap));
  // L'étiquette reste entière dans le cadre, même quand le point est au bord.
  const xe = Math.max(-124, Math.min(124, xg));
  return `<svg viewBox="-160 -160 320 320" role="img" aria-label="${texte}"><rect x="-160" y="-160" width="320" height="320" fill="${c.ciel}"/>
    <path d="M-160,40 Q0,10 160,40 L160,160 L-160,160 Z" fill="${c.sol}"/>
    <line x1="-150" y1="-90" x2="150" y2="-90" stroke="${c.horizon}" stroke-width="2"/>
    <circle cx="${xr}" cy="-90" r="7" fill="none" stroke="${c.bleu}" stroke-width="2.5" stroke-dasharray="3 3"/>
    <rect x="${xe - 34}" y="-124" width="68" height="22" rx="11" fill="${ok ? c.marque : '#fff'}"/>
    <text x="${xe}" y="-108" text-anchor="middle" font-family="serif" font-size="15" font-weight="700" fill="${ok ? '#fff' : c.marque}">ירושלים</text>
    <circle cx="${xg}" cy="-90" r="8" fill="${ok ? c.marque : c.or}"/>
    <image href="${perso('img/char_standing_back.webp')}" x="-28" y="${ok ? -68 : -62}" width="56" height="176"/>
    <text y="-132" text-anchor="middle" font-size="14" fill="${c.encre}">${texte}</text></svg>`;
}

/**
 * La rose graduée (reprise de main, 28/10), miroir de BoussoleDessin.roseVivante : le cadran
 * tourne avec le téléphone, le repère du haut est le cap ; graduations aux 5°, degrés aux 30°,
 * zone d'or de ±TOLERANCE, aiguille d'or vers [gc], pointillé bleu vers [rh]. Grille de 240.
 */
function roseGraduee(gc, rh, cap, ok, texte) {
  const c = COULEURS_BOUSSOLE, C = 120, R = 104, t = Boussole.TOLERANCE;
  const f = (n) => +n.toFixed(2);
  const pt = (g, r) => { const a = (g * Math.PI) / 180; return [f(C + r * Math.sin(a)), f(C - r * Math.cos(a))]; };
  let cadran = `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${c.encre}" stroke-opacity="0.3"/>`;
  const [ax, ay] = pt(gc - t, R - 6), [bx, by] = pt(gc + t, R - 6);
  cadran += `<path d="M${ax} ${ay} A${R - 6} ${R - 6} 0 0 1 ${bx} ${by}" fill="none" stroke="${c.or}" stroke-opacity="0.35" stroke-width="8" stroke-linecap="round"/>`;
  for (let g = 0; g < 360; g += 5) {
    const fort = g % 30 === 0, l = fort ? 12 : g % 10 === 0 ? 7 : 4;
    const [x1, y1] = pt(g, R), [x2, y2] = pt(g, R - l);
    cadran += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c.encre}" stroke-opacity="${fort ? 1 : 0.4}" stroke-width="${fort ? 1.6 : 0.8}" stroke-linecap="round"/>`;
  }
  for (let g = 30; g < 360; g += 30) {
    if (g % 90 === 0) continue;
    const [x, y] = pt(g, R - 24);
    cadran += `<text x="${x}" y="${f(y + 3)}" transform="rotate(${g} ${x} ${y})" text-anchor="middle" font-size="8.5" fill="${c.encre}" fill-opacity="0.67">${g}</text>`;
  }
  tr.tab('boussole_cardinaux').slice(0, 4).forEach((n, i) => {
    const [x, y] = pt(i * 90, R - 30);
    cadran += `<text x="${x}" y="${f(y + 6)}" transform="rotate(${i * 90} ${x} ${y})" text-anchor="middle" font-size="16" font-weight="700" fill="${i === 0 ? c.marque : c.encre}">${echapper(n)}</text>`;
  });
  cadran += `<line x1="${C}" y1="${C}" x2="${C}" y2="${C - R + 20}" stroke="${c.bleu}" stroke-width="2.5" stroke-dasharray="6 6" transform="rotate(${f(rh)} ${C} ${C})"/>`;
  cadran += `<g transform="rotate(${f(gc)} ${C} ${C})"><line x1="${C}" y1="${C + 8}" x2="${C}" y2="${C + 34}" stroke="${c.encre}" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
    <path d="M${C} ${C - R + 16} L${C - 9} ${C + 2} L${C} ${C - 6} L${C + 9} ${C + 2} Z" fill="${c.or}"/></g>`;
  const eclat = ok ? `<circle cx="${C}" cy="${C}" r="${R + 12}" fill="none" stroke="${c.or}" stroke-opacity="0.25" stroke-width="18"/>
    <circle cx="${C}" cy="${C}" r="${R + 13}" fill="none" stroke="${c.or}" stroke-width="2.5"/>` : '';
  return `<svg viewBox="-160 -160 320 320" role="img" aria-label="${texte}"><rect x="-160" y="-160" width="320" height="320" fill="${c.ciel}"/>
    <text y="-142" text-anchor="middle" font-size="14" fill="${c.encre}">${texte}</text>
    <g transform="translate(0 12) scale(1.15) translate(-120 -120)">${eclat}
      <circle cx="${C}" cy="${C}" r="${R + 10}" fill="${ok ? '#F4E8CF' : '#F5F6F5'}" stroke="${c.encre}" stroke-opacity="0.12"/>
      <g transform="rotate(${f(-cap)} ${C} ${C})">${cadran}</g>
      <path d="M${C} 4 L${C - 7} 16 L${C + 7} 16 Z" fill="${ok ? c.or : c.marque}"/>
      <circle cx="${C}" cy="${C}" r="6" fill="${c.or}"/><circle cx="${C}" cy="${C}" r="2.5" fill="#fff"/></g></svg>`;
}

/** Une mesure d'orientation : le cap vrai, lissé, et la scène seule redessinée. */
function surOrientation(e) {
  if (ecranCourant() !== 'boussole') return;
  const lieu = store.lieu();
  const magnetique = Boussole.capMagnetique(e, screen.orientation?.angle ?? window.orientation ?? 0);
  // La précision, là où le navigateur la donne (iPhone) ; inconnue, rien ne change (boussole.js, aCalibrer).
  const calibrer = Boussole.aCalibrer(e);
  if (calibrer != null && calibrer !== boussoleACalibrer) {
    boussoleACalibrer = calibrer;
    const avis = app.querySelector('.boussole-calibrer');
    if (avis) avis.hidden = !calibrer;
  }
  if (!lieu || magnetique == null) return;
  const avant = capBoussole;
  capBoussole = Boussole.lisser(capBoussole, Boussole.capVrai(magnetique, lieu));
  const scene = app.querySelector('.boussole-scene');
  if (!scene) return;
  const [gc, autre] = directionsBoussole(lieu);
  scene.innerHTML = dessinBoussole(gc, autre, capBoussole);
  // Face à Jérusalem : une petite vibration, là où le navigateur le permet (pas sur iPhone).
  if (avant != null && !Boussole.face(Boussole.ecart(gc, avant)) && Boussole.face(Boussole.ecart(gc, capBoussole))) navigator.vibrate?.(30);
  if (!boussoleRecu) { boussoleRecu = true; rendre(); }
}

/** En quittant l'écran (rendre) : plus d'écoute du capteur. */
function arreteBoussole() {
  if (!boussoleEcoute) return;
  boussoleEcoute = false;
  boussoleACalibrer = false;
  // Le cap d'avant ne vaut plus à la prochaine ouverture : ni dessiné comme mesuré, ni point de départ du lissage.
  capBoussole = null;
  boussoleRecu = false;
  window.removeEventListener('deviceorientationabsolute', surOrientation);
  window.removeEventListener('deviceorientation', surOrientation);
}

function ecouterBoussole() {
  if (boussoleEcoute) return;
  boussoleEcoute = true;
  // Chrome et Android : l'orientation absolue ; iPhone : webkitCompassHeading sur deviceorientation.
  if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', surOrientation);
  else window.addEventListener('deviceorientation', surOrientation);
}

/** L'iPhone demande l'autorisation, et seulement après un toucher. */
const autorisationBoussole = () => typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

function ecranBoussole() {
  chargeVilles();
  rafraichirPosition();
  const lieu = store.lieu();
  if (!autorisationBoussole() || boussolePermise) ecouterBoussole();
  const puce = h('button', {
    type: 'button', class: 'puce-bandeau', 'aria-haspopup': 'dialog', onclick: choisirLieu,
    'aria-label': `${tr.t('reglage_lieu')} : ${lieu ? lieu.nom : tr.t('reglage_lieu_aucun')}`,
  }, h('span', {}, lieu ? lieu.nom : tr.t('zmanim_choisir_lieu')), icone('replier'));
  const contenu = [];
  if (!lieu) {
    // L'état vide : le hassid, une question, la position en un toucher, ou une ville.
    const etat = h('p', { class: 'indice', 'aria-live': 'polite' });
    contenu.push(h('div', { class: 'carte carte-vide' }, plateau('char_standing_back', 'plateau-vide'),
      h('p', { class: 'carte-vide-titre' }, tr.t('boussole_vide_titre')),
      h('p', { class: 'indice' }, tr.t('boussole_carte_sous')),
      h('button', { class: 'principal', onclick: () => localiserPosition({ etat }) }, tr.t('boussole_vide_position')),
      h('button', { class: 'lien-discret', onclick: choisirLieu }, tr.t('boussole_vide_ville')), etat));
  } else {
    const selonCarte = store.boussoleCarte();
    const [suivie, autre] = directionsBoussole(lieu);
    const gc = Boussole.grandCercle(lieu.latitude, lieu.longitude);
    const rh = Boussole.carte(lieu.latitude, lieu.longitude);
    const scene = h('div', { class: 'boussole-scene' });
    scene.innerHTML = dessinBoussole(suivie, autre, capBoussole);
    contenu.push(scene);
    contenu.push(h('p', { class: 'boussole-calibrer', role: 'status', hidden: !boussoleACalibrer }, tr.t('boussole_calibrer')));
    if (autorisationBoussole() && !boussoleEcoute) {
      contenu.push(h('button', { class: 'principal boussole-activer', onclick: async () => {
        try { if (await DeviceOrientationEvent.requestPermission() === 'granted') { boussolePermise = true; ecouterBoussole(); rendre(); } } catch { /* refusé : la rose fixe reste */ }
      } }, tr.t('boussole_activer')));
    }
    // Avant le toucher, rien n'est encore dit du capteur ; ensuite, sans mesure, la rose fixe reste.
    const attente = autorisationBoussole() && !boussoleEcoute;
    contenu.push(h('p', { class: 'indice' }, tr.t(attente || boussoleRecu ? 'boussole_a_plat' : 'boussole_sans_capteur')));
    // « Actualiser ma position » (31/10, ex-« Position exacte ») : le message de l'attente dessous.
    const etat = h('p', { class: 'indice', 'aria-live': 'polite' });
    contenu.push(h('button', { class: 'secondaire boussole-position', onclick: () => localiserPosition({ etat }) }, tr.t('boussole_actualiser_position')), etat);
    const points = tr.tab('boussole_points');
    const km = new Intl.NumberFormat(tr.langue).format(Math.round(Boussole.distanceKm(lieu.latitude, lieu.longitude)));
    contenu.push(h('div', { class: 'carte carte-texte' },
      // Celle que suit le hassid en premier, mise en avant ; l'autre dessous.
      ...(() => {
        const reelle = tr.t('boussole_grand_cercle', Boussole.degres(gc), points[Boussole.point(gc)]);
        const surCarte = tr.t('boussole_cap_constant', Boussole.degres(rh), points[Boussole.point(rh)]);
        const [premiere, seconde] = selonCarte ? [surCarte, reelle] : [reelle, surCarte];
        return [h('p', { class: 'boussole-principale' }, premiere), h('p', {}, seconde)];
      })(),
      h('p', { class: 'indice' }, tr.t('boussole_distance', km)),
      h('p', { class: 'indice' }, tr.t(selonCarte ? 'boussole_legende_carte' : 'boussole_legende'))));
    contenu.push(h('div', { class: 'carte' }, h('button', { class: 'ligne', 'aria-haspopup': 'dialog', onclick: choisirMethodeBoussole },
      h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('boussole_methode')),
        h('div', { class: 'etat' }, tr.t(selonCarte ? 'boussole_methode_carte' : 'boussole_methode_reelle'))),
      h('span', { class: 'chevron', 'aria-hidden': 'true' }))));
    contenu.push(h('div', { class: 'carte' }, h('button', { class: 'ligne', 'aria-haspopup': 'dialog', onclick: choisirAffichageBoussole },
      h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('boussole_affichage')),
        h('div', { class: 'etat' }, tr.t(store.boussoleRose() ? 'boussole_affichage_rose' : 'boussole_affichage_hassid'))),
      h('span', { class: 'chevron', 'aria-hidden': 'true' }))));
    const source = tr.t('boussole_source', '\u0000').split('\u0000');
    contenu.push(h('div', { class: 'carte carte-texte' },
      h('p', { class: 'nom' }, tr.t('boussole_note_titre')),
      h('p', { class: 'indice' }, tr.t('boussole_note')),
      h('p', {}, source[0], h('a', { href: SOURCE_BOUSSOLE, target: '_blank', rel: 'noopener', dir: 'ltr' }, tr.t('boussole_source_titre')), source[1] ?? '')));
  }
  return h('div', { class: 'ecran avec-bandeau' }, bandeau(tr.t('boussole_title'), { puce: lieu ? puce : null, dessin: 'char_standing_back' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' }, ...contenu, ...piedZmanim().slice(1))));
}

function choisirMethodeBoussole() {
  feuille(tr.t('boussole_methode'), (f, fermer) => {
    f.append(h('div', { role: 'radiogroup', 'aria-label': tr.t('boussole_methode') }, [false, true].map((carte) => {
      const courant = store.boussoleCarte() === carte;
      return h('button', {
        type: 'button', class: 'choix choix-radio', role: 'radio', 'aria-checked': String(courant),
        onclick: () => { fermer(); if (!courant) { store.setBoussoleCarte(carte); rendre(); } },
      }, h('span', { class: 'radio', 'aria-hidden': 'true' }), tr.t(carte ? 'boussole_methode_carte' : 'boussole_methode_reelle'));
    })));
  });
  document.querySelector('.feuille [aria-checked="true"]')?.focus();
}

function choisirAffichageBoussole() {
  feuille(tr.t('boussole_affichage'), (f, fermer) => {
    f.append(h('div', { role: 'radiogroup', 'aria-label': tr.t('boussole_affichage') }, [false, true].map((rose) => {
      const courant = store.boussoleRose() === rose;
      return h('button', {
        type: 'button', class: 'choix choix-radio', role: 'radio', 'aria-checked': String(courant),
        onclick: () => { fermer(); if (!courant) { store.setBoussoleRose(rose); rendre(); } },
      }, h('span', { class: 'radio', 'aria-hidden': 'true' }), tr.t(rose ? 'boussole_affichage_rose' : 'boussole_affichage_hassid'));
    })));
  });
  document.querySelector('.feuille [aria-checked="true"]')?.focus();
}

// --- Les zmanim en vol (VolActivity, 28/10) : vol.js, hors ligne --------------------------
let aeroportsVol = null;
let aeroportsDemandes = false;
function chargeAeroports() {
  if (aeroportsVol) return true;
  if (!aeroportsDemandes) {
    aeroportsDemandes = true;
    Promise.all(['data/aeroports.json', 'data/aeroports_noms.json'].map((u) => fetch(u).then((r) => r.json())))
      .then(([d, n]) => { aeroportsVol = Vol.aeroports(d, n); rendre(); }).catch(() => {});
  }
  return false;
}
/** Le formulaire en cours : { numero, depart, arrivee, decollage, atterrissage } ; repris du vol gardé. */
let saisieVol = null;
/** Le dernier calcul et la saisie qui l'a produit (deux passes de vol.js : on ne recalcule pas à chaque rendu). */
let calculVol = null;
let cleCalculVol = null;
let minuterieVol = null;
/** Le formulaire déplié pour modifier le vol calculé ; replié en résumé sinon (VolActivity.modifier). */
let modifierVol = false;

const libelleVol = (v) => tr.t('vol_carte_vol', v.numero || '✈', v.depart, v.arrivee);

/** L'accès depuis l'onglet Zmanim : le dernier vol saisi, ou l'invitation à en saisir un. */
function carteVol() {
  const v = store.vol();
  return h('div', { class: 'carte' }, h('button', { class: 'ligne', onclick: () => ouvrir('vol') },
    h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('vol_title')),
      h('div', { class: 'etat' }, v ? libelleVol(v) : tr.t('vol_carte_sous'))),
    h('span', { class: 'chevron', 'aria-hidden': 'true' })));
}

function planDe(v) {
  const depart = aeroportsVol.find((a) => a.iata === v.depart);
  const arrivee = aeroportsVol.find((a) => a.iata === v.arrivee);
  if (!depart || !arrivee || !v.decollage || !v.atterrissage) return null;
  const decollage = Vol.instant(v.decollage, depart);
  const atterrissage = Vol.instant(v.atterrissage, arrivee);
  const releve = v.releve ? { latitude: v.releve.latitude, longitude: v.releve.longitude, instant: new Date(v.releve.instant) } : null;
  return decollage && atterrissage ? { numero: v.numero ?? '', depart, arrivee, decollage, atterrissage, releve, sourceReleve: v.releve?.source ?? 'gps' } : null;
}

function choisirAeroport(onChoisi) {
  feuille(tr.t('vol_choisir_aeroport'), (f, fermer) => {
    const liste = h('div', { class: 'liste-aeroports' });
    const champ = h('input', { type: 'search', class: 'champ-recherche', placeholder: tr.t('vol_chercher'), oninput: (e) => {
      const trouves = Vol.chercher(aeroportsVol, e.target.value);
      liste.replaceChildren(...(trouves.length || !e.target.value.trim() ? trouves.map((a) => h('button', {
        class: 'choix', onclick: () => { fermer(); onChoisi(a); },
      }, `${a.iata} · ${a.ville} — ${Vol.nomLocal(a, tr.langue)} (${a.pays})`)) : [h('p', { class: 'message' }, tr.t('vol_aucun_resultat'))]));
    } });
    f.append(champ, liste, h('button', { class: 'secondaire', onclick: fermer }, tr.t('vol_fermer')));
  });
}

/**
 * « mar. 10 · 18:42 TLV · 11:42 JFK » : l'heure du départ et celle de l'arrivée, le jour s'il change
 * (VolActivity.deuxHeures). Seuls « heure code » sont isolés de gauche à droite : le jour reste dans
 * le sens de la langue.
 */
function deuxHeures(plan, t) {
  const jour = (fuseau) => new Intl.DateTimeFormat(tr.langue, { timeZone: fuseau, weekday: 'short', day: 'numeric' }).format(t);
  const heure = (a) => `\u2066${new Intl.DateTimeFormat(tr.langue, { timeZone: a.fuseau, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t)} ${a.iata}\u2069`;
  const civil = (fuseau) => new Intl.DateTimeFormat('en-CA', { timeZone: fuseau }).format(t);
  const autreJour = civil(plan.arrivee.fuseau) !== civil(plan.depart.fuseau);
  return `${jour(plan.depart.fuseau)} ${heure(plan.depart)} · ${autreJour ? `${jour(plan.arrivee.fuseau)} ` : ''}${heure(plan.arrivee)}`;
}

/** « 10 minutes », « 1 minute », « 1 h 11 min », « 2 h » : le compte à rebours en toutes lettres. */
function dureeEnMots(minutes) {
  if (minutes < 60) return minutes === 1 ? tr.t('vol_duree_une_minute') : tr.t('vol_duree_minutes', String(minutes));
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? tr.t('vol_duree_heures_minutes', String(h), String(m)) : tr.t('vol_duree_heures', String(h));
}

/** « mer. 28 19:20 TLV » : l'heure locale d'un aéroport (celle du billet). */
const heureAeroport = (a, t) => `${new Intl.DateTimeFormat(tr.langue, { timeZone: a.fuseau, weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t)} ⁦${a.iata}⁩`;

const ecartVol = (ms) => tr.t(calculVol && calculVol.fiabilite !== 'route_prevue' ? 'vol_ecart_gps' : 'vol_ecart', `${ms < 0 ? '−' : '+'}${Math.abs(Math.round(ms / 60000))}`);

/**
 * La route d'un numéro de vol (VolActivity.chercherRoute) : adsbdb.com, au toucher seulement. Remplit
 * l'arrivée (et le départ s'il est vide) et l'indicatif du suivi en direct ; les heures restent à saisir.
 */
let routeVol = { attente: false, texte: '' };

/** La loupe (VolActivity.loupe) : services en ligne éteints, on demande d'abord, une fois, ce qui partira. */
function loupeVol(v) {
  if (store.suiviDirect()) return chercherRouteVol(v);
  feuille(tr.t('vol_en_ligne_titre'), (f, fermer) => f.append(
    h('p', {}, tr.t('vol_en_ligne_aide')),
    h('button', { class: 'principal', onclick: () => { fermer(); store.setSuiviDirect(true); chercherRouteVol(v); } }, tr.t('vol_en_ligne_oui')),
    h('button', { class: 'lien-discret', onclick: fermer }, tr.t('vol_fermer'))));
}

/** La saisie rapide (VolActivity.carteRapide) : une phrase, ou le texte collé du billet. */
let phraseVol = '';
let rapideVol = null;
function carteRapideVol(v, pret, calculer) {
  const champ = h('textarea', { class: 'champ-recherche champ-vol saisie-rapide', rows: 2, placeholder: tr.t('vol_rapide_exemple'),
    oninput: (e) => { phraseVol = e.target.value; } });
  champ.value = phraseVol;
  const remplir = async () => {
    if (!pret) return;
    const p = Vol.lirePhrase(phraseVol, aeroportsVol, isoLocal(new Date()));
    if (Vol.phraseVide(p)) { rapideVol = tr.t('vol_rapide_rien'); return rendre(); }
    if (p.numero) v.numero = p.numero;
    if (p.depart) v.depart = p.depart;
    if (p.arrivee) v.arrivee = p.arrivee;
    const jour = p.date ?? v.decollage?.slice(0, 10);
    if (jour && p.heureDepart) v.decollage = `${jour}T${p.heureDepart}`;
    let estimee = false;
    const a = aeroportsVol.find((x) => x.iata === v.depart);
    const b = aeroportsVol.find((x) => x.iata === v.arrivee);
    if (a && b && v.decollage) {
      const i1 = Vol.instant(v.decollage, a);
      if (i1 && p.heureArrivee) {
        // L'arrivée donnée : le premier jour où elle tombe après le départ (vol de nuit).
        let j = p.dateArrivee ?? jour ?? v.decollage.slice(0, 10);
        for (let n = 0; n < 3; n++) {
          const i2 = Vol.instant(`${j}T${p.heureArrivee}`, b);
          if (i2 && i2 > i1) break;
          const d = new Date(`${j}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); j = d.toISOString().slice(0, 10);
        }
        v.atterrissage = `${j}T${p.heureArrivee}`;
      } else if (i1) {
        const t = new Date(+i1 + Vol.dureeEstimee(a, b));
        const q = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: b.fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
          .formatToParts(t).map((x) => [x.type, x.value]));
        v.atterrissage = `${q.year}-${q.month}-${q.day}T${q.hour}:${q.minute}`;
        estimee = true;
      }
    }
    const compris = [p.numero ?? p.compagnie, v.depart || v.arrivee ? `${v.depart ?? '?'} → ${v.arrivee ?? '?'}` : null,
      v.decollage ? v.decollage.replace('T', ' · ') : p.date].filter(Boolean).join(' · ');
    const manque = [!v.depart && tr.t('vol_depart'), !v.arrivee && tr.t('vol_arrivee'), !v.decollage && tr.t('vol_rapide_heure')].filter(Boolean);
    rapideVol = [tr.t('vol_rapide_compris', compris), estimee ? tr.t('vol_rapide_estimee') : null,
      manque.length ? tr.t('vol_rapide_manque', manque.join(', ')) : null].filter(Boolean).join('\n');
    if (v.numero && (!v.depart || !v.arrivee)) { rendre(); return loupeVol(v); }
    if (v.depart && v.arrivee && v.decollage && v.atterrissage) return calculer();
    rendre();
  };
  return h('div', { class: 'carte carte-texte carte-rapide' },
    h('p', { class: 'vol-rapide-titre' }, tr.t('vol_rapide_titre')),
    h('p', { class: 'indice' }, tr.t('vol_rapide_aide')),
    champ,
    h('button', { class: 'principal', onclick: remplir }, tr.t('vol_rapide_remplir')),
    rapideVol ? h('p', { class: 'vol-rapide-compris', 'aria-live': 'polite' }, rapideVol) : null);
}

async function chercherRouteVol(v) {
  // Services en ligne désactivés (02/11) : pas de loupe, et la garde tient même si elle réapparaissait.
  if (!store.suiviDirect()) return;
  if (!Vol.normaliserNumero(v.numero || '')) { routeVol = { attente: false, texte: tr.t('vol_route_invalide') }; return rendre(); }
  routeVol = { attente: true, texte: '' };
  rendre();
  const r = await Vol.chercherRoute(v.numero, v.depart);
  const connu = (iata) => aeroportsVol?.some((a) => a.iata === iata);
  let texte;
  if (r.statut === 'trouve') {
    const manquant = [r.de, r.vers].find((x) => !connu(x));
    if (manquant) texte = tr.t('vol_route_inconnue', manquant);
    else {
      v.depart = r.de;
      v.arrivee = r.vers;
      texte = tr.t('vol_route_trouvee', v.numero.toUpperCase(), r.compagnie, r.de, r.vers);
    }
    if (r.indicatif) store.setVolIndicatif(r.indicatif);
  } else if (r.statut === 'autre_depart') texte = tr.t('vol_route_autre_depart', v.numero.toUpperCase(), r.escales.join(' → '), v.depart);
  else if (r.statut === 'introuvable') texte = tr.t('vol_route_introuvable');
  else if (r.statut === 'invalide') texte = tr.t('vol_route_invalide');
  else texte = tr.t('vol_route_erreur', raisonVol(r.raison));
  routeVol = { attente: false, texte };
  rendre();
}

/** Une raison de Vol.Raison, dans la langue de l'interface (VolActivity.raisonLisible). */
function raisonVol(raison) {
  const code = Vol.Raison.codeServeur(raison);
  if (code !== null) return tr.t('vol_erreur_serveur', code);
  return tr.t({
    [Vol.Raison.HORS_LIGNE]: 'vol_erreur_hors_ligne', [Vol.Raison.QUOTA]: 'vol_erreur_quota',
    [Vol.Raison.ILLISIBLE]: 'vol_erreur_illisible', [Vol.Raison.POSITION_INVALIDE]: 'vol_erreur_position',
    [Vol.Raison.RELAIS_ABSENT]: 'vol_erreur_relais_absent',
  }[raison] ?? 'vol_erreur_service');
}

/** Le GPS du téléphone, par le navigateur (VolActivity.releverGps) : 90 s au plus, sans réseau. */
let gpsVol = false;
/** La position en direct par le relais (VolActivity.demanderDirect) : seulement pendant le vol prévu. */
let directVol = false;
async function demanderDirect(indicatif) {
  const garde = store.vol();
  const plan = garde && planDe(garde);
  if (!plan) return;
  const maintenant = new Date();
  if (+maintenant < +plan.decollage || +maintenant > +plan.atterrissage) return signale(tr.t('vol_gps_hors_vol'));
  directVol = true;
  rendre();
  const r = await Vol.positionEnDirect(RELAIS_VOL, indicatif, Vol.position(plan, maintenant));
  directVol = false;
  if (r.statut === 'trouve') {
    const releve = { latitude: r.point.latitude, longitude: r.point.longitude, instant: r.point.instant.toISOString(), source: 'direct' };
    if (!Vol.releveUtilisable({ ...plan, releve: r.point })) { rendre(); return signale(tr.t('vol_gps_hors_vol')); }
    store.setVol({ ...garde, releve });
  } else signale(r.statut === 'introuvable' ? tr.t('vol_direct_introuvable') : tr.t('vol_direct_erreur', raisonVol(r.raison)));
  rendre();
}

/**
 * L'interrupteur des services en ligne (02/11, VolActivity.ajouterInterrupteurEnLigne) : un seul,
 * désactivé par défaut, pour la route d'un numéro (adsbdb) et le suivi en direct (OpenSky).
 */
let formulaireVolOuvert = true;
const interrupteurEnLigne = () => h('label', { class: 'ligne' }, h('span', { class: 'corps' }, h('div', { class: 'nom' }, tr.t('vol_direct_activer'))),
  h('input', { type: 'checkbox', role: 'switch', class: 'interrupteur', checked: store.suiviDirect(), onchange: (e) => { store.setSuiviDirect(e.target.checked); rendre(); } }));

/** Le suivi en direct : l'interrupteur des services en ligne, qui dit ce qui part ; l'indicatif ; le bouton. */
function suiviDirect() {
  const actif = store.suiviDirect();
  // Formulaire ouvert, l'interrupteur y est déjà : pas de second exemplaire ici.
  // L'interrupteur n'est plus dans le formulaire (04/11) : il vit ici, sous « Préciser la position ».
  const bloc = [interrupteurEnLigne()];
  if (!actif) return bloc;
  if (!RELAIS_VOL) return [...bloc, h('p', { class: 'indice' }, tr.t('vol_direct_inactif'))];
  const champ = h('input', { type: 'text', class: 'champ-recherche champ-vol', maxlength: 9, autocapitalize: 'characters', placeholder: tr.t('vol_indicatif'), value: store.volIndicatif() || null });
  return [...bloc, champ,
    h('button', { class: 'secondaire', disabled: directVol, onclick: () => {
      const indicatif = Vol.normaliserIndicatif(champ.value);
      if (!indicatif) return signale(tr.t('vol_indicatif_invalide'));
      store.setVolIndicatif(indicatif);
      demanderDirect(indicatif);
    } }, tr.t(directVol ? 'vol_direct_attente' : 'vol_direct_bouton')),
    h('p', { class: 'indice' }, tr.t('vol_source_opensky'))];
}

function releverGps() {
  const garde = store.vol();
  if (!garde || !navigator.geolocation) return signale(tr.t('vol_gps_echec'));
  gpsVol = true;
  rendre();
  navigator.geolocation.getCurrentPosition((p) => {
    gpsVol = false;
    const releve = { latitude: p.coords.latitude, longitude: p.coords.longitude, instant: new Date(p.timestamp).toISOString(), source: 'gps' };
    const plan = planDe({ ...garde, releve });
    if (!plan || !Vol.releveUtilisable(plan)) { rendre(); return signale(tr.t('vol_gps_hors_vol')); }
    store.setVol({ ...garde, releve });
    rendre();
  }, (e) => {
    gpsVol = false;
    rendre();
    signale(tr.t(e.code === 1 ? 'vol_gps_refuse' : 'vol_gps_echec'));
  }, { enableHighAccuracy: true, timeout: 90000, maximumAge: 0 });
}

function positionVol(e) {
  const n = (x) => Math.abs(x).toLocaleString(tr.langue, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return tr.t('vol_position', tr.t(e.latitude >= 0 ? 'vol_lat_nord' : 'vol_lat_sud', n(e.latitude)),
    tr.t(e.longitude >= 0 ? 'vol_lon_est' : 'vol_lon_ouest', n(e.longitude)));
}

/** Ce qui, en changeant, demande de redessiner l'écran du vol : la prière, sa limite, la place de « maintenant ». */
function signatureVol(c = calculVol, maintenant = new Date()) {
  if (!c) return null;
  const p = Vol.priere(c, maintenant);
  const place = Vol.enVol(c).findIndex((e) => maintenant < e.instant);
  return `${p?.[0]}|${p?.[1] ? +p[1] : ''}|${place}`;
}
let signatureVolAffichee = null;

function texteCompteVol(c = calculVol, maintenant = new Date()) {
  const limite = c ? Vol.priere(c, maintenant)?.[1] : null;
  return limite ? tr.t('vol_dans', dureeEnMots(Math.max(0, Math.floor((limite - maintenant) / 60000)))) : null;
}

function resultatsVol(c) {
  const maintenant = new Date();
  signatureVolAffichee = signatureVol(c, maintenant);
  const p = Vol.priere(c, maintenant);
  const NOMS = { chaharit: 'widget_zmanim_chaharit', minha: 'widget_zmanim_minha', arvit: 'widget_zmanim_arvit' };
  const enVol = Vol.enVol(c);
  let priere;
  if (!p) priere = [h('p', { class: 'message' }, tr.t('vol_hors_fenetre'))];
  else {
    const [nom, limite] = p;
    const minutes = limite ? Math.max(0, Math.floor((limite - maintenant) / 60000)) : 0;
    const ecart = limite ? enVol.find((e) => +e.instant === +limite)?.ecartSiRetard : null;
    priere = [h('p', { class: 'vol-priere' }, tr.t(NOMS[nom])),
      limite ? h('p', {}, tr.t('vol_jusqua', deuxHeures(c.plan, limite))) : h('p', {}, tr.t('vol_sans_limite')),
      limite ? h('p', { class: 'vol-compte' }, tr.t('vol_dans', dureeEnMots(minutes))) : null,
      ecart !== null && ecart !== undefined ? h('p', { class: 'indice' }, ecartVol(ecart)) : null];
  }
  const RESERVES = ['haute_latitude', 'absent', 'erreur', 'a_rebours'];
  const date = (iso) => new Intl.DateTimeFormat(tr.langue, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00Z`));
  return [
    // La carte prend le ciel de son heure (04/11) : aube, après-midi, nuit.
    h('div', { class: `carte carte-texte carte-vol carte-heros ciel-${p ? p[0] : 'hors'}` }, h('p', { class: 'indice' }, tr.t('vol_priere_titre')), ...priere),
    h('div', { class: 'carte carte-texte carte-vol' },
      // La route prévue tient en une étiquette ; le détail du calcul se déplie.
      c.fiabilite === 'route_prevue' ? h('p', { class: 'vol-etiquette' }, tr.t('vol_fiabilite_court'))
        : h('p', {}, tr.t(c.fiabilite === 'releve_direct' ? 'vol_fiabilite_direct' : 'vol_fiabilite_gps', deuxHeures(c.plan, c.plan.releve.instant), positionVol(c.plan.releve))),
      h('details', { class: 'vol-details' }, h('summary', {}, tr.t('vol_comment_calcule')), h('p', {}, tr.t('vol_fiabilite'))),
      h('p', { class: 'vol-sous-titre' }, tr.t('vol_preciser_titre')),
      h('button', { class: 'secondaire', disabled: gpsVol, onclick: releverGps }, tr.t(gpsVol ? 'vol_gps_attente' : 'vol_gps')),
      c.plan.releve ? h('button', { class: 'lien-discret', onclick: () => { const g = store.vol(); delete g.releve; store.setVol(g); rendre(); } }, tr.t('vol_gps_oublier')) : null,
      ...suiviDirect(),
      ...RESERVES.filter((r) => c.reserves.has(r)).map((r) => h('p', {}, tr.t(`vol_reserve_${r}`))),
      ...c.lignesDate.map((l) => h('p', {}, tr.t('vol_ligne_date', deuxHeures(c.plan, l.instant), date(l.avant), date(l.apres))))),
    friseVol(c, enVol, maintenant),
    carteJalons(c),
  ];
}

/**
 * La frise du vol (VolActivity.frise) : du décollage à l'atterrissage, un point par zman, coloré
 * selon le ciel (nuit, aube, jour, crépuscule), et « maintenant » à sa place. L'écart en cas de
 * retard se dit une fois en tête ; sur une ligne seulement s'il s'en écarte de 5 min ou plus.
 */
const CIEL = { chatsot_layla: 'nuit', tset: 'nuit', tset_rt: 'nuit', alot: 'aube', misheyakir: 'aube', netz: 'aube', chkia: 'crepuscule' };
/** Les icônes de la frise, au trait, dans la couleur de leur ciel (currentColor). */
const ICONES_FRISE = {
  nuit: '<path d="M15.5 4.5a7.5 7.5 0 1 0 4 13.2A8 8 0 0 1 15.5 4.5Z" fill="currentColor"/>',
  aube: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 4v5M9.5 6.5 12 4l2.5 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  jour: '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  crepuscule: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 4v5M9.5 6.5 12 9l2.5-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  avion: '<path d="M21 15.5v-2l-8-5V3.8a1.3 1.3 0 0 0-2.6 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.3-1 3.3 1v-1.5l-2-1.5v-5Z" fill="currentColor"/>',
};
function iconeFrise(nom) {
  const e = h('span', { class: 'frise-puce', 'aria-hidden': 'true' });
  e.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20">${ICONES_FRISE[nom]}</svg>`;
  return e;
}
function friseVol(c, enVol, maintenant) {
  if (!enVol.length) return h('div', { class: 'carte carte-zmanim' }, h('p', { class: 'indice' }, tr.t('vol_en_vol_titre')), h('p', { class: 'message' }, tr.t('vol_aucun_zman')));
  const ecarts = enVol.map((e) => e.ecartSiRetard).filter((x) => x !== null).sort((a, b) => a - b);
  const median = ecarts.length ? ecarts[Math.floor(ecarts.length / 2)] : null;
  const deux = (t) => {
    const [a, b] = deuxHeures(c.plan, t).split(' · ');
    return h('div', { class: 'frise-heure' }, h('strong', {}, a), b ? h('span', {}, `· ${b}`) : null);
  };
  const point = (ciel, nom, t, detail = null) => h('li', { class: `frise-point frise-${ciel}` },
    iconeFrise(ciel === 'bout' ? 'avion' : ciel), h('div', { class: 'frise-corps' }, h('div', { class: 'frise-nom' }, nom), deux(t), detail));
  const lignes = [point('bout', tr.t('vol_frise_decollage', c.plan.depart.iata), c.plan.decollage)];
  let maintenantPlace = +maintenant < +c.plan.decollage || +maintenant > +c.plan.atterrissage;
  for (const e of enVol) {
    if (!maintenantPlace && +maintenant < +e.instant) {
      lignes.push(h('li', { class: 'frise-point frise-maintenant' }, h('span', { class: 'frise-puce', 'aria-hidden': 'true' }), h('div', { class: 'frise-corps' }, h('div', { class: 'frise-nom' }, tr.t('vol_frise_maintenant')))));
      maintenantPlace = true;
    }
    const ecart = e.ecartSiRetard !== null && median !== null && Math.abs(e.ecartSiRetard - median) >= 5 * 60000 ? ecartVol(e.ecartSiRetard) : null;
    lignes.push(point(CIEL[e.cle] ?? 'jour', tr.t(`zman_${e.cle}`), e.instant,
      h('div', { class: 'frise-detail' }, [positionVol(e), ecart].filter(Boolean).join(' · '))));
  }
  lignes.push(point('bout', tr.t('vol_frise_atterrissage', c.plan.arrivee.iata), c.plan.atterrissage));
  return h('div', { class: 'carte carte-texte carte-vol' }, h('p', { class: 'indice' }, tr.t('vol_en_vol_titre')),
    median !== null ? h('p', { class: 'frise-retard' }, tr.t('vol_frise_retard')) : null,
    h('ol', { class: 'frise' }, ...lignes));
}

/** Chabbat, fêtes et Omer sur la route (VolActivity.carteJalons) : des heures, sans conseil. */
function carteJalons(c) {
  const minutes = store.allumage();
  const jalons = Vol.jalons(c, store.inIsrael(), minutes);
  if (!jalons.length) return null;
  const libelle = (f) => { try { return tr.t(`fete_${f}`); } catch { return null; } };
  return h('div', { class: 'carte carte-texte carte-vol' }, h('p', { class: 'indice' }, tr.t('vol_jalons_titre')),
    ...jalons.flatMap((j) => {
      const nom = [j.chabbat ? tr.t('vol_chabbat') : null, ...j.fetes.map(libelle)].filter(Boolean).join(' · ');
      const heure = deuxHeures(c.plan, j.instant);
      const texte = j.type === 'omer' ? tr.t('vol_jalon_omer', String(j.omer), heure) : tr.t(`vol_jalon_${j.type}`, nom, heure);
      return [h('p', { class: 'vol-jalon' }, texte),
        j.allumage ? h('p', {}, tr.t('vol_jalon_allumage', String(minutes), deuxHeures(c.plan, j.allumage))) : null,
        h('p', { class: 'indice' }, positionVol(j))];
    }),
    h('p', { class: 'indice' }, tr.t('vol_jalons_note', tr.t(store.inIsrael() ? 'vol_jalons_israel' : 'vol_jalons_diaspora'))));
}

function ecranVol() {
  // La prière du moment et son compte à rebours suivent l'heure : un rendu toutes les 30 s,
  // sauf pendant une saisie (le champ garderait le clavier).
  if (!minuterieVol) {
    minuterieVol = setInterval(() => {
      if (ecranCourant() !== 'vol') { clearInterval(minuterieVol); minuterieVol = null; return; }
      if (document.querySelector('.voile') || app.contains(document.activeElement?.closest('input'))) return;
      // Seul le compte à rebours change d'ordinaire (04/11) : on récrit son texte. L'écran entier
      // n'est redessiné que si la prière ou la place de « maintenant » change — sinon la page sautait.
      const sig = signatureVol();
      const compte = app.querySelector('.vol-compte');
      if (sig === signatureVolAffichee && compte) compte.textContent = texteCompteVol() ?? compte.textContent;
      else rendre();
    }, 30000);
  }
  const pret = chargeAeroports();
  saisieVol ??= { ...(store.vol() ?? { numero: '', depart: null, arrivee: null, decollage: '', atterrissage: '' }) };
  delete saisieVol.releve;
  const v = saisieVol;
  const garde = store.vol();
  if (pret && garde && cleCalculVol !== JSON.stringify(garde)) {
    const plan = planDe(garde);
    calculVol = plan && !Vol.verifier(plan) ? Vol.calculer(plan) : null;
    cleCalculVol = JSON.stringify(garde);
  }
  const nomA = (iata) => {
    const a = pret && iata ? aeroportsVol.find((x) => x.iata === iata) : null;
    return a ? `${a.iata} · ${a.ville || a.nom}` : tr.t('vol_choisir_aeroport');
  };
  const villeA = (iata) => (pret ? aeroportsVol.find((x) => x.iata === iata) : null)?.ville || iata;
  const message = (cle) => feuille(tr.t('vol_title'), (f, fermer) => f.append(h('p', {}, tr.t(cle)), h('button', { class: 'principal', onclick: fermer }, tr.t('vol_fermer'))));
  const calculer = () => {
    if (!v.depart || !v.arrivee || !v.decollage || !v.atterrissage) return message('vol_incomplet');
    const plan = planDe(v);
    if (!plan) return message('vol_invalide_fuseau_inconnu');
    const faute = Vol.verifier(plan);
    if (faute) return message(`vol_invalide_${faute}`);
    // Le même vol, calculé à nouveau, garde son relevé GPS ; un autre vol l'efface (Store.setVol).
    const memeVol = garde && ['depart', 'arrivee', 'decollage', 'atterrissage'].every((k) => garde[k] === v[k]);
    const { releve, ...saisie } = v;
    store.setVol(memeVol && garde.releve ? { ...saisie, releve: garde.releve } : saisie);
    modifierVol = false;
    rendre();
  };
  const ligne = (etiquette, valeur, onclick) => h('button', { class: 'ligne', onclick },
    h('span', { class: 'corps' }, h('div', { class: 'etat' }, etiquette), h('div', { class: 'nom' }, valeur)), h('span', { class: 'chevron', 'aria-hidden': 'true' }));
  const heure = (cle, etiquette) => h('label', { class: 'ligne' },
    h('span', { class: 'corps' }, h('div', { class: 'etat' }, etiquette),
      h('input', { type: 'datetime-local', class: 'champ-recherche champ-vol', value: v[cle] || null, onchange: (e) => { v[cle] = e.target.value; } })));
  const champNumero = h('input', { type: 'text', class: 'champ-recherche champ-vol', maxlength: 12, autocapitalize: 'characters', value: v.numero || null, onchange: (e) => { v.numero = e.target.value.trim(); } });
  // La loupe au bout du champ cherche la route du numéro (adsbdb) ; une ligne dit ce qui part.
  const loupe = h('button', { class: 'loupe-vol', type: 'button', disabled: routeVol.attente, 'aria-label': tr.t('vol_route_bouton'), title: tr.t('vol_route_bouton'),
    onclick: () => { v.numero = champNumero.value.trim(); loupeVol(v); } });
  loupe.innerHTML = routeVol.attente ? '<span class="loupe-attente" aria-hidden="true"></span>'
    : '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  // La loupe est toujours là (04/11) ; services en ligne éteints, elle demande d'abord l'accord.
  const formulaire = h('div', { class: 'carte' },
    h('label', { class: 'ligne' }, h('span', { class: 'corps' }, h('div', { class: 'etat' }, tr.t('vol_numero')),
      h('span', { class: 'champ-et-loupe' }, champNumero, loupe))),
    routeVol.texte || routeVol.attente ? h('p', { class: 'indice', 'aria-live': 'polite' }, routeVol.texte || tr.t('vol_route_attente')) : null,
    ligne(tr.t('vol_depart'), nomA(v.depart), () => pret && choisirAeroport((a) => { v.depart = a.iata; rendre(); })),
    ligne(tr.t('vol_arrivee'), nomA(v.arrivee), () => pret && choisirAeroport((a) => { v.arrivee = a.iata; rendre(); })),
    v.depart ? heure('decollage', tr.t('vol_decollage', villeA(v.depart))) : null,
    v.arrivee ? heure('atterrissage', tr.t('vol_atterrissage', villeA(v.arrivee))) : null,
    h('button', { class: 'principal', onclick: calculer }, tr.t('vol_calculer')),
    h('button', { class: 'lien-discret', onclick: () => { store.setVol(null); saisieVol = null; calculVol = null; cleCalculVol = null; modifierVol = false; rendre(); } }, tr.t('vol_effacer')));
  // Le vol calculé se résume en une carte ; « Modifier » rouvre le formulaire.
  const planGarde = pret && garde ? planDe(garde) : null;
  const resume = planGarde && calculVol && !modifierVol ? h('div', { class: 'carte vol-resume' },
    h('div', { class: 'vol-resume-tete' }, h('span', { class: 'vol-resume-titre' }, libelleVol(garde)),
      h('button', { class: 'lien-bouton', onclick: () => { modifierVol = true; rendre(); } }, tr.t('vol_modifier'))),
    // Chaque heure isolée, la flèche dans le sens de lecture (← en hébreu).
    h('p', { class: 'vol-resume-heures' }, `\u2068${heureAeroport(planGarde.depart, planGarde.decollage)}\u2069 ${tr.rtl ? '←' : '→'} \u2068${heureAeroport(planGarde.arrivee, planGarde.atterrissage)}\u2069`)) : null;
  formulaireVolOuvert = !resume;
  const puce = h('span', { class: 'puce-bandeau' }, garde ? libelleVol(garde) : tr.t('vol_carte_sous'));
  return h('div', { class: 'ecran avec-bandeau' }, bandeau(tr.t('vol_title'), { puce, dessin: 'scene_airport' }),
    h('div', { class: 'defile' }, h('div', { class: 'contenu' },
      ...(resume ? [resume] : [carteRapideVol(v, pret, calculer), formulaire]),
      ...(garde && !pret ? [h('div', { class: 'carte carte-texte' }, h('p', { class: 'message' }, tr.t('vol_calcul_en_cours')))] : []),
      ...(garde && calculVol ? resultatsVol(calculVol) : []),
      // La méthode, les aéroports, les routes : repliés sous « Sources ».
      h('details', { class: 'sources-vol' }, h('summary', {}, tr.t('vol_sources')),
        ...piedZmanim().slice(0, 1),
        h('p', { class: 'indice sources' }, tr.t('vol_source_aeroports')),
        h('p', { class: 'indice sources' }, tr.t('vol_source_adsbdb'))))));
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

const pratique = () => ({ minutes: store.minutesParJour(), notes: store.nombreNotes(), meilleureSerie: store.meilleureSerie(), tikkun: store.tikkunJournal() });

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
      // L'étoile du grade du ton sombre du métal (elle était noire, faute de couleur ; 04/11).
      : el('text', { x: ex, y: ey, 'font-size': et, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: sombre, opacity: metal ? '1' : '.45' }, icone));
}

// --- Les trophées : outils partagés par l'écran, l'accueil et le bilan (16/10) ---------------
const dessinTrophee = (e, m, taille) => objetTrophee(e.f.forme, m, e.f.icone, taille);
const descTrophee = (e) => tr.p(`trophee_${e.f.cle}_desc`, e.seuil);
const nomMetal = (m) => tr.t(`metal_${m}`);
const medailleGrade = (m, taille) => h('span', { class: 'medaille-grade', 'aria-hidden': 'true' }, objetTrophee('medaille', m, '★', taille));
const moinsAnime = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** Le jour de gain de chaque trophée gagné (Trophees.datesGain) : l'historique rejoué. */
function datesTrophees() {
  return Trophees.datesGain(store.minutesParJour(), store.joursAvecNote(), (d) => store.isExempt(d), store.tikkunJournal());
}
/** La date civile en toutes lettres, avec le jour (VueJour.dateCivile) : « mardi 29 septembre 2026 ». */
const dateCivile = (iso) => new Intl.DateTimeFormat(tr.langue, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
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
/** Un Tikoun fini peut gagner un trophée (04/11) : fêté tout de suite, comme à l'accueil. */
function feterTikkun() {
  const gagnes = Trophees.gagnes(pratique());
  const neufs = Trophees.nouveaux(gagnes, store.tropheesVus());
  if (!neufs.length) return;
  store.setTropheesVus(new Set(gagnes));
  setTimeout(() => feterTrophees(neufs), 400);
}

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
  // Le prochain a déjà sa carte « Tu es ici » : pas deux fois le même (04/11).
  const prochainCle = Trophees.prochain(p)?.cle;
  const proches = Trophees.plusProches(p, 4).filter((e) => e.cle !== prochainCle).slice(0, 3);
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
  const ecran = h('div', { class: 'ecran avec-bandeau ecran-trophees' }, bandeau(tr.t('trophees_paliers_titre'), { dessin: 'char_open_arms' }),
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
        // La région (02/11, SettingsActivity.region_button) : déduite du lieu, et corrigeable à la main.
        ligne({ nom: tr.t('settings_region'), etat: tr.t(store.inIsrael() ? 'region_israel' : 'region_diaspora'),
          onclick: () => choisirDans(tr.t('settings_region'), [tr.t('region_israel'), tr.t('region_diaspora')], store.inIsrael() ? 0 : 1,
            (j) => { store.setInIsrael(j === 0); rendre(); }) }),
        // À Jérusalem, l'usage des 40 minutes est proposé, jamais imposé.
        ligne({ nom: tr.t('reglage_allumage'), onclick: choisirAllumage,
          etat: [libelleAllumage(store.allumage()), mukafChoma() && store.allumage() !== 40 ? tr.t('reglage_allumage_proposition') : null].filter(Boolean).join(' · ') }),
        store.siddurNusah() === 'sefard' ? ligne({ nom: tr.t('reglage_tahanoun_tichri'), onclick: choisirTahanounTichri,
          etat: tr.t(store.sansTahanounFinTichri() ? 'reglage_tahanoun_tichri_sans' : 'reglage_tahanoun_tichri_dit') }) : null),
      carteMaPratique(),
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
      carteDedicace(),
      carteMesDonnees(),
      h('div', { class: 'carte' }, ligne({ nom: tr.t('settings_onboarding'), onclick: presentation })),
      // Réinitialiser l'application (12/10) : en dernier, avec une confirmation.
      h('div', { class: 'carte carte-reinit' },
        h('h3', {}, tr.t('reset_title')),
        h('p', { class: 'indice' }, tr.t('reset_hint')),
        h('button', { class: 'bouton-danger', onclick: () => confirmer(tr.t('reset_confirm_title'), tr.t('reset_confirm_text'), tr.t('reset_confirm_yes'), () => {
          store.reinitialiser();
          location.replace(location.pathname);
        }) }, tr.t('reset_action'))),
      ligneVersion())));
}

// La ligne de version (02/11, SettingsActivity.app_version) : l'empreinte de la construction,
// celle de la coquille installée hors connexion (sw.js, « coquille-<version> »), sinon
// version.txt. Rien ne la montre tant qu'elle n'est pas lue.
let versionSite = null;
let versionDemandee = false;
function ligneVersion() {
  if (!versionDemandee) {
    versionDemandee = true;
    (async () => {
      try {
        const installee = (await globalThis.caches?.keys() ?? []).find((n) => n.startsWith('coquille-'));
        if (installee) return installee.slice('coquille-'.length);
      } catch { /* pas de cache : version.txt */ }
      const r = await fetch('version.txt', { cache: 'no-store' });
      return r.ok ? (await r.text()).trim() : null;
    })().then((v) => { if (/^[0-9a-f]{6,}$/.test(v ?? '')) { versionSite = v; if (ecranCourant() === 'reglages') rendre(); } })
      .catch(() => { versionDemandee = false; });
  }
  return versionSite ? h('p', { class: 'version-app' }, tr.t('app_version_web', versionSite)) : null;
}

/** Un interrupteur de réglage, avec son indice sous le nom. */
function ligneInterrupteur(nom, indice, coche, onChange) {
  return h('label', { class: 'ligne' },
    h('span', { class: 'corps' }, h('div', { class: 'nom' }, nom), indice ? h('div', { class: 'etat' }, indice) : null),
    h('input', { type: 'checkbox', role: 'switch', class: 'interrupteur', checked: coche, 'aria-label': nom,
      onchange: (e) => { onChange(e.target.checked); rendre(); } }));
}

/**
 * « Ma pratique » (02/11) : les réglages d'Android qui existaient déjà dans le stockage du site
 * sans rien pour les changer — prénom, adresse, objectif du jour, décompte, Chabbat, pause.
 */
function carteMaPratique() {
  // Le jour que l'interrupteur montre : laissé ouvert après minuit, il agit sur ce même jour (02/11).
  const jourAffiche = store.today();
  const adresses = ['m', 'f', null];
  const nomAdresse = (a) => tr.t(a === 'm' ? 'adresse_tsadik' : a === 'f' ? 'adresse_tsadeket' : 'adresse_none');
  return h('div', { class: 'carte' },
    h('h3', {}, tr.t('section_practice')),
    ligne({ nom: tr.t('settings_name'), etat: store.firstName() || tr.t('settings_name_empty'), onclick: () => {
      feuille(tr.t('settings_name'), (f, fermer) => {
        const champ = h('input', { type: 'text', value: store.firstName(), maxlength: 40, autocomplete: 'given-name', 'aria-label': tr.t('settings_name') });
        const valider = () => { store.setFirstName(champ.value); fermer(); rendre(); };
        champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });
        f.append(champ, h('p', { class: 'indice' }, tr.t('settings_name_hint')),
          h('div', { class: 'actions' }, h('button', { onclick: fermer }, tr.t('action_back')), h('button', { onclick: valider }, tr.t('action_save'))));
        setTimeout(() => champ.select(), 0);
      });
    } }),
    ligne({ nom: tr.t('settings_adresse'), etat: nomAdresse(store.adresse()),
      onclick: () => choisirDans(tr.t('settings_adresse'), adresses.map(nomAdresse), adresses.indexOf(store.adresse() ?? null),
        (j) => { store.setAdresse(adresses[j]); appliqueApparence(); rendre(); }) }),
    ligne({ nom: tr.t('settings_daily_goal'), etat: tr.duree(store.dailyGoal()),
      onclick: () => choisirDuree((m) => { store.setDailyGoal(m); rendre(); }, tr.t('settings_daily_goal')) }),
    h('p', { class: 'indice' }, tr.t('settings_daily_goal_hint')),
    ligneInterrupteur(tr.t('settings_hide_countdown'), null, store.hideCountdown(), (v) => store.setHideCountdown(v)),
    // La hitbodedout guidée (02/11, SettingsActivity.guided_switch) : éteinte par défaut.
    ligneInterrupteur(tr.t('settings_hitbodedut'), tr.t('settings_hitbodedut_hint'), store.guidedHitbodedut(), (v) => store.setGuidedHitbodedut(v)),
    ligneInterrupteur(tr.t('settings_shabbat'), tr.t('settings_shabbat_hint'), store.shabbatMode(), (v) => store.setShabbatMode(v)),
    ligneInterrupteur(tr.t('settings_exempt_today'), tr.t('settings_exempt_today_hint'), store.pausedDates().has(jourAffiche), () => store.togglePausedDate(jourAffiche)));
}

/**
 * « Mes données » (02/11) : la sauvegarde, au même format qu'Android (Store.exportJson). Un
 * fichier exporté du site s'importe sur le téléphone, et l'inverse.
 */
/** La dédicace (Dedicace.kt, 04/11) : la demande part à l'équipe, par la messagerie. */
function carteDedicace() {
  return h('div', { class: 'carte' },
    h('h3', {}, tr.t('section_dedicace')),
    h('p', { class: 'indice' }, tr.t('section_dedicace_hint')),
    h('div', { class: 'actions-donnees' },
      h('button', { type: 'button', class: 'principal', onclick: dedicacer }, tr.t('dedicace_bouton'))));
}

function dedicacer() {
  feuille(tr.t('section_dedicace'), (f, fermer) => {
    let objet = 0, intention = 0;
    const groupe = (titre, cles, courant, choisir) => {
      const boutons = cles.map((c, i) => h('button', { type: 'button', class: 'puce-choix', role: 'radio', 'aria-checked': String(i === courant),
        onclick: () => { choisir(i); boutons.forEach((b, j) => b.setAttribute('aria-checked', String(j === i))); } }, tr.t(c)));
      return [h('p', { class: 'message dedicace-legende' }, tr.t(titre)), h('div', { class: 'dedicace-choix', role: 'radiogroup', 'aria-label': tr.t(titre) }, boutons)];
    };
    const nom = h('input', { type: 'text', autocomplete: 'off', placeholder: tr.t('dedicace_nom'), 'aria-label': tr.t('dedicace_nom') });
    const mot = h('textarea', { rows: '2', placeholder: tr.t('dedicace_mot'), 'aria-label': tr.t('dedicace_mot') });
    const erreur = h('p', { class: 'indice dedicace-erreur', role: 'alert' });
    const ecrire = () => {
      if (!nom.value.trim()) { erreur.textContent = tr.t('dedicace_nom_manque'); nom.focus(); return; }
      const quoi = tr.t(Dedicace.OBJETS[objet]);
      const [, formule] = Dedicace.INTENTIONS[intention];
      const corps = Dedicace.corps(tr.t('dedicace_corps_intro'), tr.t('dedicace_corps_demande', quoi.charAt(0).toLowerCase() + quoi.slice(1)),
        formule, nom.value, mot.value, tr.t('dedicace_corps_fin'));
      fermer();
      location.href = Dedicace.lien(tr.t('dedicace_sujet', quoi), corps);
    };
    f.append(h('p', { class: 'indice' }, tr.t('section_dedicace_hint')),
      ...groupe('dedicace_quoi', Dedicace.OBJETS, objet, (i) => { objet = i; }),
      ...groupe('dedicace_pour', Dedicace.INTENTIONS.map(([c]) => c), intention, (i) => { intention = i; }),
      nom, mot, erreur,
      h('div', { class: 'actions' },
        h('button', { type: 'button', onclick: fermer }, tr.t('action_back')),
        h('button', { type: 'button', class: 'fort', onclick: ecrire }, tr.t('dedicace_ecrire'))));
  });
}

function carteMesDonnees() {
  const exporter = async () => {
    const nom = `myhitbodedut-${store.today()}.json`;
    // Installé sur l'écran d'accueil de l'iPhone, un téléchargement n'a nulle part où aller :
    // la feuille de partage propose « Enregistrer dans Fichiers ».
    if (navigator.standalone && navigator.canShare) {
      const fichier = new File([store.exportJson()], nom, { type: 'application/json' });
      if (navigator.canShare({ files: [fichier] })) {
        try { await navigator.share({ files: [fichier] }); signale(tr.t('export_ok')); } catch (e) { if (e?.name !== 'AbortError') signale(tr.t('export_failed')); }
        return;
      }
    }
    try {
      const blob = new Blob([store.exportJson()], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: nom });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      signale(tr.t('export_ok'));
    } catch { signale(tr.t('export_failed')); }
  };
  const champ = h('input', { type: 'file', accept: 'application/json,text/plain,.json', hidden: true, onchange: async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    // Au plus 2 Mo, comme Android : une vraie sauvegarde pèse quelques dizaines de Ko.
    if (fichier.size > 2 * 1024 * 1024) { signale(tr.t('import_failed')); return; }
    let texte;
    try { texte = await fichier.text(); } catch { signale(tr.t('import_failed')); return; }
    const n = store.importJson(texte);
    if (n === null || n === undefined) { signale(tr.t('import_invalid')); return; }
    appliqueApparence();
    rendre();
    signale(tr.p('import_ok', n));
  } });
  return h('div', { class: 'carte' },
    h('h3', {}, tr.t('section_data')),
    h('p', { class: 'indice' }, tr.t('section_data_hint')),
    h('div', { class: 'actions-donnees' },
      h('button', { type: 'button', class: 'secondaire', onclick: exporter }, tr.t('action_export')),
      h('button', { type: 'button', class: 'secondaire', onclick: () => champ.click() }, tr.t('action_import'))),
    champ);
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
      h('span', { class: 'presentation-etape' }, tr.t('onboarding_step', i + 1, PRESENTATION.length)),
      h('div', { class: 'presentation-scene' }, h('img', { src: `img/${e.image}.webp`, alt: '' })),
      h('h1', { class: 'presentation-titre' }, tr.t(e.titre)),
      h('p', { class: 'presentation-corps' }, tr.t(e.corps)),
      e.duree ? puces(DUREES_PRESENTATION, store.targetMinutes(), (m) => tr.duree(m), (m) => store.setTargetMinutes(m)) : null,
      e.adresse ? puces(['m', 'f'], store.adresse(), (a) => tr.t(a === 'm' ? 'adresse_tsadik' : 'adresse_tsadeket'), (a) => { store.setAdresse(a); appliqueApparence(); }) : null,
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
/** Hier n'est ni fait ni exempté : on peut encore l'inscrire (MainActivity.hierOuvert). */
function hierOuvert() {
  const hier = ajouteJours(store.today(), -1);
  return !store.isDone(hier) && !store.isExempt(hier);
}

/** Une hitbodedout faite loin du téléphone, comme le conseil n° 4 y invite (MainActivity.declarerHorsTelephone). */
function declarerHorsTelephone() {
  // Les deux dates sont figées au geste : la feuille peut rester ouverte à cheval sur minuit.
  const aujourdhui = store.today();
  const hier = ajouteJours(aujourdhui, -1);
  const inscrire = (date) => choisirDuree((m) => {
    store.addSession(m, { date });
    if (date === aujourdhui) store.setPendingCelebration(m);
    rendre();
  }, tr.t('offline_how_long'));
  const ouvertAujourdhui = !store.isDone(aujourdhui);
  if (ouvertAujourdhui && hierOuvert()) {
    choisirDans(tr.t('offline_which_day'), [tr.t('offline_today'), tr.t('offline_yesterday')], -1, (i) => inscrire(i === 0 ? aujourdhui : hier));
  } else inscrire(hierOuvert() ? hier : aujourdhui);
}

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

/**
 * NoteDialog : une note libre sur la journée, illustration de joie au-dessus ; puis le journal
 * enrichi (NoteDialog.kt, porté le 02/11) : l'humeur avant et après, une gratitude, une chose à travailler.
 */
function ecrireNote(date, apres = () => {}) {
  feuille(tr.t('note_title'), (f, fermer) => {
    const champ = h('textarea', { rows: 4, placeholder: tr.t('note_hint'), 'aria-label': tr.t('note_title') });
    champ.value = store.record(date)?.note ?? '';
    const plus = store.journalPlus(date);
    // Cinq humeurs ; toucher celle qui est choisie la retire (0 = non notée).
    const humeurs = (titre, cle) => {
      const boutons = JournalPlus.HUMEURS.map((e, i) => h('button', {
        type: 'button', class: 'humeur', 'aria-label': `${i + 1}/5`, 'aria-pressed': String(plus[cle] === i + 1),
        onclick: () => {
          plus[cle] = plus[cle] === i + 1 ? 0 : i + 1;
          boutons.forEach((b, j) => b.setAttribute('aria-pressed', String(plus[cle] === j + 1)));
        },
      }, e));
      return h('div', { class: 'humeurs', role: 'group', 'aria-label': tr.t(titre) },
        h('p', { class: 'humeurs-titre' }, tr.t(titre)), h('div', { class: 'humeurs-rang' }, boutons));
    };
    const ligneTexte = (cle, titre, indice) => {
      const c = h('input', { type: 'text', class: 'note-ligne', maxlength: JournalPlus.GRATITUDE_MAX, placeholder: tr.t(indice), 'aria-label': tr.t(titre) });
      c.value = plus[cle];
      return c;
    };
    const gratitude = ligneTexte('gratitude', 'journal_gratitude', 'journal_gratitude_hint');
    const travail = ligneTexte('travail', 'journal_travail', 'journal_travail_hint');
    f.append(h('img', { class: 'note-art', src: `img/${joie()}.webp`, alt: '' }), champ,
      humeurs('journal_humeur_avant', 'avant'), humeurs('journal_humeur_apres', 'apres'), gratitude, travail,
      h('div', { class: 'actions' },
        h('button', { onclick: () => { fermer(); apres(); } }, tr.t('action_later')),
        h('button', { onclick: () => {
          store.setJournalPlus(date, { avant: plus.avant, apres: plus.apres, gratitude: gratitude.value.trim(), travail: travail.value.trim() });
          store.setNote(date, champ.value.trim());
          fermer(); apres();
        } }, tr.t('action_save'))));
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
  // Les langues de lecture (LanguesTexte, 04/11) : par défaut l'hébreu et la traduction, comme avant.
  const textes = LanguesTexte.textes(languesLecture(), ChizukRules.hebreu(chizuk, item), item.fr || null, item.en || null);
  const [[l1, t1]] = textes;
  const traduction = textes[1]?.[1] ?? '';
  return h('section', { class: `chizuk${compacte ? ' compacte' : ''}` },
    h('div', { class: 'chizuk-tete' },
      h('div', { class: 'chizuk-art' }, h('img', { src: `img/${ART_DU_MOMENT[moment]}.webp`, alt: '' })),
      h('h2', { class: 'chizuk-moment' }, tr.t(moment === 'demande' ? 'chizuk_demande_title' : `moment_${moment}`))),
    // L'hébreu, de droite à gauche en toute langue.
    l1 === 'he' ? h('p', { class: 'chizuk-he ajuste', lang: 'he', dir: 'rtl' }, t1) : h('p', { class: 'chizuk-he chizuk-latin ajuste', lang: l1, dir: 'ltr' }, t1),
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
  if (store.musicShuffle()) { jouerAuHasard(); return; }
  const m = morceauChoisi();
  if (!m) return;
  lance(m, { boucle: true }).catch(echecLecture);
}

/** MusicPlayer.start : en boucle pour le morceau choisi, une fois en lecture aléatoire. */
function lance(m, { boucle }) {
  enEcoute = null;
  lectureAuHasard = !boucle;
  morceauJoue = m.id;
  if (joues.at(-1) !== m.id) joues.push(m.id);
  if (joues.length > 50) joues.shift();
  lecteur.src = m.fichier;
  lecteur.loop = boucle;
  if (volumeReglable) lecteur.volume = store.musicVolume() / 100;
  metadonnees(m);
  return lecteur.play();
}

/**
 * Lecture aléatoire : un morceau, puis à sa fin le suivant tiré du même sac, jusqu'à la fin
 * de la séance. Un morceau illisible est sauté plutôt que de laisser la séance muette.
 */
function jouerAuHasard(essais = 3) {
  const id = melange.suivant(morceaux.map((m) => m.id));
  const m = morceaux.find((x) => x.id === id);
  if (!m) return;
  lance(m, { boucle: false }).catch((e) => {
    if (e?.name === 'AbortError') return;
    if (essais > 1) jouerAuHasard(essais - 1); else echecLecture(e);
  });
  majMini();
}

/** SessionService ACTION_MUSIC : passer à l'aléatoire, ou en revenir, pendant la séance relance la musique. */
function musiqueChangee() {
  if (!store.isSessionRunning() || !store.musicEnabled()) return;
  if (lectureAuHasard !== store.musicShuffle()) demarreMusique();
}

/** Fondu court à la fin (MusicPlayer.stop) ; sur iPhone, où le volume ne se règle pas, l'arrêt est net. */
function arreteMusique() {
  arreteAmbiance();
  morceauJoue = null;
  lectureAuHasard = false;
  joues = [];
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
  aleatoire: 'M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
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
  // En lecture aléatoire : « suivant » tire, « précédent » revient au morceau d'avant (SessionService.changer).
  if (store.musicShuffle()) {
    store.setMusicEnabled(true);
    if (sens < 0 && joues.length >= 2) joues.pop();
    const avant = sens < 0 ? morceaux.find((m) => m.id === joues.at(-1)) : null;
    if (avant) lance(avant, { boucle: false }).catch(echecLecture); else jouerAuHasard();
    majMini();
    return;
  }
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
        // La lecture aléatoire, et son pendant vide pour que la lecture reste au centre (MiniLecteur.kt).
        bouton('aleatoire', 'lecteur_aleatoire', () => { store.setMusicShuffle(!store.musicShuffle()); musiqueChangee(); majMini(); }, 'mini-aleatoire'),
        bouton('precedent', 'lecteur_precedent', () => {
          if (lecteur.currentTime > 3) { lecteur.currentTime = 0; return; }
          morceauSuivant(-1);
        }),
        lecture,
        bouton('suivant', 'lecteur_suivant', () => morceauSuivant(1)),
        h('span', { class: 'mini-bouton', 'aria-hidden': 'true' }))));
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
  const m = store.musicEnabled() ? morceauEnCours() : null;
  const joue = !lecteur.paused && !lecteur.ended;
  mini.classList.toggle('joue', joue);
  mini.querySelector('.mini-titre').textContent = m ? titreMorceau(m) : tr.t('music_off_short');
  mini.querySelector('.mini-aleatoire').setAttribute('aria-pressed', String(store.musicShuffle()));
  const image = m?.image ?? perso('img/char_guitar.webp');
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
  // Une séance non inscrite n'a pas de jour : sa note va à aujourd'hui, pas au jour
  // d'une séance d'avant (bug du 02/11).
  dateNote = null;
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

// --- La hitbodedout guidée (HitbodedutCard.kt, SessionActivity.renderGuide, 02/11) --------------
// Un temps à la fois, quand le réglage le demande (éteint par défaut). Le pas courant appartient
// à la séance et repart à zéro avec elle : un guide qui reprendrait là où l'on s'était arrêté la
// veille rappellerait une dette. Il est lié au début de la séance, et gardé pour l'onglet
// (sessionStorage) comme Android le garde à la recréation de l'écran (ETAT_GUIDE).
const CLE_GUIDE = 'guide-seance';
function pasGuide() {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLE_GUIDE) ?? 'null');
    return g && g.debut === store.sessionStartedAt() && Number.isInteger(g.pas) ? g.pas : 0;
  } catch { return 0; }
}
function allerAuPas(pas, viser) {
  try { sessionStorage.setItem(CLE_GUIDE, JSON.stringify({ debut: store.sessionStartedAt(), pas })); } catch { /* rien */ }
  rendre();
  // Le bouton touché garde le focus ; aux bornes il disparaît, l'autre le reprend.
  (app.querySelector(`.guide-${viser}:not(.guide-cache)`) ?? app.querySelector('.guide-boutons button:not(.guide-cache)'))?.focus({ preventScroll: true });
}

// L'invitation selon le sujet (GuideSujets.kt, res/raw/guide_sujets.json) : chargée à la
// première carte qui en a besoin. Sans elle, la carte garde l'invitation générale du temps.
let guideSujets = null;
let guideSujetsDemandes = false;
function chargeGuideSujets() {
  if (guideSujets) return true;
  if (!guideSujetsDemandes) {
    guideSujetsDemandes = true;
    fetch('data/guide_sujets.json').then((r) => r.json()).then((d) => { guideSujets = d.sujets; rendre(); })
      .catch(() => { guideSujetsDemandes = false; });
  }
  return false;
}

function carteGuide() {
  if (!store.guidedHitbodedut()) return null;
  const pas = Math.min(Math.max(pasGuide(), 0), Hitbodedut.DERNIER);
  const m = Hitbodedut.mouvement(pas);
  const sujet = store.sessionTheme();
  // Le temps, dit pour le sujet choisi (proposition 2, 19/10) ; sans sujet, rien de plus.
  const pourLeSujet = sujet && chargeGuideSujets() ? invitationSujet(guideSujets, sujet, m.cle, tr.langue) : null;
  const premier = Hitbodedut.estPremier(pas);
  const dernier = Hitbodedut.estDernier(pas);
  return h('section', { class: 'guide' },
    h('div', { class: 'guide-tete' },
      h('div', { class: 'guide-art' }, h('img', { src: `img/${m.illustration}.webp`, alt: '' })),
      h('div', { class: 'guide-entete' },
        h('span', { class: 'guide-pas' }, tr.t('hitbodedut_step', pas + 1, MOUVEMENTS.length)),
        // L'hébreu, de droite à gauche en toute langue, comme sur la carte de ’hizouk.
        h('p', { class: 'guide-he', lang: 'he', dir: 'rtl' }, m.he))),
    h('h2', { class: 'guide-titre' }, tr.t(m.titre)),
    h('p', { class: 'guide-invite' }, tr.t(m.invite)),
    pourLeSujet ? h('p', { class: 'guide-sujet' }, pourLeSujet) : null,
    h('p', { class: 'guide-source', dir: 'auto' }, Reference.localise(m.source, tr.langue)),
    // Aux bornes, le bouton s'efface sans céder sa place (View.INVISIBLE).
    h('div', { class: 'guide-boutons' },
      h('button', { type: 'button', class: `guide-precedent${premier ? ' guide-cache' : ''}`, 'aria-hidden': premier ? 'true' : null, tabindex: premier ? '-1' : null,
        onclick: () => allerAuPas(Hitbodedut.precedent(pas), 'precedent') }, tr.t('hitbodedut_previous')),
      h('button', { type: 'button', class: `guide-suivant${dernier ? ' guide-cache' : ''}`, 'aria-hidden': dernier ? 'true' : null, tabindex: dernier ? '-1' : null,
        onclick: () => allerAuPas(Hitbodedut.suivant(pas), 'suivant') }, tr.t('hitbodedut_next'))));
}

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
    morceau ? h('p', { class: 'legende petite' }, tr.t('session_music_line', titreEnCours(morceauEnCours()))) : null,
    carteChizuk(chizukSeance),
    // La hitbodedout guidée (02/11) : sous le ’hizouk, avant « je n'arrive pas à parler », comme Android.
    enCours ? carteGuide() : null,
    enCours && aBlocage ? h('button', { class: 'texte-clair blocage', onclick: () => { tireChizuk('blocage'); if (questionSeance < 0) questionSeance = 0; rendre(); } }, tr.t('chizuk_stuck')) : null,
    enCours && questionSeance >= 0 ? h('div', { class: `question-seance${questionChange && !moinsDeMouvement() ? ' fondu-neuf' : ''}` },
      h('p', { class: 'question-rang' }, tr.t('question_rang', questionSeance + 1, QUESTIONS_BLOCAGE.length)),
      h('div', { class: 'question-jauge', 'aria-hidden': 'true' }, h('span', { style: `width:${((questionSeance + 1) / QUESTIONS_BLOCAGE.length) * 100}%` })),
      h('p', { class: 'question-texte' }, tr.t(QUESTIONS_BLOCAGE[questionSeance])),
      h('button', { class: 'question-suivante', onclick: () => { questionSeance = (questionSeance + 1) % QUESTIONS_BLOCAGE.length; questionChange = true; rendre(); questionChange = false; } }, tr.t('question_suivante'))) : null,
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
  if (ECRANS_TIKKUN.includes(location.hash.slice(1))) return location.hash.slice(1);
  const e = location.hash.slice(1);
  return ['musique', 'reglages', 'seance', 'bravo', 'tehilim', 'lecture', 'siddur', 'priere', 'tikkun', 'bibliotheque', 'livres', 'source', 'zmanim', 'vol', 'boussole', 'calendrier', 'paliers', 'hilloulot', 'halakha', 'recherche', 'hizouk', 'parcours', 'journal', 'conseils', 'tefilot'].includes(e) ? e : 'accueil';
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

/** Vrai pendant un rendu qui redessine l'écran déjà ouvert (pas une ouverture). */
let rendreSurPlace = false;
/** Le paragraphe en haut d'un livre ouvert, et sa distance au haut de l'écran. */
function paragrapheDuHaut(defile) {
  const r = defile.getBoundingClientRect();
  for (let y = r.top + 4; y < Math.min(r.bottom, r.top + 400); y += 16) {
    const el = document.elementFromPoint(r.left + r.width / 2, y)?.closest('[data-place]');
    if (el) { const [section, bloc] = el.dataset.place.split(':').map(Number); return { section, bloc, marge: el.getBoundingClientRect().top - r.top }; }
  }
  return null;
}
function rendre() {
  policeAffichee = null;
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
  if (ecran !== 'boussole') arreteBoussole();
  queueMicrotask(majMini);
  const memeEcran = app.dataset.ecran === `${ecran}/${onglet}` && !app.querySelector('.ecran[data-attente]');
  rendreSurPlace = memeEcran;
  if (ecran !== 'recherche' && ecran !== 'priere') rendreLivresDeRecherche();
  // Un livre redessiné sur place (« Aa », 02/11) : ses chapitres reviennent vides, à la hauteur
  // estimée ; on retrouve le paragraphe du haut plutôt que le nombre de pixels.
  const defileAvant = app.querySelector('.defile.defile-livre');
  const hautLivre = memeEcran && defileAvant ? paragrapheDuHaut(defileAvant) : null;
  const champ = document.activeElement?.classList?.contains('champ-recherche') ? document.activeElement : null;
  const selection = champ ? [champ.selectionStart, champ.selectionEnd] : null;
  app.replaceChildren();
  if (ecran === 'musique') app.append(ecranMusique());
  else if (ecran === 'reglages') app.append(ecranReglages());
  else if (ecran === 'zmanim') app.append(ecranZmanim());
  else if (ecran === 'vol') app.append(ecranVol());
  else if (ecran === 'boussole') app.append(ecranBoussole());
  else if (ecran === 'calendrier') app.append(ecranCalendrier());
  else if (ecran === 'paliers') app.append(ecranPaliers());
  else if (ecran === 'hilloulot') app.append(ecranHilloulot());
  else if (ecran === 'halakha') app.append(ecranHalakha());
  else if (ecran === 'recherche') app.append(ecranRecherche());
  else if (ecran === 'seance') app.append(ecranSeance());
  else if (ecran === 'hizouk') app.append(ecranHizouk());
  else if (ecran === 'parcours') app.append(ecranParcours());
  else if (ecran === 'journal') app.append(ecranJournal());
  else if (ecran === 'conseils') app.append(ecranConseils());
  else if (ecran === 'tefilot') app.append(ecranTefilot());
  else if (ecran === 'bravo') app.append(ecranBravo());
  else if (ecran === 'tehilim') app.append(ecranTehilim());
  else if (ecran === 'lecture') app.append(ecranLecture());
  else if (ecran === 'siddur') app.append(ecranSiddur());
  else if (ecran === 'priere') app.append(ecranPriere());
  else if (ecran === 'tikkun' || ECRANS_TIKKUN.includes(ecran)) app.append(ecranTikkun());
  else if (ecran === 'bibliotheque') app.append(ecranBibliotheque());
  else if (ecran === 'livres') app.append(ecranLivres());
  else if (ecran === 'source') app.append(ecranSource());
  else {
    app.append(h('div', { class: 'ecran avec-onglets' },
      h('div', { class: 'defile' }, onglet === 'textes' ? panneauTextes() : panneauAujourdhui()),
      onglets()));
  }
  app.dataset.ecran = `${ecran}/${onglet}`;
  if (memeEcran && hautLivre && app.querySelector('.defile.defile-livre')) {
    const ecranLivre = app.querySelector('.ecran');
    app.querySelector('.defile').scrollTop = avant;
    requestAnimationFrame(() => allerAMarque(ecranLivre, hautLivre, hautLivre.marge));
  } else if (memeEcran) app.querySelector('.defile').scrollTop = avant;
  if (selection) { const c = app.querySelector('.champ-recherche'); if (c) { c.focus({ preventScroll: true }); try { c.setSelectionRange(...selection); } catch { /* type search */ } } }
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
  const [m, t, c, p] = await Promise.all([
    fetch('data/musique.json').then((r) => r.json()),
    fetch('data/tikkun_haklali.json').then((r) => r.json()),
    fetch('data/chizuk.json').then((r) => r.json()),
    // Les morceaux ajoutés (02/11), après les morceaux livrés (MusicLibrary.all).
    MorceauxPerso.tous().catch(() => []),
  ]);
  morceaux = [...m, ...p.filter((e) => e?.blob instanceof Blob).map(versMorceau)];
  // Une base lente au réveil (iPhone, relecture du 02/11) : ses morceaux arrivent après coup,
  // au lieu de manquer toute la session (morceau choisi remplacé, doublon au prochain ajout).
  if (!p.length) {
    MorceauxPerso.tous({ attente: null }).then((tard) => {
      const nouveaux = tard.filter((e) => e?.blob instanceof Blob && !morceaux.some((x) => x.id === e.id));
      if (!nouveaux.length) return;
      morceaux = [...morceaux, ...nouveaux.map(versMorceau)];
      if (!store.isSessionRunning()) rendre();
    }).catch(() => {});
  }
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
  let cacheA = 0;
  let jourCache = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cacheA = Date.now(); jourCache = store.today(); return; }
    // Un autre jour (bug du 02/11) : halakha, hilloulot et calendrier, ouverts hier, reviennent à aujourd'hui.
    if (jourCache && jourCache !== store.today()) {
      jourHalakha = null; jourHilloulot = null; jourCalendrier = null; moisCalendrier = null; moisHebreuCalendrier = null;
      delete app.dataset.ecran;
    }
    // Après un voyage, la position du téléphone (si elle est le lieu choisi) se reprend sans bruit.
    rafraichirPosition();
    // Une prière restée ouverte jusqu'au lendemain (bug du 02/11) : redessinée depuis le début,
    // comme rouverte ; un livre garde sa place.
    if (ecranCourant() === 'priere' && priere && !priere.startsWith('livre:') && cacheA
      && !repriseValable(`s:${priere}`, cacheA, Date.now())) delete app.dataset.ecran;
    accueilAnime = false;
    facePlaque = 'hassid';
    if (store.isSessionRunning()) gardeEcranAllume();
    rendre();
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // Une nouvelle version a pris la main (02/11) : la page encore ouverte tourne sur l'ancien code,
  // qui demanderait des fichiers que la nouvelle a retirés. On recharge au prochain retour sur
  // l'application (jamais sous les yeux, jamais pendant une séance) ; l'écran ouvert est gardé
  // dans l'historique, la place dans le livre aussi.
  const avaitUnTravailleur = !!navigator.serviceWorker.controller;
  let nouvelleVersion = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (avaitUnTravailleur) nouvelleVersion = true; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && nouvelleVersion && !store.isSessionRunning()) location.reload();
  });
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
