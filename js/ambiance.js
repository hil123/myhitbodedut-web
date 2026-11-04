// Les ambiances (Ambiance.kt, proposition 9, 19/10) : pluie, mer, forêt, feu,
// nuit, ou le silence. Calculées, jamais un fichier : une boucle de 24 secondes,
// le même calcul qu'Android, jouée sous la musique pendant la hitbodedout.
//
// Web Audio s'arrête quand l'iPhone se verrouille (voir le lecteur de musique,
// app.js) : l'ambiance s'entend donc écran allumé, ce que la séance garde.

export const AMBIANCES = ['silence', 'pluie', 'mer', 'foret', 'feu', 'nuit'];
export const TAUX = 22050;
export const SECONDES = 24;

function hasard(graine) {
  let a = graine | 0;
  const suivant = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { suivant, bruit: () => suivant() * 2 - 1 };
}

export function generer(type, taux = TAUX, secondes = SECONDES, graine = 7) {
  const n = taux * secondes;
  const s = new Float32Array(n);
  if (!AMBIANCES.includes(type) || type === 'silence') return s;
  const h = hasard(graine);
  let bas = 0; let brun = 0; let goutte = 0; let ton = 0; let chant = 0; let freq = 0;
  for (let i = 0; i < n; i++) {
    const t = i / taux;
    const w = h.bruit();
    bas += 0.35 * (w - bas);
    brun = (brun + 0.02 * w) * 0.995;
    let v = 0;
    if (type === 'pluie') {
      if (h.suivant() < 0.0008) goutte = 0.25 + 0.35 * h.suivant();
      goutte *= 0.985;
      v = 0.22 * (w - bas) + 0.18 * bas + goutte * h.bruit();
    } else if (type === 'mer') {
      const vague = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / 8);
      v = (0.12 + 0.7 * vague * vague) * (1.6 * brun + 0.25 * bas);
    } else if (type === 'foret') {
      const vent = 0.6 + 0.4 * Math.sin(2 * Math.PI * t / 12);
      if (chant <= 0 && h.suivant() < 1 / (taux * 2.5)) { chant = Math.trunc(0.1 * taux); freq = 2600 + 1200 * h.suivant(); }
      let oiseau = 0;
      if (chant > 0) {
        const p = 1 - chant / (0.1 * taux);
        ton += 2 * Math.PI * (freq + 900 * p) / taux;
        oiseau = 0.1 * Math.sin(ton) * Math.sin(Math.PI * p);
        chant--;
      }
      v = 0.9 * vent * brun + 0.05 * bas + oiseau;
    } else if (type === 'feu') {
      if (h.suivant() < 0.0025) goutte = 0.2 + 0.5 * h.suivant();
      goutte *= 0.9;
      v = 1.4 * brun + goutte * h.bruit();
    } else if (type === 'nuit') {
      const cycle = t % 1;
      const impulsion = cycle < 0.15 && Math.trunc(cycle * 20) % 2 === 0;
      v = 0.5 * brun + (impulsion ? 0.05 * Math.sin(2 * Math.PI * 4500 * t) : 0);
    }
    s[i] = v;
  }
  let crete = 1e-6;
  for (const x of s) crete = Math.max(crete, Math.abs(x));
  const gain = Math.min(0.6 / crete, 4);
  for (let i = 0; i < n; i++) s[i] *= gain;
  const f = Math.trunc(taux / 20);
  for (let i = 0; i < f; i++) { const g = i / f; s[i] *= g; s[n - 1 - i] *= g; }
  return s;
}

let contexte = null;
let source = null;
let courante = 'silence';

/** Joue [type] en boucle, au volume 0–100 ; le silence arrête. */
export function jouer(type, volume = 60) {
  if (type === courante && source) return;
  arreter();
  courante = type;
  if (type === 'silence' || !AMBIANCES.includes(type)) return;
  try {
    contexte ??= new (window.AudioContext || window.webkitAudioContext)();
    const donnees = generer(type);
    const tampon = contexte.createBuffer(1, donnees.length, TAUX);
    tampon.copyToChannel(donnees, 0);
    source = contexte.createBufferSource();
    source.buffer = tampon;
    source.loop = true;
    const gain = contexte.createGain();
    gain.gain.value = (volume / 100) * 0.8;
    source.connect(gain).connect(contexte.destination);
    contexte.resume?.();
    source.start();
  } catch { source = null; courante = 'silence'; }
}

export function arreter() {
  try { source?.stop(); } catch { /* déjà arrêtée */ }
  source = null;
  courante = 'silence';
}
