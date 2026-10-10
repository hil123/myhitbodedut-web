// Les chaînes de l'interface, lues depuis les strings.xml d'Android
// (construites en data/strings.<langue>.json par build.mjs).

import { RegleLangue } from './regles.js';

export const LANGUES = [
  // L'ordre de Langues.kt : עברית, English, Français. Chaque nom est écrit dans sa langue.
  { code: 'he', nom: 'עברית' },
  { code: 'en', nom: 'English' },
  { code: 'fr', nom: 'Français' },
];

/**
 * La langue à montrer : celle choisie dans les réglages, sinon celle du
 * téléphone si l'application la connaît, sinon le français — la langue par
 * défaut des ressources Android.
 */
export function langueInitiale(choisie, languesDuTelephone) {
  const connues = LANGUES.map((l) => l.code);
  const c = RegleLangue.normalise(choisie);
  if (connues.includes(c)) return c;
  for (const l of languesDuTelephone ?? []) {
    const n = RegleLangue.normalise(l);
    if (connues.includes(n)) return n;
  }
  return 'fr';
}

/** Le String.format d'Android, réduit à ce que les chaînes emploient : %s %d %1$s %2$02d %%. */
export function formate(modele, args) {
  let suivant = 0;
  return modele.replace(/%(?:(\d+)\$)?(0?\d+)?([sd%])/g, (m, pos, largeur, type) => {
    if (type === '%') return '%';
    const valeur = args[pos ? Number(pos) - 1 : suivant++];
    let texte = String(valeur);
    if (type === 'd' && largeur) texte = texte.padStart(Number(largeur), largeur.startsWith('0') ? '0' : ' ');
    return texte;
  });
}

export function creeTraduction(langue, table) {
  const regles = new Intl.PluralRules(langue);
  const t = (nom, ...args) => {
    const modele = table.chaines[nom];
    if (modele === undefined) throw new Error(`Chaîne inconnue : ${nom}`);
    return args.length ? formate(modele, args) : modele;
  };
  /** getQuantityString : la forme de la quantité, sinon « other », comme Android. */
  const p = (nom, n, ...args) => {
    const formes = table.pluriels[nom];
    if (!formes) throw new Error(`Pluriel inconnu : ${nom}`);
    const modele = formes[regles.select(n)] ?? formes.other;
    return formate(modele, args.length ? args : [n]);
  };
  /** Store.formatDuration : « 20 min », « 1 h », « 1 h 30 ». */
  const duree = (minutes) => {
    if (minutes < 60) return t('duration_minutes', minutes);
    if (minutes % 60 === 0) return t('duration_hours', minutes / 60);
    return t('duration_hours_minutes', Math.floor(minutes / 60), minutes % 60);
  };
  return { langue, rtl: langue === 'he', t, p, duree };
}

export async function chargeTraduction(langue) {
  const reponse = await fetch(`data/strings.${langue}.json`);
  return creeTraduction(langue, await reponse.json());
}
