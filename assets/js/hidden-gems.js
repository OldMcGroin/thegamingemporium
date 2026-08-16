(function(){
  'use strict';

  var modal = document.querySelector('[data-hidden-gems-modal]');
  if(!modal) return;

  var openButtons = Array.prototype.slice.call(document.querySelectorAll('[data-hidden-gems-open]'));
  var closeButtons = Array.prototype.slice.call(modal.querySelectorAll('[data-hidden-gems-close]'));
  var list = modal.querySelector('[data-hidden-gems-list]');
  var message = modal.querySelector('[data-hidden-gems-message]');
  var refresh = modal.querySelector('[data-hidden-gems-refresh]');

  var CACHE_MS = 5 * 60 * 1000;
  var lastLoaded = 0;
  var loading = false;

  function data(){
    return (window.TGE_FEATURE_DATA && window.TGE_FEATURE_DATA.hiddenGems) || [];
  }

  function shuffle(arr){
    var copy = arr.slice();
    for(var i = copy.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  function chunks(arr, size){
    var out = [];
    for(var i=0; i<arr.length; i+=size) out.push(arr.slice(i, i+size));
    return out;
  }

  function setMessage(text){
    if(message) message.textContent = text || '';
  }

  function open(){
    modal.hidden = false;
    document.body.classList.add('has-hidden-gems-modal');
    var close = modal.querySelector('.hidden-gems-modal__close');
    if(close) close.focus();
    if(!lastLoaded || (Date.now() - lastLoaded) > CACHE_MS) load(false);
  }

  function close(){
    modal.hidden = true;
    document.body.classList.remove('has-hidden-gems-modal');
  }

  function lookupInfo(id){
    var direct = window.__GAMES_BY_SLUG__ && window.__GAMES_BY_SLUG__[id];
    if(direct) return direct;
    return null;
  }

  function render(rows){
    if(!list) return;
    list.innerHTML = '';
    if(!rows.length){
      list.innerHTML = '<div class="hidden-gems-modal__empty">Not enough click data yet to pick Hidden Gems. Try again later.</div>';
      return;
    }

    rows.forEach(function(row){
      var info = lookupInfo(String(row.id || ''));
      if(!info || !info.url) return;

      var a = document.createElement('a');
      a.className = 'hidden-gem';
      a.href = info.url;
      if(/^https?:\/\//i.test(info.url)){
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }

      var icon = document.createElement('span');
      icon.className = 'hidden-gem__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '💎';

      var text = document.createElement('span');
      text.className = 'hidden-gem__text';
      var title = document.createElement('strong');
      title.textContent = info.title || String(row.id || '');
      var meta = document.createElement('span');
      meta.textContent = info.categoryLabel || 'Hidden Gem';
      text.appendChild(title);
      text.appendChild(meta);

      var arrow = document.createElement('span');
      arrow.className = 'hidden-gem__arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';

      a.appendChild(icon);
      a.appendChild(text);
      a.appendChild(arrow);
      list.appendChild(a);
    });
  }

  function chooseGems(rows){
    // Only titles with at least one recorded click can be evaluated.
    var clicked = rows.filter(function(r){ return Number(r && r.count || 0) > 0; });
    if(!clicked.length) return [];

    clicked.sort(function(a,b){ return Number(a.count || 0) - Number(b.count || 0); });

    // Hidden Gems come from the lower-engagement portion of a random sample,
    // rather than simply returning the absolute least-clicked titles every time.
    var lowerPoolSize = Math.max(10, Math.ceil(clicked.length * 0.45));
    var lowerPool = clicked.slice(0, Math.min(clicked.length, lowerPoolSize));
    return shuffle(lowerPool).slice(0, 10);
  }

  function load(force){
    if(loading) return;
    if(!force && lastLoaded && (Date.now() - lastLoaded) < CACHE_MS) return;

    var eligible = data();
    if(!eligible.length){
      setMessage('No eligible projects found.');
      render([]);
      return;
    }

    loading = true;
    if(refresh) refresh.disabled = true;
    setMessage('Finding overlooked projects…');
    if(list) list.innerHTML = '';

    // Hidden Gems now has a purpose-built Worker mode. The old implementation
    // tried to probe the all-time Top endpoint with thousands of random IDs,
    // which was fragile and could legitimately return no usable rows. D1 now
    // returns a broad pool of low-click projects in one request; we then apply
    // the 30-day/known-project eligibility list generated at build time.
    var eligibleSet = Object.create(null);
    eligible.forEach(function(id){ eligibleSet[String(id)] = true; });

    var isLocal = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    var url = isLocal
      ? 'https://thegamingemporium.com/api/top?mode=hidden&limit=100'
      : '/api/top?mode=hidden&limit=100';

    fetch(url, {cache:'no-store'})
      .then(function(r){
        if(!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(payload){
        var rows = payload && payload.ok && Array.isArray(payload.top) ? payload.top : [];
        var candidates = rows.filter(function(row){
          var id = String(row && row.id || '');
          return id && eligibleSet[id] && Number(row.count || 0) > 0 && lookupInfo(id);
        });
        var gems = chooseGems(candidates);
        render(gems);
        setMessage(gems.length ? 'A fresh selection of overlooked projects.' : 'No established low-click projects are available yet.');
        lastLoaded = Date.now();
      })
      .catch(function(){
        render([]);
        setMessage('Hidden Gems needs the updated popularity Worker.');
      })
      .then(function(){
        loading = false;
        if(refresh) refresh.disabled = false;
      });
  }

  openButtons.forEach(function(btn){ btn.addEventListener('click', open); });
  closeButtons.forEach(function(btn){ btn.addEventListener('click', close); });
  if(refresh) refresh.addEventListener('click', function(){ lastLoaded = 0; load(true); });

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && !modal.hidden) close();
  });
})();
