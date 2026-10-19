// Le jour hébraïque et ce qu'il change aux prières (CalendrierJuif.kt, 10/10),
// sans réseau, par kosher-zmanim 0.9.0 et le portage de TefilaRules
// (tefila.js). Même entrée, même sortie qu'Android : web/test vérifie l'égalité
// jour par jour avec ce que KosherJava répond (vecteurs_kosherjava.json).

import { DateTime, HebrewDateFormatter, JewishCalendar, JewishDate } from '../vendor/kosher-zmanim-0.9.0.min.js';
import * as T from './tefila.js';

/** Les clés de condition, communes à Android, au web et aux annotations du siddour. */
export const C = Object.freeze({
  YAALE_VEYAVO: 'yaale_veyavo', ROCH_HODECH: 'roch_hodech', PESSAH: 'pessah', SOUKKOT: 'soukkot',
  CHAVOUOT: 'chavouot', ROCH_HACHANA: 'roch_hachana', CHEMINI_ATSERET: 'chemini_atseret', KIPPOUR: 'kippour',
  AL_HANISSIM: 'al_hanissim', HANOUKA: 'hanouka', POURIM: 'pourim',
  MACHIV_HAROUAH: 'machiv_harouah', MORID_HATAL: 'morid_hatal', TAL_OUMATAR: 'tal_oumatar', BERAKHA: 'berakha',
  HALLEL: 'hallel', HALLEL_COMPLET: 'hallel_complet',
  TAHANOUN_CHAHARIT: 'tahanoun_chaharit', TAHANOUN_MINHA: 'tahanoun_minha', LUNDI_JEUDI: 'lundi_jeudi',
  ASSERET_YEMEI_TECHOUVA: 'asseret_yemei_techouva', JEUNE: 'jeune', TICHA_BEAV: 'ticha_beav',
  CHABBAT: 'chabbat', MOTSAE_CHABBAT: 'motsae_chabbat', OMER: 'omer', FIN_TICHRI: 'fin_tichri',
});
export const TOUTES = Object.values(C);

/** Les fêtes par JewishCalendar.getYomTovIndex() : libellé « fete_<clé> ». */
export const FETES = new Map([
  [JewishCalendar.EREV_PESACH, 'erev_pessah'], [JewishCalendar.PESACH, 'pessah'],
  [JewishCalendar.CHOL_HAMOED_PESACH, 'hol_hamoed_pessah'], [JewishCalendar.PESACH_SHENI, 'pessah_cheni'],
  [JewishCalendar.EREV_SHAVUOS, 'erev_chavouot'], [JewishCalendar.SHAVUOS, 'chavouot'],
  [JewishCalendar.SEVENTEEN_OF_TAMMUZ, 'tamouz_17'], [JewishCalendar.TISHA_BEAV, 'ticha_beav'],
  [JewishCalendar.TU_BEAV, 'tou_beav'], [JewishCalendar.EREV_ROSH_HASHANA, 'erev_roch_hachana'],
  [JewishCalendar.ROSH_HASHANA, 'roch_hachana'], [JewishCalendar.FAST_OF_GEDALYAH, 'jeune_guedalia'],
  [JewishCalendar.EREV_YOM_KIPPUR, 'erev_yom_kippour'], [JewishCalendar.YOM_KIPPUR, 'yom_kippour'],
  [JewishCalendar.EREV_SUCCOS, 'erev_soukkot'], [JewishCalendar.SUCCOS, 'soukkot'],
  [JewishCalendar.CHOL_HAMOED_SUCCOS, 'hol_hamoed_soukkot'], [JewishCalendar.HOSHANA_RABBA, 'hochaana_rabba'],
  [JewishCalendar.SHEMINI_ATZERES, 'chemini_atseret'], [JewishCalendar.SIMCHAS_TORAH, 'simhat_torah'],
  [JewishCalendar.CHANUKAH, 'hanouka'], [JewishCalendar.TENTH_OF_TEVES, 'tevet_10'],
  [JewishCalendar.TU_BESHVAT, 'tou_bichvat'], [JewishCalendar.FAST_OF_ESTHER, 'jeune_esther'],
  [JewishCalendar.PURIM, 'pourim'], [JewishCalendar.SHUSHAN_PURIM, 'chouchan_pourim'],
  [JewishCalendar.PURIM_KATAN, 'pourim_katan'], [JewishCalendar.ROSH_CHODESH, 'roch_hodech'],
  [JewishCalendar.YOM_HASHOAH, 'yom_hachoah'], [JewishCalendar.YOM_HAZIKARON, 'yom_hazikaron'],
  [JewishCalendar.YOM_HAATZMAUT, 'yom_haatsmaout'], [JewishCalendar.YOM_YERUSHALAYIM, 'yom_yerouchalayim'],
  [JewishCalendar.LAG_BAOMER, 'lag_baomer'], [JewishCalendar.SHUSHAN_PURIM_KATAN, 'chouchan_pourim_katan'],
  [JewishCalendar.ISRU_CHAG, 'isrou_hag'],
]);

