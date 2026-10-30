// Ce que le jour change à la lecture du siddour (SiddurJour.kt, 10/10) : les
// ajouts du jour mis en évidence, les autres repliés derrière une flèche,
// jamais retirés. Annotations : data/siddur_annotations.json
// (tools/siddur_annotations.py) ; conditions : calendrier-juif.js.

/** Une condition, « ! » devant : quand la clé est fausse. */
export function vrai(condition, conditions) {
  return condition.startsWith('!') ? !conditions.has(condition.slice(1)) : conditions.has(condition);
}

/** Le nom de la chaîne qui nomme une condition (le même qu'Android). */
export function libelle(condition) {
  const c = condition.replace(/^!/, '');
  if (condition.startsWith('!tahanoun')) return 'ajout_sans_tahanoun';
  if (c.startsWith('tahanoun')) return 'ajout_tahanoun';
  if (c === 'kippour') return 'fete_yom_kippour';
  if (c === 'hallel') return 'ajout_hallel_annonce';
  if (c.startsWith('embolismique')) return 'ajout_embolismique';
  if (['pessah', 'soukkot', 'chavouot', 'roch_hachana', 'chemini_atseret', 'hanouka', 'pourim'].includes(c)) return `fete_${c}`;
  return `ajout_${c}`;
}

/**
 * Les conditions du jour, ajustées au nusah (SiddurJour.conditionsPour) :
 * pas de Morid hatal ashkénaze hors d'Israël, pas de Ta'hanoun Edot en fin de Tichri.
 */
export function conditionsPour(nusah, enIsrael, conditions, sansTahanounFinTichri = nusah === 'edot', sud = false) {
  const c = new Set(conditions);
  if (c.has('bascule_pluie')) { c.add('machiv_harouah'); c.add('morid_hatal'); }
  if (nusah === 'ashkenaz' && !enIsrael) c.delete('morid_hatal');
  // Hémisphère sud, Edot (14/10) : « מוריד הטל » toute l'année, jamais « מוריד הגשם » ;
  // ותן טל ומטר suit la diaspora. Yalkut Yosef, Kitsour Choulhan Aroukh, O.H. 117:19
  // (Chéérit Yossef III p. 105 ; Yalkut Yosef Tefila II, 117 note 19, p. 100) ; recoupé le 16/10
  // avec Halakha Yomit (site de Rav Ovadia Yossef).
  if (sud && nusah === 'edot' && c.delete('machiv_harouah')) c.add('morid_hatal');
  // Pas de Ta'hanoun du lendemain de Kippour jusqu'au 2 'Hechvan : Edot, et Sfard au choix.
  if (sansTahanounFinTichri && c.has('fin_tichri')) for (const k of ['tahanoun_chaharit', 'tahanoun_minha', 'lundi_jeudi']) c.delete(k);
  if (avinouMalkenou(conditions)) c.add('avinou_malkenou');
  return c;
}

/** Les conditions déduites (SiddurJour, CalendrierJuif.C.DERIVEES), hors des vecteurs KosherJava. */
export const DERIVEES = ['avinou_malkenou', 'kriat_hatorah', 'jour_1', 'jour_2', 'jour_3', 'jour_4', 'jour_5', 'jour_6',
  'tsom_guedalia_tevet', 'lendemain_kippour', 'esther_pourim', 'chiva_assar_tamouz', 'bascule_pluie', 'erev_kippour_vendredi',
  'lamnatseah', 'ledavid', 'techouva_hochaana', 'yom_tov', 'moed', 'chabbat_roch_hodech', 'yom_tov_chabbat', 'roch_hachana_chabbat',
  'motsae_chabbat_yt', 'beit_avel', 'oubli', 'minyan', 'cheva_berakhot', 'zimun', 'embolismique', 'embolismique_avant_nissan'];

/**
 * Avinou malkénou (SiddurJour.avinouMalkenou) : jeûnes publics sauf le 9 Av, dix
 * jours de pénitence (Roch Hachana et Kippour compris, pas la veille de Kippour),
 * jamais le Chabbat.
 */
export function avinouMalkenou(conditions) {
  const c = conditions instanceof Set ? conditions : new Set(conditions);
  if (c.has('chabbat')) return false;
  if (c.has('erev_kippour_vendredi')) return true;
  if (c.has('jeune') && !c.has('ticha_beav')) return true;
  return c.has('asseret_yemei_techouva') && (c.has('tahanoun_chaharit') || c.has('roch_hachana') || c.has('kippour'));
}

/** Hallel complet, ou partiel avec ou sans bénédiction selon le nusah (OC 422:2) ; null hors Hallel. */
export function libelleHallel(nusah, conditions) {
  if (conditions.has('hallel_complet')) return 'ajout_hallel_complet';
  if (!conditions.has('hallel')) return null;
  return nusah === 'edot' ? 'ajout_hallel_partiel_sans_berakha' : 'ajout_hallel_partiel_avec_berakha';
}

/** Le libellé d'un ajout un jour donné : celui de l'annotation, sinon celui de la condition (SiddurJour.libelleJour). */
export function libelleJour(libelleAnnotation, condition, nusah, conditions) {
  if (libelleAnnotation) return libelleAnnotation;
  if (condition === 'hallel') return libelleHallel(nusah, conditions) ?? libelle(condition);
  // Les Edot changent toute la 9ᵉ bénédiction, pas une formule (28/10) : ברך עלינו / ברכנו.
  if (nusah === 'edot' && condition === 'tal_oumatar') return 'ajout_barekh_alenou';
  if (nusah === 'edot' && (condition === '!tal_oumatar' || condition === 'berakha')) return 'ajout_barkhenou';
  return libelle(condition);
}

/** Comme tools/siddur_annotations.py : sans balises ni voyelles, quarante caractères. */
export function empreinte(texte) {
  return texte.replace(/<[^>]+>/g, ' ').replace(/[֑-ׇ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/**
 * Les annotations d'un texte, rangées pour la lecture : par section, la
 * condition de la section entière ; par bloc, son annotation de bloc ; et
 * les indices de chaque bloc.
 */
export function index(annotations = []) {
  const sections = new Map();
  const blocs = new Map();
  const indices = new Map();
  // Les renvois (« Aujourd'hui · Hallel › ») : après la section (« s: ») ou après tel bloc (« s:b »).
  const renvois = new Map();
  // Qui prie seul (19/10) : la braïta à la place de Barekhou, après tel bloc (« s:b »).
  const seuls = new Map();
  for (const a of annotations) {
    if (a.sorte === 'section') sections.set(a.s, a);
    else if (a.sorte === 'bloc') blocs.set(`${a.s}:${a.b}`, a);
    else if (a.sorte === 'seul') seuls.set(`${a.s}:${a.b}`, [...(seuls.get(`${a.s}:${a.b}`) ?? []), a]);
    else if (a.sorte === 'renvoi') renvois.set(`${a.s}:${a.b ?? ''}`, [...(renvois.get(`${a.s}:${a.b ?? ''}`) ?? []), a]);
    else indices.set(`${a.s}:${a.b}`, [...(indices.get(`${a.s}:${a.b}`) ?? []), a]);
  }
  return { sections, blocs, indices, renvois, seuls };
}
