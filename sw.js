// Hors connexion.
//
// La coquille (code, chaînes, textes, illustrations : ~1 Mo) est gardée à
// l'installation. La musique ne l'est pas d'office : chaque morceau est
// gardé la première fois qu'on l'écoute, puis servi depuis le téléphone.
//
// Safari lit un morceau par tranches (en-tête Range) et exige qu'on lui
// réponde tranche par tranche (206) : un fichier entier en réponse à une
// tranche ne se lit pas. D'où tranche().

const VERSION = '9e2f64774fa3';
const COQUILLE = ["./","app.css","data/bibliotheque.json","data/chizuk.json","data/musique.json","data/strings.en.json","data/strings.fr.json","data/strings.he.json","data/tikkun_haklali.json","icones/apple-touch-icon.png","icones/ic_chevron.svg","icones/ic_nav_journal.svg","icones/ic_nav_settings.svg","icones/ic_nav_texts.svg","icones/ic_nav_today.svg","icones/icon-192.png","icones/icon-512.png","img/char_arms_raised.webp","img/char_dancing.webp","img/char_dancing_joy.webp","img/char_face.webp","img/char_guitar.webp","img/char_offering.webp","img/char_open_arms.webp","img/char_pointing.webp","img/char_praise.webp","img/char_praying.webp","img/char_reading_seated.webp","img/char_sitting_low.webp","img/char_standing_back.webp","img/char_tehilim.webp","img/char_thinking.webp","img/char_thumbs_up.webp","img/char_torah.webp","img/char_walking.webp","img/char_welcome.webp","img/char_writing.webp","img/ic_launcher_face.webp","js/app.js","js/calendrier.js","js/chizuk.js","js/i18n.js","js/regles.js","js/seance.js","js/store.js","manifest.webmanifest","palettes.css"];
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
