// Ce que l'application garde, dans le navigateur du téléphone (Store.kt).
//
// Deux entrées de localStorage, comme les deux fichiers de préférences
// d'Android : « myhitbodedut » pour les réglages, « myhitbodedut-journal »
// pour les journées. Les noms des clés sont ceux d'Android, pour que
// l'export et l'import restent le même fichier sur les deux appareils.
//
// Le stockage est passé en paramètre : les tests donnent le leur.

import { ajouteJours, estJourChome, isoLocal, israelParDefaut, jourSemaine } from './calendrier.js';
import { SessionRule } from './seance.js';
import { Anneaux, JaugeSemaine, Plaque } from './regles.js';

export const DEFAULT_START = 6 * 60;
export const DEFAULT_END = 11 * 60;
export const DEFAULT_SNOOZE = 15;
// 15 minutes, comme Android depuis le 29/09 : le conseil n° 2 le recommande.
export const DEFAULT_TARGET = 15;
/** Au-delà, une note n'est plus une note (Store.NOTE_MAX). */
export const NOTE_MAX = 4000;
/** Une séance ouverte s'arrête de compter là (SessionRule.PLAFOND_OUVERTE). */
export const PLAFOND_OUVERTE = 240;

/** La date si la clé est une vraie date ISO (2026-09-29), sinon false. */
export function dateValide(cle) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cle)) return false;
  const [a, m, j] = cle.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}
export const DEFAULT_REMINDER = 7 * 60;
export const DEFAULT_VOLUME = 60;

const PREFS = 'myhitbodedut';
const PREFS_JOURNAL = 'myhitbodedut-journal';

/** Un stockage en mémoire, quand le navigateur refuse le sien (navigation privée). */
export function memoire() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

