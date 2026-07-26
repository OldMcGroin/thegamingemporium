(function(){
  function getFeedUrl(){
    try {
      var origin = (window.location && window.location.origin) ? window.location.origin : '';
      origin = origin.replace(/\/$/, '');
      return origin + '/rss.xml';
    } catch (e) {
      return '/rss.xml';
    }
  }

  function showInlineCopied(btn){
    try {
      var wrap = btn.closest('.rss-copy-wrap');
      if (!wrap) return;
      var badge = wrap.querySelector('.rss-copied');
      if (!badge) return;
      badge.classList.add('is-show');
      clearTimeout(showInlineCopied._to);
      showInlineCopied._to = setTimeout(function(){
        badge.classList.remove('is-show');
      }, 1500);
    } catch (e) {}
  }

  async function copyText(text){
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}

    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly','');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.left = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function onClick(e){
    var btn = e.target.closest('[data-copy-rss]');
    if (!btn) return;
    e.preventDefault();
    var url = getFeedUrl();
    copyText(url).then(function(ok){
      if (ok) {
        showInlineCopied(btn);
      } else {
        // Fallback: at least open the feed so user can copy manually
        try { window.open('/rss.xml', '_blank', 'noopener'); } catch(e) {}
        showInlineCopied(btn);
      }
    });
  }

  document.addEventListener('click', onClick);
})();