const FORMAT = new HebrewDateFormatter();
FORMAT.setHebrewFormat(true);

export function calendrier(iso, enIsrael, modernes, mukafChoma) {
  const [year, month, day] = iso.split('-').map(Number);
  const jc = new JewishCalendar(DateTime.fromObject({ year, month, day }));
  jc.setInIsrael(enIsrael);
  jc.setUseModernHolidays(modernes);
  jc.setIsMukafChoma(mukafChoma);
  return jc;
}

/** Jérusalem (GeoNames), ville murée depuis Josué : Pourim y est le 15 Adar. */
export const JERUSALEM_GEONAMES = 281184;

/** Une position dans Jérusalem : à 10 km au plus de la Vieille Ville (choix de l'application, CalendrierJuif.aJerusalem). */
export function aJerusalem(latitude, longitude) {
  // Hors de la ville (CalendrierJuif.aJerusalem, audit du 16/10) : Abou Dis, Ma'alé Adoumim, Bethléem, Mevasseret.
  if (longitude > 35.258 || latitude < 31.72 || (longitude < 35.165 && latitude > 31.785)) return false;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(latitude - 31.7767), dLon = rad(longitude - 35.2345);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(31.7767)) * Math.cos(rad(latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a)) <= 10;
}
/** Les noms de Pourim dans une ville murée (CalendrierJuif.MUREE). */
const MUREE = { pourim: 'pourim_ailleurs', chouchan_pourim: 'pourim_jerusalem' };

/**
 * Le jour hébreu d'une date civile « AAAA-MM-JJ », comme CalendrierJuif.jour.
 * [mukafChoma] : Pourim et Al hanissim le 15 Adar (seule Jérusalem, parmi les
 * villes proposées, l'est avec certitude).
 */