export function creeStore(stockage, { maintenant = () => new Date(), fuseau } = {}) {
  const lit = (nom) => {
    try { return JSON.parse(stockage.getItem(nom) || '{}') || {}; } catch { return {}; }
  };
  const ecrit = (nom, valeur) => {
    try { stockage.setItem(nom, JSON.stringify(valeur)); } catch { /* quota : rien à faire de mieux */ }
  };
  const prefs = () => lit(PREFS);
  const get = (cle, defaut) => { const v = prefs()[cle]; return v === undefined ? defaut : v; };
  const set = (cle, valeur) => {
    const p = prefs();
    if (valeur === null || valeur === undefined) delete p[cle]; else p[cle] = valeur;
    ecrit(PREFS, p);
  };

  const today = () => isoLocal(maintenant());

  // --- Journées -------------------------------------------------------------
  const days = () => {
    const brut = lit(PREFS_JOURNAL).days || {};
    const out = {};
    for (const [date, e] of Object.entries(brut)) {
      if (!e || typeof e !== 'object') continue;
      const noteSeule = e.note_seule === true;
      out[date] = {
        date,
        minutes: Number.isFinite(e.minutes) ? e.minutes : 0,
        note: typeof e.note === 'string' ? e.note : '',
        themes: Array.isArray(e.themes) ? e.themes.filter((t) => typeof t === 'string' && t !== '') : [],
        // Une note laissée un jour sans hitbodedout : gardée, mais elle ne
        // valide pas la journée (Store.kt, 29/09).
        noteSeule,
        faite: !noteSeule,
      };
    }
    return out;
  };
  const toJson = (r) => {
    const e = { minutes: r.minutes, note: r.note };
    // Une clé absente vaut mieux qu'un tableau vide (Store.toJson).
    if (r.themes.length > 0) e.themes = r.themes;
    if (r.noteSeule) e.note_seule = true;
    return e;
  };
  const writeDays = (map) => {
    const j = lit(PREFS_JOURNAL);
    j.days = Object.fromEntries(Object.values(map).map((r) => [r.date, toJson(r)]));
    ecrit(PREFS_JOURNAL, j);
  };

  const store = {
    today,
    days,
    record: (date = today()) => days()[date] ?? null,
    isDone: (date = today()) => days()[date]?.faite === true,
    /** Les journées qui comptent : faites ou déclarées, pas les notes seules. */
    joursFaits: () => new Set(Object.values(days()).filter((r) => r.faite).map((r) => r.date)),
    aDejaPratique: () => Object.values(days()).some((r) => r.faite),
    totalMinutes: () => Object.values(days()).reduce((s, r) => s + r.minutes, 0),

    /** La note d'un jour. Sur un jour sans hitbodedout, elle ne le valide pas. */
    setNote(date, note) {
      const d = days();
      const existant = d[date];
      const texte = note.slice(0, NOTE_MAX);
      if (existant?.noteSeule && texte.trim() === '') delete d[date];
      else if (existant) d[date] = { ...existant, note: texte };
      else if (texte.trim() !== '') d[date] = { date, minutes: 0, note: texte, themes: [], noteSeule: true, faite: false };
      else return;
      writeDays(d);
    },

    // --- Chabbat, fêtes, pauses ---------------------------------------------
    shabbatMode: () => get('pause_shabbat', true),
    setShabbatMode: (v) => set('pause_shabbat', !!v),
    inIsrael: () => get('in_israel', israelParDefaut(fuseau ?? Intl.DateTimeFormat().resolvedOptions().timeZone)),
    setInIsrael: (v) => set('in_israel', !!v),
    pausedDates: () => new Set(get('paused_dates', [])),
    isExempt(date) {
      if (store.pausedDates().has(date)) return true;
      return store.shabbatMode() && estJourChome(date, store.inIsrael());
    },

    /** Jours consécutifs validés ; les jours exemptés ne comptent pas et ne cassent pas. */
    streak() {
      const faits = store.joursFaits();
      let jour = today();
      if (!faits.has(jour) && !store.isExempt(jour)) jour = ajouteJours(jour, -1);
      let compte = 0;
      for (let garde = 0; garde < 3650; garde++) {
        if (faits.has(jour)) compte++;
        else if (!store.isExempt(jour)) return compte;
        jour = ajouteJours(jour, -1);
      }
      return compte;
    },

    /** La plus longue série jamais tenue (Plaque.meilleureSerie), au moins la série en cours. */
    meilleureSerie: () => Math.max(Plaque.meilleureSerie(store.joursFaits(), (d) => store.isExempt(d)), store.streak()),

    /** La semaine en cours, du dimanche au samedi. */
    currentWeek() {
      const faits = store.joursFaits();
      const auj = today();
      const dimanche = ajouteJours(auj, -jourSemaine(auj));
      return Array.from({ length: 7 }, (_, i) => {
        const date = ajouteJours(dimanche, i);
        return {
          date,
          done: faits.has(date),
          exempt: store.isExempt(date),
          shabbat: i === 6,
          future: date > auj,
        };
      });
    },

    // --- Séance -----------------------------------------------------------------
    targetMinutes: () => get('target_minutes', DEFAULT_TARGET),
    setTargetMinutes: (m) => set('target_minutes', m),
    /** L'objectif de l'anneau du jour ; sans réglage, la durée habituelle (Anneaux). */
    dailyGoal: () => Anneaux.objectifEffectif(get('daily_goal_minutes', 0), store.targetMinutes()),
    setDailyGoal: (m) => set('daily_goal_minutes', Math.max(0, m)),
    /** Les marques des anneaux déjà fêtés (Anneaux.marque). */
    anneauxFetes: () => new Set(get('anneaux_fetes', [])),
    /** Le nusah du siddour (Nusah, Siddur.kt) : Edot HaMizra’h par défaut. */
    siddurNusah: () => (['edot', 'sefard', 'ashkenaz'].includes(get('siddur_nusah', 'edot')) ? get('siddur_nusah', 'edot') : 'edot'),
    setSiddurNusah: (n) => set('siddur_nusah', n),
    /** La lecture (ReglagesLecture.kt) : taille des lettres de 0,8 à 2, fond noir. */
    lectureEchelle: () => Math.min(2, Math.max(0.8, Number(get('lecture_echelle', 1)) || 1)),
    setLectureEchelle: (e) => set('lecture_echelle', Math.round(Math.min(2, Math.max(0.8, e)) * 10) / 10),
    lectureSombre: () => get('lecture_sombre', false) === true,
    setLectureSombre: (v) => set('lecture_sombre', !!v),
    /** Le bouton de lecture masqué par l'utilisateur, sur tous les écrans de lecture. */
    lectureMasquee: () => get('lecture_masquee', false) === true,
    setLectureMasquee: (v) => set('lecture_masquee', !!v),
    setAnneauxFetes: (marques) => set('anneaux_fetes', [...marques]),
    /** Les trois anneaux de l'accueil, ici et maintenant. */
    anneaux: () => Anneaux.etat(
      store.record()?.minutes ?? 0, store.dailyGoal(),
      JaugeSemaine.progression(store.currentWeek()), store.streak()),
    sessionTheme: () => get('session_theme', null),
    setSessionTheme: (cle) => set('session_theme', cle),
    sessionStartedAt: () => get('session_started_at', 0),
    sessionEndsAt: () => get('session_ends_at', 0),
    sessionTarget: () => get('session_target', 0),
    isSessionRunning: () => SessionRule.enCours(
      store.sessionStartedAt(), store.sessionEndsAt(), store.sessionTarget(), maintenant().getTime()),
    isSessionOpen: () => SessionRule.estOuverte(store.sessionStartedAt(), store.sessionTarget()),
    /** Une séance minutée dont le terme est passé, pas encore close (le téléphone dormait). */
    isSessionOver: () => store.sessionStartedAt() > 0 && !store.isSessionRunning(),
    hideCountdown: () => get('hide_countdown', false),
    setHideCountdown: (v) => set('hide_countdown', !!v),
    guidedHitbodedut: () => get('guided_hitbodedut', false),
    setGuidedHitbodedut: (v) => set('guided_hitbodedut', !!v),
    sessionCounter: () => SessionRule.compteur(store.isSessionOpen(), store.hideCountdown()),

    /** Une durée nulle ouvre la séance : rien n'est inscrit comme fin. */
    beginSession(minutes) {
      const t = maintenant().getTime();
      const ouverte = minutes <= SessionRule.OUVERTE;
      set('session_started_at', t);
      set('session_ends_at', ouverte ? 0 : t + minutes * 60000);
      set('session_target', ouverte ? SessionRule.OUVERTE : minutes);
    },

    /**
     * Termine la séance et rend les minutes à inscrire.
     *
     * Android mesure le temps écoulé à la clôture, que son service fait au
     * terme, à quelques secondes près. Ici, le téléphone a pu dormir bien
     * après le terme : une séance minutée qui arrive à son terme compte donc
     * sa durée, pas le temps passé jusqu'au retour dans l'application.
     */
    endSession({ avantTerme = false } = {}) {
      const debut = store.sessionStartedAt();
      const cible = store.sessionTarget();
      let minutes = SessionRule.minutesEcoulees(debut, maintenant().getTime());
      if (!avantTerme && cible > 0) minutes = Math.min(minutes, cible);
      // Une séance ouverte oubliée en marche ne doit pas inscrire une journée.
      if (cible <= 0) minutes = Math.min(minutes, PLAFOND_OUVERTE);
      // Le jour où elle a commencé, jamais dans l'avenir (Store.endSession).
      const jourDebut = debut > 0 ? isoLocal(new Date(debut)) : today();
      const date = jourDebut > today() ? today() : jourDebut;
      set('session_started_at', null);
      set('session_ends_at', null);
      set('session_target', null);
      return { minutes, date };
    },

    /** Valide la journée ; les minutes s'ajoutent, le sujet aussi (Store.addSession). */
    addSession(minutes, { note = null, theme = null, date = today() } = {}) {
      const d = days();
      const existant = d[date];
      d[date] = {
        date,
        minutes: (existant?.minutes ?? 0) + Math.max(0, minutes),
        note: note ?? existant?.note ?? '',
        themes: [...(existant?.themes ?? []), ...(theme ? [theme] : [])],
        noteSeule: false,
        faite: true,
      };
      writeDays(d);
    },

    /** Le bravo attend le prochain écran ouvert. */
    setPendingCelebration: (m) => set('celebration_minutes', Math.max(0, m)),
    takePendingCelebration() {
      const m = get('celebration_minutes', null);
      if (m === null) return null;
      set('celebration_minutes', null);
      return m;
    },

    // --- Rotation des textes de ’hizouk --------------------------------------------
    chizukBag: (moment) => String(get(`chizuk_bag_${moment}`, '')).split('\n').filter((s) => s.trim() !== ''),
    chizukLast: (moment) => get(`chizuk_last_${moment}`, null) || null,
    setChizukBag(moment, sac, dernier) {
      set(`chizuk_bag_${moment}`, sac.join('\n'));
      set(`chizuk_last_${moment}`, dernier);
    },

    // --- Personne, langue, apparence ------------------------------------------------
    firstName: () => get('first_name', ''),
    setFirstName: (n) => set('first_name', String(n).trim()),
    /** « m » pour צדיק, « f » pour צדקת, comme Adresse.kt ; null tant que rien n'est choisi. */
    adresse: () => get('adresse', null),
    setAdresse: (a) => set('adresse', a),
    langueApp: () => get('langue_app', ''),
    setLangueApp: (l) => set('langue_app', l),
    modeApparence: () => get('apparence_mode', 'auto'),
    setModeApparence: (m) => set('apparence_mode', m),
    fond: () => get('apparence_fond', 'vert'),
    setFond: (f) => set('apparence_fond', f),
    accent: () => get('apparence_accent', 'vert'),
    setAccent: (a) => set('apparence_accent', a),
    onboardedVersion: () => get('onboarded_version', 0),
    setOnboardedVersion: (v) => set('onboarded_version', v),

    // --- Tikoun HaKlali ----------------------------------------------------------------
    /** Les psaumes dits aujourd'hui ; la liste se vide d'elle-même le lendemain. */
    tikkunDone() {
      if (get('tikkun_day', '') !== today()) return new Set();
      return new Set(String(get('tikkun_done', '')).split(',').map((s) => s.trim())
        .filter((s) => /^\d+$/.test(s)).map(Number));
    },
    /** Store.setTikkunDone : la liste du jour, triée, comme Android l'écrit. */
    setTikkunDone(numero, fait) {
      const courant = store.tikkunDone();
      if (fait) courant.add(numero); else courant.delete(numero);
      set('tikkun_day', today());
      set('tikkun_done', [...courant].sort((a, b) => a - b).join(','));
    },

    // --- Musique ------------------------------------------------------------------
    musicEnabled: () => get('music_enabled', true),
    setMusicEnabled: (v) => set('music_enabled', !!v),
    musicTrackId: () => get('music_track', null),
    setMusicTrackId: (id) => set('music_track', id),
    musicVolume: () => get('music_volume', DEFAULT_VOLUME),
    setMusicVolume: (v) => set('music_volume', Math.max(0, Math.min(100, Math.round(v)))),

    // --- Sauvegarde (Store.exportJson / importJson) ------------------------------------
    exportJson() {
      const root = {
        format: 'myhitbodedut',
        version: 1,
        exported_at: maintenant().toISOString(),
        days: Object.fromEntries(Object.values(days()).map((r) => [r.date, toJson(r)])),
        settings: {
          // Les réglages de la barrière et des rappels n'existent pas ici. Ils
          // sont gardés tels que l'import les a apportés, pour qu'un aller-
          // retour par l'iPhone ne les remette pas à zéro sur Android.
          window_start: get('window_start', DEFAULT_START),
          window_end: get('window_end', DEFAULT_END),
          snooze_minutes: get('snooze_minutes', DEFAULT_SNOOZE),
          target_minutes: store.targetMinutes(),
          daily_goal_minutes: get('daily_goal_minutes', 0),
          pause_shabbat: store.shabbatMode(),
          in_israel: store.inIsrael(),
          reminder_enabled: get('reminder_on', false),
          reminder_minutes: get('reminder_minutes', DEFAULT_REMINDER),
          music_enabled: store.musicEnabled(),
          music_volume: store.musicVolume(),
          music_track: store.musicTrackId() ?? '',
          adresse: store.adresse() ?? '',
          apparence_mode: store.modeApparence(),
          apparence_fond: store.fond(),
          apparence_accent: store.accent(),
        },
        paused_dates: [...store.pausedDates()],
        blocked_apps: get('blocked_apps', []),
      };
      return JSON.stringify(root, null, 2);
    },

    /** Fusionne une sauvegarde ; rend le nombre de journées importées, ou null si le fichier est invalide. */
    importJson(texte) {
      let root;
      try { root = JSON.parse(texte); } catch { return null; }
      if (!root || typeof root !== 'object' || root.format !== 'myhitbodedut') return null;

      const merged = days();
      let importees = 0;
      const jours = root.days && typeof root.days === 'object' ? root.days : {};
      const demain = ajouteJours(today(), 1);
      for (const [date, e] of Object.entries(jours)) {
        if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
        // Une vraie date, pas dans l'avenir (Store.importJson).
        if (!dateValide(date) || date >= demain) continue;
        const noteSeule = e.note_seule === true;
        const entrant = {
          date,
          minutes: Number.isInteger(e.minutes) ? Math.min(Math.max(e.minutes, 0), 24 * 60) : 0,
          note: typeof e.note === 'string' ? e.note.slice(0, NOTE_MAX) : '',
          themes: Array.isArray(e.themes) ? e.themes.filter((t) => typeof t === 'string' && t !== '') : [],
          noteSeule,
          faite: !noteSeule,
        };
        const existant = merged[date];
        // En conflit : la séance la plus longue, la note non vide, les sujets réunis.
        const seule = existant ? existant.noteSeule && entrant.noteSeule : entrant.noteSeule;
        merged[date] = existant ? {
          date,
          minutes: Math.max(existant.minutes, entrant.minutes),
          note: existant.note.trim() !== '' ? existant.note : entrant.note,
          themes: [...new Set([...existant.themes, ...entrant.themes])],
          noteSeule: seule,
          faite: !seule,
        } : entrant;
        importees++;
      }
      writeDays(merged);

      const s = root.settings && typeof root.settings === 'object' ? root.settings : null;
      if (s) {
        // Chaque valeur est ramenée dans ce que l'écran permet (Store.importJson).
        const entier = (cle, pref, min = 0, max = 24 * 60 - 1) => {
          if (Number.isInteger(s[cle]) && s[cle] >= min && s[cle] <= max) set(pref ?? cle, s[cle]);
        };
        const bool = (cle, pref) => { if (typeof s[cle] === 'boolean') set(pref ?? cle, s[cle]); };
        const texteNonVide = (cle, pref) => { if (typeof s[cle] === 'string' && s[cle].trim() !== '') set(pref ?? cle, s[cle]); };
        entier('window_start'); entier('window_end'); entier('snooze_minutes', null, 1, 240);
        entier('target_minutes', null, 1, 240); entier('daily_goal_minutes', null, 0, 240);
        bool('pause_shabbat'); bool('in_israel');
        bool('reminder_enabled', 'reminder_on'); entier('reminder_minutes');
        bool('music_enabled'); entier('music_volume', null, 0, 100);
        texteNonVide('music_track');
        if (s.adresse === 'm' || s.adresse === 'f') set('adresse', s.adresse);
        if (['auto', 'clair', 'sombre'].includes(s.apparence_mode)) set('apparence_mode', s.apparence_mode);
        if (['vert', 'blanc', 'sable', 'bleu', 'rose'].includes(s.apparence_fond)) set('apparence_fond', s.apparence_fond);
        if (['vert', 'bleu', 'violet', 'bordeaux', 'ambre', 'turquoise'].includes(s.apparence_accent)) set('apparence_accent', s.apparence_accent);
      }
      if (Array.isArray(root.paused_dates)) {
        const dates = store.pausedDates();
        root.paused_dates.forEach((d) => { if (typeof d === 'string' && dateValide(d)) dates.add(d); });
        set('paused_dates', [...dates]);
      }
      if (Array.isArray(root.blocked_apps)) {
        const apps = new Set(get('blocked_apps', []));
        root.blocked_apps.forEach((a) => { if (typeof a === 'string' && a.trim() !== '') apps.add(a); });
        set('blocked_apps', [...apps]);
      }
      return importees;
    },
  };
  return store;
}
