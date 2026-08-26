(function () {
  'use strict';
  var installPrompt = null;
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-install-app]'));
  var modal = document.querySelector('[data-install-help-modal]');
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function showButtons() { buttons.forEach(function (b) { b.hidden = false; }); }
  function hideButtons() { buttons.forEach(function (b) { b.hidden = true; }); }
  function openHelp() { if (modal) { modal.hidden = false; document.body.classList.add('modal-open'); } }
  function closeHelp() { if (modal) { modal.hidden = true; document.body.classList.remove('modal-open'); } }

  if (isStandalone) { hideButtons(); return; }
  if (isIOS) { showButtons(); }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPrompt = event;
    showButtons();
  });

  buttons.forEach(function (button) {
    button.addEventListener('click', async function () {
      if (installPrompt) {
        installPrompt.prompt();
        try { await installPrompt.userChoice; } catch (e) {}
        installPrompt = null;
        hideButtons();
      } else if (isIOS) {
        openHelp();
      }
    });
  });

  document.querySelectorAll('[data-install-help-close]').forEach(function (el) {
    el.addEventListener('click', closeHelp);
  });
  window.addEventListener('appinstalled', function () { installPrompt = null; hideButtons(); closeHelp(); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