export function jour(iso, enIsrael, mukafChoma = false) {
  // Les fêtes modernes s'affichent, mais n'entrent pas dans les règles de prière.
  const regles = calendrier(iso, enIsrael, false, mukafChoma);
  const affiche = calendrier(iso, enIsrael, true, mukafChoma);
  const semaine = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = dimanche
  const c = new Set();
  const si = (oui, cle) => { if (oui) c.add(cle); };
  si(T.isYaalehVeyavoRecited(regles), C.YAALE_VEYAVO);
  si(regles.isRoshChodesh(), C.ROCH_HODECH);
  si(regles.isPesach(), C.PESSAH);
  si(regles.isSuccos(), C.SOUKKOT);
  si(regles.isShavuos(), C.CHAVOUOT);
  si(regles.isRoshHashana(), C.ROCH_HACHANA);
  si(regles.isShminiAtzeres() || regles.isSimchasTorah(), C.CHEMINI_ATSERET);
  si(regles.isYomKippur(), C.KIPPOUR);
  si(T.isAlHanissimRecited(regles), C.AL_HANISSIM);
  si(regles.isChanukah(), C.HANOUKA);
  si(regles.isPurim(), C.POURIM);
  si(T.isMashivHaruachRecited(regles), C.MACHIV_HAROUAH);
  si(T.isMoridHatalRecited(regles), C.MORID_HATAL);
  si(T.isVeseinTalUmatarRecited(regles), C.TAL_OUMATAR);
  si(T.isVeseinBerachaRecited(regles), C.BERAKHA);
  si(T.isHallelRecited(regles), C.HALLEL);
  si(T.isHallelShalemRecited(regles), C.HALLEL_COMPLET);
  // La veille de Roch Hachana, pas de Ta'hanoun à la prière (OC 581:3).
  const tahanoun = T.isTachanunRecitedShacharis(regles) && regles.getYomTovIndex() !== JewishCalendar.EREV_ROSH_HASHANA;
  si(tahanoun, C.TAHANOUN_CHAHARIT);
  si(T.isTachanunRecitedMincha(regles), C.TAHANOUN_MINHA);
  si(tahanoun && (semaine === 1 || semaine === 4), C.LUNDI_JEUDI);
  si(regles.isAseresYemeiTeshuva(), C.ASSERET_YEMEI_TECHOUVA);
  si(regles.isTaanis() && !regles.isYomKippur(), C.JEUNE);
  si(regles.isTishaBav(), C.TICHA_BEAV);
  si(semaine === 6, C.CHABBAT);
  si(semaine === 0, C.MOTSAE_CHABBAT);
  si(regles.getDayOfOmer() > 0, C.OMER);
  si(regles.getJewishMonth() === JewishDate.TISHREI && regles.getJewishDayOfMonth() >= 22, C.FIN_TICHRI);
  // La lecture de la Torah à Cha'harit (15/10, CalendrierJuif.kt) : hors de TOUTES, comme dans DERIVEES.
  si(semaine === 1 || semaine === 4 || ['chabbat', 'roch_hodech', 'pessah', 'soukkot', 'chavouot', 'roch_hachana', 'kippour',
    'chemini_atseret', 'hanouka', 'pourim', 'jeune', 'ticha_beav'].some((k) => c.has(k)), 'kriat_hatorah');
  // Le psaume du jour et les jours qui en ajoutent un (16/10, CalendrierJuif.kt).
  si(semaine !== 6, `jour_${semaine + 1}`);
  const index = regles.getYomTovIndex();
  si(index === JewishCalendar.FAST_OF_GEDALYAH || index === JewishCalendar.TENTH_OF_TEVES, 'tsom_guedalia_tevet');
  si(regles.getJewishMonth() === JewishDate.TISHREI && regles.getJewishDayOfMonth() === 11, 'lendemain_kippour');
  si(index === JewishCalendar.FAST_OF_ESTHER || c.has('pourim'), 'esther_pourim');
  si(index === JewishCalendar.SEVENTEEN_OF_TAMMUZ, 'chiva_assar_tamouz');
  // Les jours de bascule et la veille de Kippour un vendredi (CalendrierJuif.C.BASCULE_PLUIE, EREV_KIPPOUR_VENDREDI).
  const mois = regles.getJewishMonth(), quantieme = regles.getJewishDayOfMonth();
  si((mois === JewishDate.TISHREI && quantieme === 22) || (mois === JewishDate.NISSAN && quantieme === 15), 'bascule_pluie');
  si(mois === JewishDate.TISHREI && quantieme === 9 && semaine === 5, 'erev_kippour_vendredi');
  // Relevé du 19/10 (CalendrierJuif.C.LAMNATSEAH…).
  const adar1415 = (mois === JewishDate.ADAR || mois === JewishDate.ADAR_II) && quantieme >= 14 && quantieme <= 15;
  si(!(regles.isRoshChodesh() || regles.isChanukah() || adar1415 || regles.isTishaBav() || regles.isAssurBemelacha() ||
    index === JewishCalendar.EREV_PESACH || index === JewishCalendar.EREV_YOM_KIPPUR), 'lamnatseah');
  si(mois === JewishDate.ELUL || (mois === JewishDate.TISHREI && quantieme <= 21), 'ledavid');
  si(regles.isAseresYemeiTeshuva() || (mois === JewishDate.TISHREI && quantieme === 21), 'techouva_hochaana');
  const yomTov = regles.isYomTovAssurBemelacha();
  si(yomTov, 'yom_tov');
  si(['pessah', 'soukkot', 'chavouot', 'chemini_atseret'].some((k) => c.has(k)), 'moed');
  si(c.has('chabbat') && regles.isRoshChodesh(), 'chabbat_roch_hodech');
  si(c.has('chabbat') && yomTov, 'yom_tov_chabbat');
  si(c.has('chabbat') && regles.isRoshHashana(), 'roch_hachana_chabbat');
  const hier = new Date(`${iso}T12:00:00Z`);
  hier.setUTCDate(hier.getUTCDate() - 1);
  const hierYomTov = calendrier(hier.toISOString().slice(0, 10), enIsrael, false, mukafChoma).isYomTovAssurBemelacha();
  si(c.has('motsae_chabbat') || (hierYomTov && !regles.isAssurBemelacha()), 'motsae_chabbat_yt');

  const fetes = [];
  const fete = FETES.get(affiche.getYomTovIndex());
  // Dans une ville murée, le 15 Adar est Pourim ; le 14 ne l'est qu'ailleurs.
  if (fete) fetes.push(mukafChoma ? (MUREE[fete] ?? fete) : fete);
  if (affiche.isRoshChodesh() && !fetes.includes('roch_hodech')) fetes.push('roch_hodech');

  // JewishCalendar.Parsha.NONE vaut 0 dans kosher-zmanim comme dans KosherJava.
  const paracha = semaine === 6 && regles.getParsha() !== 0 ? FORMAT.formatParsha(regles) : null;
  return {
    date: iso,
    enIsrael,
    dateHebraique: FORMAT.format(regles),
    jourEnLettres: FORMAT.formatHebrewNumber(regles.getJewishDayOfMonth()),
    jourHebreu: regles.getJewishDayOfMonth(),
    moisHebreu: regles.getJewishMonth(),
    anneeHebraique: regles.getJewishYear(),
    moisEtAnnee: `${FORMAT.formatMonth(regles)} ${FORMAT.formatHebrewNumber(regles.getJewishYear())}`,
    fetes,
    omer: Math.max(regles.getDayOfOmer(), 0),
    paracha: paracha || null,
    chome: regles.isAssurBemelacha(),
    conditions: c,
  };
}

