(function(){
  'use strict';

  var modal = document.querySelector('[data-rising-modal]');
  if(!modal) return;

  var openButtons = Array.prototype.slice.call(document.querySelectorAll('[data-rising-open]'));
  var closeButtons = Array.prototype.slice.call(modal.querySelectorAll('[data-rising-close]'));
  var list = modal.querySelector('[data-rising-list]');
  var message = modal.querySelector('[data-rising-message]');
  var loading = false;
  var lastLoaded = 0;
  var CACHE_MS = 5 * 60 * 1000;

  function setMessage(text){
    if(message) message.textContent = text || '';
  }

  function lookupInfo(id){
    return window.__GAMES_BY_SLUG__ && window.__GAMES_BY_SLUG__[id] || null;
  }

  function open(){
    modal.hidden = false;
    document.body.classList.add('has-rising-modal');
    var close = modal.querySelector('.rising-modal__close');
    if(close) close.focus();
    if(!lastLoaded || (Date.now() - lastLoaded) > CACHE_MS) load();
  }

  function close(){
    modal.hidden = true;
    document.body.classList.remove('has-rising-modal');
  }

  function render(rows){
    if(!list) return;
    list.innerHTML = '';

    var rendered = 0;
    rows.forEach(function(row, index){
      var info = lookupInfo(String(row && row.id || ''));
      if(!info || !info.url) return;

      var a = document.createElement('a');
      a.className = 'rising-item';
      a.href = info.url;
      if(/^https?:\/\//i.test(info.url)){
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }

      var rank = document.createElement('span');
      rank.className = 'rising-item__rank';
      rank.textContent = String(index + 1);

      var text = document.createElement('span');
      text.className = 'rising-item__text';
      var title = document.createElement('strong');
      title.textContent = info.title || String(row.id || '');
      var meta = document.createElement('span');
      meta.textContent = (info.categoryLabel || 'Project') + ' · ↑ Gaining momentum';
      text.appendChild(title);
      text.appendChild(meta);

      var arrow = document.createElement('span');
      arrow.className = 'rising-item__arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';

      a.appendChild(rank);
      a.appendChild(text);
      a.appendChild(arrow);
      list.appendChild(a);
      rendered += 1;
    });

    if(!rendered){
      list.innerHTML = '<div class="rising-modal__empty">Not enough recent click history yet to identify anything Rising.</div>';
    }
    return rendered;
  }

  function load(){
    if(loading) return;
    loading = true;
    setMessage('Finding projects on the rise…');
    if(list) list.innerHTML = '';

    var isLocal = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    var url = isLocal
      ? 'https://thegamingemporium.com/api/top?mode=rising&limit=10'
      : '/api/top?mode=rising&limit=10';

    fetch(url, {cache:'no-store'})
      .then(function(r){
        if(!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(payload){
        var rows = payload && payload.ok && Array.isArray(payload.top) ? payload.top : [];
        rows = rows.filter(function(row){ return lookupInfo(String(row && row.id || '')); });
        var count = render(rows);
        setMessage(count ? '' : 'Nothing is rising strongly enough yet.');
        lastLoaded = Date.now();
      })
      .catch(function(){
        render([]);
        setMessage('Rising needs the updated popularity Worker.');
      })
      .then(function(){ loading = false; });
  }

  openButtons.forEach(function(btn){ btn.addEventListener('click', open); });
  closeButtons.forEach(function(btn){ btn.addEventListener('click', close); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && !modal.hidden) close();
  });
})();
