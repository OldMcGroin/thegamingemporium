(() => {
  // Home-card image randomiser ("shuffle bag").
  // - Reads candidates from data-random-srcs (a JSON array)
  // - Uses a per-card "bag" stored in sessionStorage
  // - Each image is removed from the bag after being shown
  // - No repeats until the bag is exhausted, then it refills and reshuffles
  // - Exposes window.shuffleHomeImages() for the dev-only Shuffle button

function isTouch(){
  // Prefer explicit marker set by baseof inline script, but fall back to feature detection.
  try {
    if (document.documentElement.classList.contains('is-touch')) return true;
    if (document.documentElement.getAttribute('data-touch') === 'true') return true;
  } catch(e){}
  try {
    return ('ontouchstart' in window) || (navigator && navigator.maxTouchPoints > 0);
  } catch(e){
    return false;
  }
}

function safeParse(raw) {
    // Hugo *should* render data-random-srcs as a JSON array string, e.g.
    //   ["/Images/Home/all-1.webp","/Images/Home/all-2.webp"]
    // In some environments it can end up percent-encoded (%22 for quotes),
    // or HTML-escaped (&quot;). We defensively normalise before JSON.parse.
    let json = raw;
    if (json == null) json = '[]';
    if (typeof json !== 'string') json = String(json);
    json = json.trim();

    // Fix percent-encoding (e.g. [%22/Images/Home/...%22])
    if (/%22|%5B|%5D|%2F/i.test(json)) {
      try {
        json = decodeURIComponent(json);
      } catch {
        // ignore
      }
    }

    // Fix common HTML escaping
    json = json
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#39;/g, "'");

    try {
      const v = JSON.parse(json);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function shuffled(array) {
    // Fisher–Yates
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function guessBagKey(list) {
    // Try to derive a stable key per home card from filenames like:
    //   /Images/Home/recent-additions-8.webp
    //   /Images/Home/categories-12.webp
    // Falls back to a key based on list length.
    try {
      const sample = list && list[0] ? String(list[0]) : '';
      const path = normalize(sample);
      const file = path.split('/').pop() || '';
      const noExt = file.replace(/\.[a-z0-9]+$/i, '');
      const base = noExt.replace(/-\d+$/i, '');
      if (base) return base;
    } catch (e) {}
    return `home-${(list && list.length) ? list.length : 0}`;
  }

  function pickFromBag(keySuffix, list, currentSrc) {
    // Bag lives for the lifetime of the browser tab/session.
    const storageKey = `tge_home_bag_${keySuffix}`;
    let bag = [];

    try {
      bag = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(bag)) bag = [];
    } catch {
      bag = [];
    }

    const curNorm = normalize(currentSrc || '');

    // If empty, refill with a shuffled copy of the full list.
    if (bag.length === 0) {
      bag = shuffled(list.slice());
    }

    // Avoid immediately re-showing the current image when possible.
    if (curNorm) {
      bag = bag.filter((u) => normalize(u) !== curNorm);
      if (bag.length === 0) {
        // If removing current emptied the bag, refill without current.
        bag = shuffled(list.filter((u) => normalize(u) !== curNorm));
      }
    }

    if (bag.length === 0) return null;

    const picked = bag.pop();

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(bag));
    } catch {
      // If storage is unavailable (rare), just behave like normal randomness.
    }

    return picked;
  }

  function normalize(url) {
    // Compare by pathname-ish suffix to avoid absolute vs relative mismatches.
    try {
      const u = new URL(url, document.baseURI);
      return u.pathname;
    } catch {
      return String(url || '');
    }
  }

  function applyToImage(img) {
    const touch = isTouch();
    const raw = (touch && img.getAttribute('data-random-srcs')) ? img.getAttribute('data-random-srcs') : (img.getAttribute('data-random-srcs') || '[]');
    const list = safeParse(raw);
    if (list.length === 0) return false;

    const current = img.getAttribute('src') || '';
    const key = img.getAttribute('data-random-key') || guessBagKey(list);
    let chosen = null;
    try {
      chosen = pickFromBag(key, list, current);
    } catch {
      chosen = null;
    }
    if (!chosen) {
      // Fallback: pure randomness if sessionStorage is unavailable.
      chosen = list[Math.floor(Math.random() * list.length)];
    }
    if (!chosen) return false;

    // Resolve relative URLs reliably under any baseURL/subpath.
    let finalUrl = chosen;
    try {
      finalUrl = new URL(chosen, document.baseURI).toString();
    } catch {
      // keep as-is
    }

    img.src = finalUrl;
    img.loading = 'eager';
    img.decoding = 'async';
    return true;
  }

  function run() {
    let imgs = Array.from(document.querySelectorAll('img[data-random-srcs]'));
    if (imgs.length === 0) return 0;

    // IMPORTANT: On the home page we render both desktop + mobile <img> tags.
    // Device "touch" detection is unreliable (Steam Deck, 2-in-1 laptops, etc.).
    // Instead, only randomise the image that is actually visible.
    // (Hidden images have no layout box.)
    imgs = imgs.filter((img) => {
      try {
        if (img.closest('[hidden]')) return false;
        const rects = img.getClientRects();
        if (!rects || rects.length === 0) return false;
        if (img.offsetWidth === 0 && img.offsetHeight === 0) return false;
        return true;
      } catch {
        return true;
      }
    });

    if (imgs.length === 0) return 0;
    let changed = 0;
    imgs.forEach((img) => {
      if (applyToImage(img)) changed++;
    });
    return changed;
  }

  // Expose hook for the Shuffle button in dev mode.
  // Returns the number of <img> elements updated.
  window.shuffleHomeImages = () => run();

  // Randomise once per page load.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => run());
  } else {
    run();
  }
})();
