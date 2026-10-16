// Hors connexion.
//
// La coquille (code, chaînes, textes, illustrations, livres et biographies : ~24 Mo) est gardée à
// l'installation, pour que tout se lise hors connexion. La musique ne l'est pas d'office : chaque morceau est
// gardé la première fois qu'on l'écoute, puis servi depuis le téléphone.
//
// Safari lit un morceau par tranches (en-tête Range) et exige qu'on lui
// réponde tranche par tranche (206) : un fichier entier en réponse à une
// tranche ne se lit pas. D'où tranche().

const VERSION = '55704a3fd02a';
const COQUILLE = ["./","app.css","data/ben_ish_hai.json","data/bibliotheque.json","data/chizuk.json","data/hilloulot.json","data/hilloulot_bios.json","data/livres.json","data/musique.json","data/siddur_annotations.json","data/siddur_ashkenaz.json","data/siddur_edot.json","data/siddur_sefard.json","data/strings.en.json","data/strings.fr.json","data/strings.he.json","data/tehilim.json","data/tikkun_haklali.json","data/villes.json","data/yalkut_yosef.json","icones/apple-touch-icon.png","icones/ic_chevron.svg","icones/ic_nav_journal_off.svg","icones/ic_nav_journal_on.svg","icones/ic_nav_settings_off.svg","icones/ic_nav_settings_on.svg","icones/ic_nav_texts_off.svg","icones/ic_nav_texts_on.svg","icones/ic_nav_today_off.svg","icones/ic_nav_today_on.svg","icones/ic_nav_zmanim_off.svg","icones/ic_nav_zmanim_on.svg","icones/icon-192.png","icones/icon-512.png","img/char_arms_raised.webp","img/char_dancing.webp","img/char_dancing_joy.webp","img/char_debout.webp","img/char_face.webp","img/char_guitar.webp","img/char_matsa.webp","img/char_offering.webp","img/char_open_arms.webp","img/char_pointing.webp","img/char_praise.webp","img/char_praying.webp","img/char_purim.webp","img/char_shabbat.webp","img/char_standing_back.webp","img/char_tefillin.webp","img/char_tehilim.webp","img/char_thinking.webp","img/char_thumbs_up.webp","img/char_torah.webp","img/char_walking.webp","img/char_welcome.webp","img/char_writing.webp","img/ic_launcher_face.webp","img/scene_airport.webp","img/scene_hanukkah.webp","img/scene_nature.webp","img/scene_ouverture_tombe.webp","img/scene_sleeping.webp","img/scene_sukkot.webp","js/app.js","js/calendrier-juif.js","js/calendrier.js","js/chizuk.js","js/halakha.js","js/i18n.js","js/jour-affiche.js","js/paliers.js","js/regles.js","js/seance.js","js/siddur-jour.js","js/store.js","js/tefila.js","js/trophees-formes.js","js/trophees.js","js/yalkut.js","js/zmanim.js","manifest.webmanifest","palettes.css","polices/OFL-DavidLibre.txt","polices/OFL-FrankRuhlLibre.txt","polices/OFL-MiriamLibre.txt","polices/OFL-NotoRashiHebrew.txt","polices/OFL-NotoSerifHebrew.txt","polices/OFL-VarelaRound.txt","polices/david_libre.ttf","polices/david_libre_bold.ttf","polices/frank_ruhl.ttf","polices/hebreu_serif_bold.woff2","polices/hebreu_serif_regular.woff2","polices/miriam_libre.ttf","polices/noto_rashi.ttf","polices/varela_round.ttf","vendor/LICENCES.txt","vendor/kosher-zmanim-0.9.0.min.js"];
const CACHE_COQUILLE = `coquille-${VERSION}`;
const CACHE_MUSIQUE = 'musique-1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_COQUILLE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom.startsWith('coquille-') && nom !== CACHE_COQUILLE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

async function tranche(requete, reponse) {
  const plage = requete.headers.get('range');
  if (!plage) return reponse;
  const corps = await reponse.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(plage);
  const taille = corps.size;
  let debut = m && m[1] !== '' ? Number(m[1]) : 0;
  let fin = m && m[2] !== '' ? Number(m[2]) : taille - 1;
  if (m && m[1] === '' && m[2] !== '') { debut = Math.max(0, taille - Number(m[2])); fin = taille - 1; }
  fin = Math.min(fin, taille - 1);
  if (debut > fin) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${taille}` } });
  return new Response(corps.slice(debut, fin + 1), {
    status: 206,
    headers: {
      'Content-Type': reponse.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${debut}-${fin}/${taille}`,
      'Content-Length': String(fin - debut + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.includes('/musique/')) {
    const cle = url.origin + url.pathname;
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_MUSIQUE);
      const garde = await cache.match(cle);
      if (garde) return tranche(e.request, garde);
      // Première écoute : le réseau sert la lecture, et le morceau entier
      // est gardé en même temps pour la suivante.
      e.waitUntil(fetch(cle).then((r) => (r.ok && r.status === 200 ? cache.put(cle, r) : null)).catch(() => {}));
      return fetch(e.request);
    })());
    return;
  }

  // La coquille : d'abord le téléphone, le réseau sinon. Une page ouverte
  // (navigation) retombe sur l'accueil gardé.
  e.respondWith((async () => {
    const garde = await caches.match(e.request, { ignoreSearch: true });
    if (garde) return garde;
    try {
      return await fetch(e.request);
    } catch (err) {
      if (e.request.mode === 'navigate') {
        const accueil = await caches.match('./');
        if (accueil) return accueil;
      }
      throw err;
    }
  })());
});
