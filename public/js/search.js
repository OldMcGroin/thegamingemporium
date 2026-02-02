(function(){
  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function(){
    const input = document.getElementById('siteSearchInput');
    const dropdown = document.getElementById('siteSearchDropdown');
    if(!input || !dropdown) return;

    let index = (window.__GAME_INDEX__ || []);
    if(!Array.isArray(index)) index = [];

    function clear(){
      dropdown.innerHTML = '';
      dropdown.style.display = 'none';
    }

    function render(results){
      dropdown.innerHTML = '';
      if(!results.length){
        const div = document.createElement('div');
        div.className = 'search-empty';
        div.textContent = 'No matches';
        dropdown.appendChild(div);
        dropdown.style.display = 'block';
        return;
      }
      for(const r of results){
        const a = document.createElement('a');
        a.className = 'search-item';
        a.href = r.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.setAttribute('role', 'option');
        a.textContent = r.title;
        dropdown.appendChild(a);
      }
      dropdown.style.display = 'block';
    }

    // Normalize for friendlier matching:
    // - lowercase
    // - strip accents
    // - turn punctuation into spaces
    // - collapse whitespace
    function normalize(str){
      return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
    }

    function scoreMatch(title, query){
      const t = normalize(title);
      const q = normalize(query);
      if(!t || !q) return 0;

      const words = t.split(' ');
      const tokens = q.split(' ');

      // Multi-token queries behave like an AND search:
      // every token must match somewhere in the title.
      let score = 0;
      for(const tok of tokens){
        if(!tok) continue;
        if(t === tok){ score += 50; continue; }
        if(t.startsWith(tok)) { score += 30; continue; }
        if(words.some(w => w.startsWith(tok))) { score += 24; continue; }
        if(t.includes(tok)) { score += 18; continue; }
        return 0; // token not found anywhere
      }

      // Extra boost for the full query behaving nicely
      if(t === q) score += 60;
      else if(t.startsWith(q)) score += 40;
      else if(words.some(w => w.startsWith(q))) score += 32;
      else if(t.includes(q)) score += 24;

      return score;
    }

    function search(q){
      q = (q || '').trim();
      if(!q){ clear(); return; }

      const results = [];
      for(const item of index){
        const title = (item.title || '').trim();
        if(!title) continue;
        const s = scoreMatch(title, q);
        if(s > 0) results.push({ ...item, __score: s });
      }

      results.sort((a,b) => {
        const ds = (b.__score || 0) - (a.__score || 0);
        if(ds !== 0) return ds;
        return (a.title || '').localeCompare((b.title || ''));
      });

      // Strip internal score before rendering
      render(results.slice(0, 10).map(r => ({ title: r.title, url: r.url })));
    }

    input.addEventListener('input', function(e){
      search(e.target.value);
    });

    document.addEventListener('click', function(e){
      if(!e.target.closest('.topbar__search')) clear();
    });

    input.addEventListener('keydown', function(e){
      if(e.key === 'Escape') clear();
    });
  });
})();