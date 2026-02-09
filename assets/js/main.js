(function(){
  function uniqSorted(arr){
    return Array.from(new Set(arr)).sort(function(a,b){ return a.localeCompare(b); });
  }

  function initCarousel(){
    var car = document.querySelector('[data-carousel]');
    if(!car) return;
    var viewport = car.querySelector('.carousel__track');
    var slidesEl = car.querySelector('.carousel__slides');
    if(!viewport || !slidesEl) return;
    var slides = Array.from(slidesEl.querySelectorAll('.carousel__slide'));
    var idx = 0;

    function go(i){
      idx = (i + slides.length) % slides.length;
      // Use pixel-based offsets so mobile "peek" (non-100% slides) still aligns correctly
      var slideW = slides[0] ? slides[0].getBoundingClientRect().width : viewport.getBoundingClientRect().width;
      // read gap from computed style (default 0)
      var gap = 0;
      try {
        var cs = window.getComputedStyle(slidesEl);
        gap = parseFloat(cs.columnGap || cs.gap || "0") || 0;
      } catch(e){ gap = 0; }
      var step = slideW + gap;
      slidesEl.style.transform = 'translateX(' + (-idx * step) + 'px)';
      slides.forEach(function(s,k){ s.setAttribute('aria-hidden', k===idx ? 'false' : 'true'); });
    }

    var prev = car.querySelector('[data-carousel-prev]');
    var next = car.querySelector('[data-carousel-next]');
    if(prev) prev.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); go(idx-1); });
    if(next) next.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); go(idx+1); });

    window.addEventListener('resize', function(){ go(idx); });

    // keyboard
    document.addEventListener('keydown', function(e){
      if(e.key === 'ArrowLeft') go(idx-1);
      if(e.key === 'ArrowRight') go(idx+1);
    });

    // touch / pointer swipe (mobile-friendly)
    var startX = 0, startY = 0, dragging = false, hasMoved = false;
    var pointerId = null;

    function onStart(clientX, clientY, pid){
      startX = clientX; startY = clientY;
      dragging = true; hasMoved = false; pointerId = pid || null;
      // disable transition during drag if CSS uses it
      slidesEl.classList.add('is-dragging');
    }

    function onMove(clientX, clientY){
      if(!dragging) return;
      var dx = clientX - startX;
      var dy = clientY - startY;
      if(!hasMoved){
        // if mostly vertical, abort so page can scroll
        if(Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8){
          dragging = false;
          slidesEl.classList.remove('is-dragging');
          return;
        }
        if(Math.abs(dx) > 6) hasMoved = true;
      }
      if(!hasMoved) return;
      // translate based on drag (px) so it works with peek layout
      var slideW = slides[0] ? slides[0].getBoundingClientRect().width : (viewport.getBoundingClientRect().width || 1);
      var gap = 0;
      try { var cs = window.getComputedStyle(slidesEl); gap = parseFloat(cs.columnGap || cs.gap || '0') || 0; } catch(e){ gap = 0; }
      var step = slideW + gap;
      slidesEl.style.transform = 'translateX(' + ((-idx * step) + dx) + 'px)';
    }

    function onEnd(clientX, clientY){
      if(!dragging){ return; }
      var dx = clientX - startX;
      var w = viewport.getBoundingClientRect().width || 1;
      slidesEl.classList.remove('is-dragging');
      dragging = false;
      // decide slide change
      if(Math.abs(dx) > Math.max(40, w*0.12)){
        if(dx < 0) go(idx+1); else go(idx-1);
      } else {
        go(idx);
      }
    }

    // Pointer events (modern browsers)
    if(window.PointerEvent){
      viewport.addEventListener('pointerdown', function(e){
        if(e.pointerType === 'mouse') return; // keep mouse behavior as buttons/keys
        viewport.setPointerCapture && viewport.setPointerCapture(e.pointerId);
        onStart(e.clientX, e.clientY, e.pointerId);
      }, {passive:true});

      viewport.addEventListener('pointermove', function(e){
        if(pointerId !== null && e.pointerId !== pointerId) return;
        onMove(e.clientX, e.clientY);
      }, {passive:true});

      viewport.addEventListener('pointerup', function(e){
        if(pointerId !== null && e.pointerId !== pointerId) return;
        onEnd(e.clientX, e.clientY);
        pointerId = null;
      }, {passive:true});

      viewport.addEventListener('pointercancel', function(){
        slidesEl.classList.remove('is-dragging');
        dragging = false; pointerId = null; go(idx);
      }, {passive:true});
    } else {
      // Touch fallback
      viewport.addEventListener('touchstart', function(e){
        if(!e.touches || !e.touches.length) return;
        var t = e.touches[0];
        onStart(t.clientX, t.clientY);
      }, {passive:true});

      viewport.addEventListener('touchmove', function(e){
        if(!e.touches || !e.touches.length) return;
        var t = e.touches[0];
        onMove(t.clientX, t.clientY);
      }, {passive:true});

      viewport.addEventListener('touchend', function(e){
        var t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
        onEnd(t ? t.clientX : startX, t ? t.clientY : startY);
      }, {passive:true});
    }


    go(0);
  }

  
  function __getCardWeight(card){
    var w = card && card.getAttribute ? card.getAttribute('data-weight') : null;
    var n = parseFloat(w);
    return isNaN(n) ? 0 : n;
  }
