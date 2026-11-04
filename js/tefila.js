// Portage JavaScript de TefilaRules.java (KosherJava 2.5.0, Eliyahu Hershfeld),
// et de JewishCalendar.getTekufasTishreiElapsedDays, absents de kosher-zmanim
// 0.9.0. Ce fichier est sous licence LGPL 2.1, comme l'original
// (web/src/vendor/LICENCES.txt) ; il reste un module séparé, remplaçable.
//
// Ligne à ligne, sans rien ajouter : chaque fonction suit la méthode du même
// nom dans zmanim-2.5.0-sources.jar, avec les réglages par défaut de la
// classe. web/test/calendrier.test.mjs le compare jour par jour, de 2025 à
// 2030, à ce que KosherJava répond lui-même (vecteurs_kosherjava.json).

import { Calendar, JewishCalendar, JewishDate } from '../vendor/kosher-zmanim-0.9.0.min.js';

// Les réglages par défaut de TefilaRules (2.5.0).
const REGLAGES = Object.freeze({
  tachanunRecitedEndOfTishrei: true,
  tachanunRecitedWeekAfterShavuos: false,
  tachanunRecited13SivanOutOfIsrael: true,
  tachanunRecitedPesachSheni: false,
  tachanunRecited15IyarOutOfIsrael: true,
  tachanunRecitedMinchaErevLagBaomer: false,
  tachanunRecitedShivasYemeiHamiluim: true,
  tachanunRecitedWeekOfHod: true,
  tachanunRecitedWeekOfPurim: true,
  tachanunRecitedFridays: true,
  tachanunRecitedSundays: true,
  tachanunRecitedMinchaAllYear: true,
});

/** JewishCalendar.getTekufasTishreiElapsedDays (2.5.0). */
export function tekufasTishreiElapsedDays(jc) {
  // Jours depuis Roch Hachana de l'an 1, plus une demi-journée : la première
  // tekoufa de Tichri tombait neuf heures après le début du jour.
  const days = JewishDate.getJewishCalendarElapsedDays(jc.getJewishYear()) + (jc.getDaysSinceStartOfJewishYear() - 1) + 0.5;
  const solar = (jc.getJewishYear() - 1) * 365.25;
  return Math.floor(days - solar);
}

const r = REGLAGES;
const estAdarDePourim = (jc, month) => (!jc.isJewishLeapYear() && month === JewishDate.ADAR) || (jc.isJewishLeapYear() && month === JewishDate.ADAR_II);

export function isTachanunRecitedShacharis(jc) {
  const holidayIndex = jc.getYomTovIndex();
  const day = jc.getJewishDayOfMonth();
  const month = jc.getJewishMonth();
  return !(jc.getDayOfWeek() === Calendar.SATURDAY
    || (!r.tachanunRecitedSundays && jc.getDayOfWeek() === Calendar.SUNDAY)
    || (!r.tachanunRecitedFridays && jc.getDayOfWeek() === Calendar.FRIDAY)
    || month === JewishDate.NISSAN
    || (month === JewishDate.TISHREI && ((!r.tachanunRecitedEndOfTishrei && day > 8)
      || (r.tachanunRecitedEndOfTishrei && (day > 8 && day < 22))))
    || (month === JewishDate.SIVAN && ((r.tachanunRecitedWeekAfterShavuos && day < 7)
      || (!r.tachanunRecitedWeekAfterShavuos && day < (!jc.getInIsrael() && !r.tachanunRecited13SivanOutOfIsrael ? 14 : 13))))
    || (jc.isYomTov() && (!jc.isTaanis() || (!r.tachanunRecitedPesachSheni && holidayIndex === JewishCalendar.PESACH_SHENI)))
    || (!jc.getInIsrael() && !r.tachanunRecitedPesachSheni && !r.tachanunRecited15IyarOutOfIsrael
      && jc.getJewishMonth() === JewishDate.IYAR && day === 15)
    || holidayIndex === JewishCalendar.TISHA_BEAV || jc.isIsruChag()
    || jc.isRoshChodesh()
    || (!r.tachanunRecitedShivasYemeiHamiluim && estAdarDePourim(jc, month) && day > 22)
    || (!r.tachanunRecitedWeekOfPurim && estAdarDePourim(jc, month) && day > 10 && day < 18)
    || (jc.isUseModernHolidays()
      && (holidayIndex === JewishCalendar.YOM_HAATZMAUT || holidayIndex === JewishCalendar.YOM_YERUSHALAYIM))
    || (!r.tachanunRecitedWeekOfHod && month === JewishDate.IYAR && day > 13 && day < 21));
}