/**
 * Le jour civil dont relève une prière dite à [heures] (0-23) le [iso] :
 * Arvit et le Chema du coucher, l'après-midi, relèvent du lendemain (voir
 * CalendrierJuif.jourDeLaPriere, qui documente la règle).
 */
export function jourDeLaPriere(texte, iso, heures) {
  if ((texte === 'arvit' || texte === 'chema_coucher') && heures >= 12) {
    const [a, m, j] = iso.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, j + 1, 12)).toISOString().slice(0, 10);
  }
  return iso;
}

/**
 * Birkat haLevana (Levana.kt ; 13/10, revue le 14/10 sur le texte, export Sefaria) :
 *  - début : pas avant sept jours (Choulhan Aroukh O.H. 426:4) ; « la plupart des
 *    A'haronim » permettent après trois jours d'heure à heure (Michna Beroura 426:20) ;
 *    l'Ari attend sept jours (Chabad.org, Ohr Somayach) ;
 *  - fin : jusqu'au seizième jour, non compris (426:3), soit quinze jours depuis
 *    l'heure du molad (MB 426:17) ; le Rema : la mi-mois, 14 j 18 h 22 min (MB 426:19) ;
 *  - pas avant Kippour ni avant Tich'a beAv (Rema 426:2) ; à leur sortie, oui
 *    (Rema ; MB 426:11 pour Tich'a beAv) ;
 *  - motsaé Chabbat de préférence, si cette nuit tombe avant le 10 du mois (Rema 426:2,
 *    MB 426:6), et pas un motsaé Chabbat qui est Yom Tov.
 * Le premier soir est celui du début ; le dernier, celui de la nuit où la fenêtre se ferme.
 */
const MOIS_LUNAIRE = ((29 * 24 + 12) * 60 + 44) * 60000 + 3333;

/** Les trois usages : début (jours depuis le molad), fin (15 jours ou mi-mois). */
export const USAGES_LEVANA = {
  trois_mi_mois: { debut: 3, fin: 'mi_mois' },
  sept_mi_mois: { debut: 7, fin: 'mi_mois' },
  sept_quinze: { debut: 7, fin: 15 },
};

/** L'usage par défaut d'un noussa'h : Edot haMizra'h le Choulhan Aroukh, Sefard l'Ari, Ashkenaz la Michna Beroura et le Rema. */
export function usageLevana(nusah, choix = 'auto') {
  if (USAGES_LEVANA[choix]) return choix;
  return nusah === 'edot' ? 'sept_quinze' : nusah === 'sefard' ? 'sept_mi_mois' : 'trois_mi_mois';
}