function initGameGrids(){
    document.querySelectorAll('[data-game-grid]')
      .forEach(function(wrapper){
        var grid = wrapper.querySelector('.game-grid');
        if(!grid) return;
        var cards = Array.from(grid.querySelectorAll('.game-card'));

        // Support legacy attr `data-genre-filter` and current `data-genre`
        var genreSelect = wrapper.querySelector('select[data-genre], select[data-genre-filter]');
        var sortSelect  = wrapper.querySelector('select[data-sort]');

        // Populate genres from cards
        if(genreSelect){
          var genres = [];
          cards.forEach(function(card){
            var g = (card.getAttribute('data-genres')||"").split('|').map(function(x){ return x.trim(); }).filter(Boolean);
            genres = genres.concat(g);
          });
          genres = uniqSorted(genres);

          // keep first option (All)
          genreSelect.innerHTML = '';
          var optAll = document.createElement('option');
          optAll.value = '';
          optAll.textContent = 'All';
          genreSelect.appendChild(optAll);
          genres.forEach(function(g){
            var opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            genreSelect.appendChild(opt);
          });
        }

        function applyFilter(){
          var selectedGenre = genreSelect ? genreSelect.value : '';
          cards.forEach(function(card){
            var g = (card.getAttribute('data-genres')||"");
            var show = !selectedGenre || g.split('|').map(function(x){return x.trim();}).indexOf(selectedGenre) !== -1;
            card.style.display = show ? '' : 'none';
          });
        }

        function applySort(){
          if(!sortSelect) return;
          var mode = sortSelect.value || 'az';
          var visibleCards = cards.slice();
          visibleCards.sort(function(a,b){
            var wa = __getCardWeight(a);
            var wb = __getCardWeight(b);
            if(wa !== wb) return wa - wb;

            var ta = (a.getAttribute('data-title')||'').toLowerCase();
            var tb = (b.getAttribute('data-title')||'').toLowerCase();
            var cmp = ta.localeCompare(tb);
            return mode === 'za' ? -cmp : cmp;
          });
          visibleCards.forEach(function(c){ grid.appendChild(c); });
        }

        if(genreSelect){ genreSelect.addEventListener('change', function(){ applyFilter(); }); }
        if(sortSelect){ sortSelect.addEventListener('change', function(){ applySort(); }); }

        // initial
        applyFilter();
        applySort();
      });
  }

  function initSeriesGrids(){
    document.querySelectorAll('[data-series-grid]')
      .forEach(function(wrapper){
        var grid = wrapper.querySelector('.series-grid');
        if(!grid) return;
        var cards = Array.from(grid.querySelectorAll('.series-card'));
        var sortSelect = wrapper.querySelector('select[data-sort]');
        if(!sortSelect) return;

        function applySort(){
          var mode = sortSelect.value || 'az';
          var sorted = cards.slice().sort(function(a,b){
            var ta = (a.getAttribute('data-title')||'').toLowerCase();
            var tb = (b.getAttribute('data-title')||'').toLowerCase();
            var cmp = ta.localeCompare(tb);
            return mode === 'za' ? -cmp : cmp;
          });
          sorted.forEach(function(c){ grid.appendChild(c); });
        }

        sortSelect.addEventListener('change', applySort);
        applySort();
      });
  }

  function initGenreGrids(){
    document.querySelectorAll('[data-genre-grid]')
      .forEach(function(wrapper){
        var grid = wrapper.querySelector('.genre-grid');
        if(!grid) return;
        var cards = Array.from(grid.querySelectorAll('.genre-card'));
        var sortSelect = wrapper.querySelector('select[data-sort]');
        if(!sortSelect) return;

        function applySort(){
          var mode = sortSelect.value || 'az';
          var sorted = cards.slice().sort(function(a,b){
            var ta = (a.getAttribute('data-title')||'').toLowerCase();
            var tb = (b.getAttribute('data-title')||'').toLowerCase();
            var cmp = ta.localeCompare(tb);
            return mode === 'za' ? -cmp : cmp;
          });
          sorted.forEach(function(c){ grid.appendChild(c); });
        }

        sortSelect.addEventListener('change', applySort);
        applySort();
      });
  }

  // --- Popularity tracking + "Most Popular" home card ---
  function slugifyTitle(str){
    try {
      return String(str || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    } catch(e) {
      return String(str || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
  }

  function initPopularityTracking(){
    // Best-effort: never block navigation.
    var lastSent = Object.create(null);

    // Session-level de-duplication for impressions (views)
    var seenKey = 'tge_seen_game_impressions_v1';
    var seen = Object.create(null);
    try {
      var raw = sessionStorage.getItem(seenKey);
      if(raw){
        var arr = JSON.parse(raw);
        if(Array.isArray(arr)){
          for(var i=0;i<arr.length;i++) seen[arr[i]] = true;
        }
      }
    } catch(e) {}

    function rememberSeen(id){
      try {
        var arr = Object.keys(seen);
        // Keep it small so sessionStorage doesn't grow forever
        if(arr.length > 600){
          arr = arr.slice(arr.length - 600);
        }
        sessionStorage.setItem(seenKey, JSON.stringify(arr));
      } catch(e) {}
    }

    // Impressions: count a view when a game card is meaningfully visible.
    // This makes "Trending" update even when users browse without clicking.
    try {
      if('IntersectionObserver' in window){
        var io = new IntersectionObserver(function(entries){
          for(var i=0;i<entries.length;i++){
            var ent = entries[i];
            if(!ent.isIntersecting || ent.intersectionRatio < 0.6) continue;
            var card = ent.target;
            io.unobserve(card);
            var link = card.querySelector && card.querySelector('a.game-card__link');
            if(!link) continue;
            var id = (link.getAttribute('data-game-id') || '').trim();
            if(!id){
              var titleEl = link.querySelector('.game-card__title');
              if(titleEl) id = slugifyTitle(titleEl.textContent);
            }
            if(!id || seen[id]) continue;
            seen[id] = true;
            rememberSeen(id);
            var urlV = '/api/view?id=' + encodeURIComponent(id);
            try {
              if(navigator.sendBeacon){ navigator.sendBeacon(urlV); }
              else fetch(urlV, { method: 'GET', keepalive: true }).catch(function(){});
            } catch(e) {}
          }
        }, { threshold: [0.6] });

        // Only observe real game cards (not the home carousel cards)
        var cards = document.querySelectorAll('.game-card');
        for(var j=0;j<cards.length;j++) io.observe(cards[j]);
      }
    } catch(e) {}

    document.addEventListener('click', function(e){
      var a = e.target && e.target.closest ? e.target.closest('a.game-card__link') : null;
      if(!a) return;

      var id = (a.getAttribute('data-game-id') || '').trim();
      if(!id){
        // Fallback: derive from text if needed
        var titleEl = a.querySelector('.game-card__title');
        if(titleEl) id = slugifyTitle(titleEl.textContent);
      }
      if(!id) return;

      var now = Date.now();
      if(lastSent[id] && (now - lastSent[id]) < 3500) return; // simple spam guard
      lastSent[id] = now;

      var url = '/api/click?id=' + encodeURIComponent(id);
      try {
        if(navigator.sendBeacon){
          navigator.sendBeacon(url);
        } else {
          fetch(url, { method: 'GET', keepalive: true }).catch(function(){});
        }
      } catch(err) {
        // ignore
      }
    }, { passive: true });
  }

  function initMostPopularNav(){
    var btns = Array.prototype.slice.call(document.querySelectorAll('[data-popular-toggle]'));
    var closeBtn = document.getElementById('popularClose');
    var pop = document.getElementById('popularPopover');
    var list = document.getElementById('popularList');
    var msg  = document.getElementById('popularMsg');
    var updated = document.getElementById('popularUpdated');
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-popular-mode]'));
    if(!btns.length || !pop || !list) return;

    // Build id -> {title,url} lookup from the already-loaded search index.
    // We store two keys for each entry:
    //  - a slugified title (matches most Hugo urlize outputs)
    //  - a "loose" key with hyphens removed (handles rare normalization differences)
    var lookup = Object.create(null);
    var lookupLoose = Object.create(null);
    try {
      var idx = (window.__GAME_INDEX__ || []);
      for(var i=0;i<idx.length;i++){
        var t = idx[i] && idx[i].title;
        var u = idx[i] && idx[i].url;
        if(!t || !u) continue;
        var k = slugifyTitle(t);
        lookup[k] = { title: t, url: u };
        lookupLoose[k.replace(/-/g,'')] = { title: t, url: u };
      }
    } catch(e) {}

    function setMsg(text){
      if(msg) msg.textContent = text;
    }

    function humanizeSlug(slug){
      // Fallback so we never show raw "mario-kart-wii" style slugs.
      var parts = String(slug || '').split('-').filter(Boolean);
      return parts.map(function(w){
        if(w === 'x') return 'X';
        if(w === 'ps' || w === 'psx' || w === 'ps2' || w === 'ps3' || w === 'ps4' || w === 'ps5') return w.toUpperCase();
        if(w === 'wii') return 'Wii';
        if(w === 'gba') return 'GBA';
        if(w === 'gb') return 'GB';
        if(w === 'c64') return 'C64';
        if(w === 'n64') return 'N64';
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(' ');
    }

    function positionPopover(anchorEl){
      if(!anchorEl || !anchorEl.getBoundingClientRect) return;
      var r = anchorEl.getBoundingClientRect();
      // Default: align popover right edge to the button, just below it.
      var top = r.bottom + 10;
      var left = Math.max(10, (r.right - pop.offsetWidth));
      // Keep within viewport.
      var maxLeft = Math.max(10, window.innerWidth - pop.offsetWidth - 10);
      left = Math.min(left, maxLeft);
      pop.style.top = top + 'px';
      pop.style.left = left + 'px';
    }

    var mode = 'trending'; // default
    var lastUpdatedAt = 0;
    var updateTimer = null;

    function setUpdated(){
      if(!updated) return;
      if(!lastUpdatedAt){ updated.textContent = ''; return; }
      var s = Math.floor((Date.now() - lastUpdatedAt) / 1000);
      if(s < 10) updated.textContent = 'Updated just now';
      else if(s < 60) updated.textContent = 'Updated ' + s + 's ago';
      else {
        var m = Math.floor(s/60);
        updated.textContent = 'Updated ' + m + 'm ago';
      }
    }

    function setActiveTab(){
      for(var i=0;i<tabs.length;i++){
        var t = tabs[i];
        var is = (t.getAttribute('data-popular-mode') === mode);
        if(is) t.classList.add('is-active'); else t.classList.remove('is-active');
        t.setAttribute('aria-selected', is ? 'true' : 'false');
      }
    }

    function buildEndpoint(){
      // New Worker supports mode=trending|all. If not, the Worker can ignore it.
      var q = '/api/top?limit=25&mode=' + encodeURIComponent(mode);
      if(mode === 'trending') q += '&days=7';
      return q;
    }

    function load(){
      // Always refresh when opened so the list updates without a full reload.
      setMsg('Loading…');
      fetch(buildEndpoint(), { cache: 'no-store' })
        .then(function(r){ return r.json(); })
        .then(function(data){
          if(!data || !data.ok || !Array.isArray(data.top)) throw new Error('bad');

          list.innerHTML = '';
          if(data.top.length === 0){
            list.innerHTML = '<li class="popular__empty">No popular games yet — start clicking game cards and they will appear here.</li>';
            setMsg('');
            return;
          }

          var added = 0;
          for(var i=0;i<data.top.length;i++){
            var row = data.top[i] || {};
            var id = String(row.id || '').trim();
            if(!id) continue;

            // Hide any manual test entries (you can also delete them from D1).
            if(id === 'test-game' || id === 'test-live' || id.indexOf('test-') === 0) continue;

            var info = lookup[id] || lookupLoose[id.replace(/-/g,'')] || null;
            if(!info){
              info = { title: humanizeSlug(id), url: '/all/#' + encodeURIComponent(id) };
            }

            var li = document.createElement('li');
            li.className = 'popular__item';

            var r = document.createElement('span');
            r.className = 'popular__rank';
            r.textContent = String(added + 1);

            // Medal styling for All-time 1/2/3
            if(mode === 'all'){
              if(added === 0) r.classList.add('popular__rank--gold');
              else if(added === 1) r.classList.add('popular__rank--silver');
              else if(added === 2) r.classList.add('popular__rank--bronze');
            }

            var a = document.createElement('a');
            a.className = 'popular__link';
            // Add a fire marker to the top Trending entry
            if(mode === 'trending' && added === 0){
              a.textContent = '🔥 ' + info.title;
            } else {
              a.textContent = info.title;
            }
            a.href = info.url;
            if(info.url === '#'){
              a.addEventListener('click', function(e){ e.preventDefault(); });
              a.setAttribute('aria-disabled','true');
            }

            li.appendChild(r);
            li.appendChild(a);
            list.appendChild(li);
            added++;
            if(added >= 10) break;
          }

          if(added === 0){
            list.innerHTML = '<li class="popular__empty">No popular games yet — start clicking game cards and they will appear here.</li>';
          }

          setMsg('');
          loaded = true;
          lastUpdatedAt = Date.now();
          setUpdated();
        })
        .catch(function(){
          setMsg('Couldn\'t load popular games right now.');
        });
    }

    var currentAnchor = null;
    function open(anchor){
      currentAnchor = anchor || btns[0];
      pop.hidden = false;
      positionPopover(currentAnchor);
      setActiveTab();
      load();
      if(updateTimer) clearInterval(updateTimer);
      updateTimer = setInterval(setUpdated, 5000);
      btns.forEach(function(b){ b.setAttribute('aria-expanded','true'); });
    }
    function close(){
      pop.hidden = true;
      if(updateTimer){ clearInterval(updateTimer); updateTimer = null; }
      btns.forEach(function(b){ b.setAttribute('aria-expanded','false'); });
    }
    function toggle(anchor){
      if(pop.hidden) open(anchor); else close();
    }

    btns.forEach(function(b){
      b.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        toggle(b);
      });
    });

    // Tabs inside the popover
    tabs.forEach(function(t){
      t.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        mode = t.getAttribute('data-popular-mode') || 'trending';
        setActiveTab();
        load();
      });
    });

    if(closeBtn){
      closeBtn.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation(); close();
      });
    }

    window.addEventListener('resize', function(){
      if(pop.hidden) return;
      positionPopover(currentAnchor || btns[0]);
    });

    document.addEventListener('click', function(e){
      if(pop.hidden) return;
      var t = e.target;
      if(!t) return;
      if(t.closest && (t.closest('#popularPopover') || t.closest('[data-popular-toggle]'))) return;
      close();
    });

    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && !pop.hidden) close();
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    initCarousel();
    initGameGrids();
    initSeriesGrids();
    initGenreGrids();
    initPopularityTracking();
    initMostPopularNav();
  });
})();