export function isTachanunRecitedMincha(jc) {
  // jc.clone() rend un JewishDate dans kosher-zmanim 0.9.0, sans les méthodes
  // de JewishCalendar : on refait le calendrier, avec les mêmes réglages.
  const tomorrow = new JewishCalendar(jc.getJewishYear(), jc.getJewishMonth(), jc.getJewishDayOfMonth(), jc.getInIsrael());
  tomorrow.setUseModernHolidays(jc.isUseModernHolidays());
  tomorrow.forward(Calendar.DATE, 1);
  return !(!r.tachanunRecitedMinchaAllYear
    || jc.getDayOfWeek() === Calendar.FRIDAY
    || !isTachanunRecitedShacharis(jc)
    || (!isTachanunRecitedShacharis(tomorrow)
      && !(tomorrow.getYomTovIndex() === JewishCalendar.EREV_ROSH_HASHANA)
      && !(tomorrow.getYomTovIndex() === JewishCalendar.EREV_YOM_KIPPUR)
      && !(tomorrow.getYomTovIndex() === JewishCalendar.PESACH_SHENI))
    || (!r.tachanunRecitedMinchaErevLagBaomer && tomorrow.getYomTovIndex() === JewishCalendar.LAG_BAOMER));
}

export function isVeseinTalUmatarRecited(jc) {
  if (jc.getJewishMonth() === JewishDate.NISSAN && jc.getJewishDayOfMonth() < 15) return true;
  if (jc.getJewishMonth() < JewishDate.CHESHVAN) return false;
  if (jc.getInIsrael()) return jc.getJewishMonth() !== JewishDate.CHESHVAN || jc.getJewishDayOfMonth() >= 7;
  return tekufasTishreiElapsedDays(jc) >= 47;
}

export const isVeseinBerachaRecited = (jc) => !isVeseinTalUmatarRecited(jc);

const isMashivHaruachStartDate = (jc) => jc.getJewishMonth() === JewishDate.TISHREI && jc.getJewishDayOfMonth() === 22;
const isMashivHaruachEndDate = (jc) => jc.getJewishMonth() === JewishDate.NISSAN && jc.getJewishDayOfMonth() === 15;

export function isMashivHaruachRecited(jc) {
  const startDate = new JewishDate(jc.getJewishYear(), JewishDate.TISHREI, 22);
  const endDate = new JewishDate(jc.getJewishYear(), JewishDate.NISSAN, 15);
  return jc.compareTo(startDate) > 0 && jc.compareTo(endDate) < 0;
}

export const isMoridHatalRecited = (jc) => !isMashivHaruachRecited(jc) || isMashivHaruachStartDate(jc) || isMashivHaruachEndDate(jc);

export function isHallelRecited(jc) {
  const day = jc.getJewishDayOfMonth();
  const month = jc.getJewishMonth();
  const holidayIndex = jc.getYomTovIndex();
  const inIsrael = jc.getInIsrael();
  if (jc.isRoshChodesh()) return true;
  if (jc.isChanukah()) return true;
  switch (month) {
    case JewishDate.NISSAN:
      if (day >= 15 && ((inIsrael && day <= 21) || (!inIsrael && day <= 22))) return true;
      break;
    case JewishDate.IYAR:
      if (jc.isUseModernHolidays() && (holidayIndex === JewishCalendar.YOM_HAATZMAUT || holidayIndex === JewishCalendar.YOM_YERUSHALAYIM)) return true;
      break;
    case JewishDate.SIVAN:
      if (day === 6 || (!inIsrael && day === 7)) return true;
      break;
    case JewishDate.TISHREI:
      if (day >= 15 && (day <= 22 || (!inIsrael && day <= 23))) return true;
      break;
    default:
  }
  return false;
}

export function isHallelShalemRecited(jc) {
  const day = jc.getJewishDayOfMonth();
  const month = jc.getJewishMonth();
  const inIsrael = jc.getInIsrael();
  if (!isHallelRecited(jc)) return false;
  return !((jc.isRoshChodesh() && !jc.isChanukah())
    || (month === JewishDate.NISSAN && ((inIsrael && day > 15) || (!inIsrael && day > 16))));
}

export const isAlHanissimRecited = (jc) => jc.isPurim() || jc.isChanukah();

export const isYaalehVeyavoRecited = (jc) => jc.isPesach() || jc.isShavuos() || jc.isRoshHashana() || jc.isYomKippur()
  || jc.isSuccos() || jc.isShminiAtzeres() || jc.isSimchasTorah() || jc.isRoshChodesh();
