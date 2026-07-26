(() => {
  // Lazy-load <img> elements that store the real image path in data-src.
  // Cards begin with a lightweight placeholder as src.

  const imgs = Array.from(document.querySelectorAll('img[data-src]'));
  if (imgs.length === 0) return;

  function loadImg(img) {
    const real = img.getAttribute('data-src');
    if (!real) return;

    // Prevent double-loading
    if (img.dataset.loading === '1') return;
    img.dataset.loading = '1';

    // Keep the blurred placeholder class until the real image finishes loading.
    const onLoad = () => {
      img.removeEventListener('load', onLoad);
      img.classList.add('is-loaded');
      img.classList.remove('lazy-img');
      img.removeAttribute('data-src');
      delete img.dataset.loading;
    };

    const onError = () => {
      img.removeEventListener('error', onError);
      // Fall back silently (the template already adds an onerror handler)
      delete img.dataset.loading;
    };

    img.addEventListener('load', onLoad, { once: true });
    img.addEventListener('error', onError, { once: true });
    img.src = real;
  }

  // If IntersectionObserver isn't available, load everything immediately.
  if (!('IntersectionObserver' in window)) {
    imgs.forEach(loadImg);
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        loadImg(img);
        obs.unobserve(img);
      });
    },
    {
      // Start loading slightly before the image scrolls into view.
      root: null,
      // Larger margin helps on mobile fast scrolling.
      rootMargin: '800px 0px',
      threshold: 0.01,
    }
  );

  imgs.forEach((img) => observer.observe(img));
})();
