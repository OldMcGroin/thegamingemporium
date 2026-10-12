(function(){
  function init(){
    const grid = document.getElementById('search-results-grid');
    if(!grid) return;
    const query = (new URLSearchParams(location.search).get('q') || '').trim();
    const title = document.getElementById('search-results-title');
    const count = document.getElementById('search-result-count');
    const category = document.getElementById('search-category-filter');
    const sort = document.getElementById('search-sort');
    const empty = document.getElementById('search-no-results');
    const searchInput = document.getElementById('siteSearchInput');
    if(searchInput) searchInput.value = query;
    title.textContent = query ? 'Search Results: "' + query + '"' : 'Search Results';
    function norm(s){ return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '); }
    const tokens = norm(query).split(' ').filter(Boolean);
    const cards = Array.from(grid.querySelectorAll('.game-card'));
    const categories = new Map();
    cards.forEach(card => {
      const key = card.dataset.category || '';
      if(key && !categories.has(key)) categories.set(key,card.dataset.categoryDisplay || key);
    });
    Array.from(categories).sort((a,b)=>a[1].localeCompare(b[1])).forEach(([key,label])=>{
      const option=document.createElement('option'); option.value=key; option.textContent=label; category.appendChild(option);
    });
    cards.sort((a,b)=>(a.dataset.title || '').localeCompare(b.dataset.title || ''));
    function update(){
      const reversed = sort.value === 'za';
      const ordered = reversed ? cards.slice().reverse() : cards;
      const fragment = document.createDocumentFragment();
      let matches=0;
      ordered.forEach(card=>{
        const t=norm(card.dataset.title);
        const show=tokens.length>0 && tokens.every(token=>t.includes(token)) && (!category.value || card.dataset.category===category.value);
        card.hidden=!show;
        card.style.display=show ? '' : 'none';
        if(show) matches++;
        fragment.appendChild(card);
      });
      grid.appendChild(fragment);
      count.textContent=query ? matches + (matches===1 ? ' matching project' : ' matching projects') : 'Enter a search term above to find projects.';
      empty.hidden=matches!==0 || !query;
    }
    category.addEventListener('change',update);
    sort.addEventListener('change',update);
    update();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