const ajoute = (iso, n) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d + n, 12)).toISOString().slice(0, 10); };

/**
 * La lune vue d'ici, à un instant : la part éclairée du disque (0 à 1) et si elle
 * croît. Meeus, Astronomical Algorithms, ch. 48 (angle de phase approché) ; à un
 * ou deux pour cent près, assez pour un dessin.
 */
export function phaseLune(ms) {
  const T = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
  const r = Math.PI / 180;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const i = 180 - D - 6.289 * Math.sin(Mp * r) + 2.1 * Math.sin(M * r) - 1.274 * Math.sin((2 * D - Mp) * r)
    - 0.658 * Math.sin(2 * D * r) - 0.214 * Math.sin(2 * Mp * r) - 0.11 * Math.sin(D * r);
  return { eclairage: (1 + Math.cos(i * r)) / 2, croissante: ((D % 360) + 360) % 360 < 180 };
}

export function levana(iso, zone, { usage = 'sept_mi_mois' } = {}) {
  const regle = USAGES_LEVANA[usage] ?? USAGES_LEVANA.sept_mi_mois;
  const local = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const soir = (d) => DateTime.fromISO(`${d}T20:00`, { zone }).toMillis();
  const du = (d) => {
    const c = calendrier(d, false, false, false);
    const f = {
      molad: c.getMoladAsDate().toMillis(),
      debut: (regle.debut === 3 ? c.getTchilasZmanKidushLevana3Days() : c.getTchilasZmanKidushLevana7Days()).toMillis(),
      fin: (regle.fin === 15 ? c.getSofZmanKidushLevana15Days() : c.getSofZmanKidushLevanaBetweenMoldos()).toMillis(),
      restriction: null,
    };
    // Tichri et Av : pas avant la sortie de Kippour, de Tich'a beAv (le jeûne, même repoussé au 10).
    const mois = calendrier(local(f.debut), false, false, false).getJewishMonth();
    if (mois === JewishDate.TISHREI || mois === JewishDate.AV) {
      const cible = mois === JewishDate.TISHREI ? JewishCalendar.YOM_KIPPUR : JewishCalendar.TISHA_BEAV;
      for (let k = -9; k <= 12; k++) {
        const j = ajoute(local(f.molad), k);
        if (calendrier(j, false, false, false).getYomTovIndex() === cible) {
          if (soir(j) > f.debut) { f.debut = soir(j); f.restriction = mois === JewishDate.TISHREI ? 'kippour' : 'tisha_beav'; }
          break;
        }
      }
    }
    return { ...f, premier: local(f.debut), dernier: local(f.fin - 12 * 3600000) };
  };
  let f = du(iso);
  if (iso > f.dernier) {
    const jour = calendrier(iso, false, false, false).getJewishDayOfMonth();
    f = du(ajoute(iso, 31 - jour + 2));
  }
  // Le motsaé Chabbat conseillé : un samedi de la fenêtre dont la nuit est avant le 10, et pas Yom Tov.
  let motsae = null;
  for (let d = f.premier; d <= f.dernier; d = ajoute(d, 1)) {
    if (new Date(`${d}T12:00:00Z`).getUTCDay() !== 6) continue;
    const nuit = calendrier(ajoute(d, 1), false, false, false);
    if (nuit.getJewishDayOfMonth() <= 10 && !nuit.isYomTovAssurBemelacha()) { motsae = d; break; }
  }
  const part = (ms) => Math.min(1, Math.max(0, (ms - f.molad) / MOIS_LUNAIRE));
  const jours = Math.round((Date.parse(`${f.premier}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 86400000);
  const etat = iso < f.premier ? { dans: jours } : iso === f.dernier ? 'dernier' : 'ce_soir';
  const ceSoir = soir(iso);
  return {
    premier: f.premier, dernier: f.dernier, etat, debutMs: f.debut, finMs: f.fin, restriction: f.restriction, usage,
    motsae: motsae && motsae >= iso ? motsae : null,
    debut: part(f.debut), fin: part(f.fin), point: part(ceSoir),
    lune: { ...phaseLune(ceSoir), age: (ceSoir - f.molad) / 86400000 },
  };
}

/**
 * Les rappels de tefila (16/10, RappelsTefila.kt) : les changements des `avance` jours à venir,
 * aujourd'hui compris. leSoir : le changement commence au soir de la veille, à Arvit.
 * Sources : Choul'han Aroukh, O.H. 117, 1 (pluie), 114, 1 (machiv harouah), 582, 1 (dix jours), 489, 1 (omer).
 */
export const RAPPELS_TEFILA = {
  pluie_debut: { source: '117:1', leSoir: true }, pluie_fin: { source: '117:1', leSoir: false },
  guechem_debut: { source: '114:1', leSoir: false }, guechem_fin: { source: '114:1', leSoir: false },
  dix_jours: { source: '582:1', leSoir: true }, omer: { source: '489:1', leSoir: true },
};
export function rappelsTefila(aujourdhui, enIsrael, avance = 3, jourDe = (iso) => jour(iso, enIsrael), sansGuechem = false) {
  const ajoute = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const res = [];
  let veille = jourDe(ajoute(aujourdhui, -1));
  for (let k = 0; k <= avance; k++) {
    const d = ajoute(aujourdhui, k);
    const j = jourDe(d);
    const pluie = 'tal_oumatar';
    if (j.conditions.has(pluie) && !veille.conditions.has(pluie)) res.push({ type: 'pluie_debut', date: d });
    if (!j.conditions.has(pluie) && veille.conditions.has(pluie)) res.push({ type: 'pluie_fin', date: d });
    // Les Edot de l'hémisphère sud disent מוריד הטל toute l'année (sansGuechem).
    if (!sansGuechem && j.moisHebreu === 7 && j.jourHebreu === 22) res.push({ type: 'guechem_debut', date: d });
    if (!sansGuechem && j.moisHebreu === 1 && j.jourHebreu === 15) res.push({ type: 'guechem_fin', date: d });
    if (j.moisHebreu === 7 && j.jourHebreu === 1) res.push({ type: 'dix_jours', date: d });
    if (j.omer === 1) res.push({ type: 'omer', date: d });
    veille = j;
  }
  // Un changement du soir dont le soir est déjà passé n'est plus annoncé (revue du 16/10).
  return res.filter((r) => !(RAPPELS_TEFILA[r.type].leSoir && r.date <= aujourdhui));
}

// --- Israël ou diaspora d'après la position (TerritoireIsrael.kt, 16/10) ---------------------
// Contour simplifié (précision de 2 à 3 km) : l'État d'Israël avec Jérusalem, la Judée-Samarie et le Golan.
const CONTOUR_ISRAEL = [[31.23, 34.21], [31.36, 34.24], [31.55, 34.40], [31.72, 34.50], [31.95, 34.66], [32.10, 34.72], [32.33, 34.80], [32.55, 34.86], [32.75, 34.92], [32.84, 34.93], [32.93, 35.03], [33.09, 35.08], [33.10, 35.20], [33.09, 35.33], [33.08, 35.45], [33.11, 35.52], [33.20, 35.55], [33.28, 35.57], [33.31, 35.63], [33.33, 35.79], [33.22, 35.82], [33.13, 35.815], [33.05, 35.86], [32.93, 35.87], [32.78, 35.80], [32.70, 35.72], [32.66, 35.62], [32.45, 35.57], [32.20, 35.56], [31.95, 35.55], [31.76, 35.56], [31.45, 35.50], [31.15, 35.45], [30.85, 35.36], [30.50, 35.22], [30.15, 35.14], [29.90, 35.09], [29.70, 35.03], [29.55, 34.98], [29.49, 34.90], [29.80, 34.76], [30.20, 34.60], [30.60, 34.50], [30.95, 34.37], [31.22, 34.26]];
export function dansIsrael(latitude, longitude) {
  let dedans = false;
  for (let i = 0, j = CONTOUR_ISRAEL.length - 1; i < CONTOUR_ISRAEL.length; j = i++) {
    const [yi, xi] = CONTOUR_ISRAEL[i];
    const [yj, xj] = CONTOUR_ISRAEL[j];
    if ((yi > latitude) !== (yj > latitude) && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}
