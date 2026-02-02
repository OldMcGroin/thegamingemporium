(function(){
  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(function(){
    document.addEventListener('click', function(e){
      const pill = e.target.closest('.pill--video');
      if(!pill) return;
      const url = pill.getAttribute('data-video');
      if(!url) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(url, '_blank', 'noopener');
    }, true);

    document.addEventListener('keydown', function(e){
      const pill = e.target && e.target.classList && e.target.classList.contains('pill--video') ? e.target : null;
      if(!pill) return;
      if(e.key !== 'Enter' && e.key !== ' ') return;
      const url = pill.getAttribute('data-video');
      if(!url) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(url, '_blank', 'noopener');
    }, true);
  });
})();