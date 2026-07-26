(function(){
  const btn = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if(!btn || !nav) return;

  function close(){
    nav.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function(){
    const open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // close when clicking a link (mobile)
  nav.addEventListener('click', function(e){
    const a = e.target.closest('a');
    if(a) close();
  });

  // close on resize to desktop
  window.addEventListener('resize', function(){
    if(window.innerWidth > 860) close();
  });
})();