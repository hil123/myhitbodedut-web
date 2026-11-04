// Le Tikoun HaKlali (Tikkun.kt, TikkunFlowActivity.kt), en règles pures : les parties, la
// progression du jour, le sous-titre d'une partie liturgique. Ni DOM ni stockage : elles se testent avec Node seul.
// Le texte est data/tikkun_haklali.json (res/raw), lu tel quel.

export const OUVERTURE = 'ouverture';
export const CLOTURE = 'cloture';
export const KAVANA = 'kavana';
export const PRIERE = 'priere_rabbi_nathan';
const BLOCS = [OUVERTURE, CLOTURE, KAVANA, PRIERE];

/** Tikkun.bloc : une partie liturgique par sa clé ; null pour toute autre clé. */
export const bloc = (t, cle) => (BLOCS.includes(cle) && t?.[cle] ? { cle, ...t[cle] } : null);

/** Tikkun.avant : ce qui se dit avant les psaumes, dans l'ordre. */
export const avant = (t) => [OUVERTURE].map((c) => bloc(t, c)).filter(Boolean);

/** Tikkun.apres : ce qui se dit après, dans l'ordre. */
export const apres = (t) => [CLOTURE, KAVANA, PRIERE].map((c) => bloc(t, c)).filter(Boolean);

/** Tikkun.versets : tous les versets des dix psaumes. */
export const versets = (t) => t.psaumes.reduce((n, p) => n + p.versets.length, 0);

/** Tikkun.byNumero. */
export const parNumero = (t, numero) => t.psaumes.find((p) => p.numero === numero) ?? null;

/**
 * MainActivity.renderTikkun : la chaîne de la progression du jour et ses arguments.
 * [dits] : les numéros dits aujourd'hui (Store.tikkunDone).
 */
export function progres(t, dits) {
  const total = t.psaumes.length;
  const n = dits.size;
  if (n === 0) return { cle: 'tikkun_progress_none', args: [total, versets(t)] };
  if (n === total) return { cle: 'tikkun_progress_all', args: [] };
  return { cle: 'tikkun_progress', args: [n, total] };
}

/** LocalizedText.forLanguage : le français ou l'anglais s'ils existent, l'hébreu sinon. */
export function pourLangue(texte, langue) {
  if (!texte) return '';
  const he = texte.he ?? '';
  if (langue === 'fr') return (texte.fr ?? '').trim() ? texte.fr : he;
  if (langue === 'en') return (texte.en ?? '').trim() ? texte.en : he;
  return he;
}

/**
 * TikkunFlowActivity : sous le titre d'une partie d'après, la note de la partie dans la langue ; sans note,
 * le titre traduit s'il diffère de l'hébreu ; sinon rien (null).
 */
export function sousTitreBloc(b, langue) {
  const note = b.note ? pourLangue(b.note, langue).trim() : '';
  if (note) return pourLangue(b.note, langue);
  const titre = pourLangue(b.titre, langue);
  return titre !== b.titre.he ? titre : null;
}

/**
 * Verse.coupe : le verset coupé là où l'arrêt se marque — ce qui précède le mot
 * « avant », puis ce qui commence par lui. Null sans arrêt, ou si le mot n'est pas
 * dans le verset (l'indication suit alors le verset entier).
 */
export function coupe(v) {
  const mot = v?.arret?.avant;
  if (!mot) return null;
  const i = v.he.indexOf(mot);
  if (i <= 0) return null;
  return [v.he.slice(0, i).trimEnd(), v.he.slice(i)];
}
