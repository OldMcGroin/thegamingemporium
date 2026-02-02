(function(){
  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function showToast(msg){
    var el = document.getElementById('copyFilenameToast');
    if(!el){
      el = document.createElement('div');
      el.id = 'copyFilenameToast';
      el.className = 'copy-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-showing');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function(){
      el.classList.remove('is-showing');
    }, 1400);
  }

  async function copyText(text){
    if(!text) return false;
    try {
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch(e){
      // fall through
    }

    // Fallback
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch(e){
      return false;
    }
  }

  ready(function(){
    document.addEventListener('click', async function(e){
      var btn = e.target && e.target.closest ? e.target.closest('.copy-filename-btn') : null;
      if(!btn) return;
      e.preventDefault();
      e.stopPropagation();

      var slug = btn.getAttribute('data-slug') || '';
      var ok = await copyText(slug);
      if(ok) showToast('Copied: ' + slug);
      else {
        // last resort: prompt so you can copy manually
        window.prompt('Copy image slug:', slug);
      }
    }, true);
  });
})();
