(function () {
  'use strict';
  var modal = document.querySelector('[data-suggestion-modal]');
  var form = document.querySelector('[data-suggestion-form]');
  if (!modal || !form) return;
  var titleInput = form.querySelector('[name="game_title"]');
  var message = form.querySelector('[data-suggestion-message]');
  var submit = form.querySelector('button[type="submit"]');
  var previousFocus = null;

  function openModal() {
    previousFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('has-suggestion-modal');
    setTimeout(function () { titleInput.focus(); }, 0);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('has-suggestion-modal');
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }
  document.querySelectorAll('[data-suggestion-open]').forEach(function (b) { b.addEventListener('click', openModal); });
  modal.querySelectorAll('[data-suggestion-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    message.textContent = '';
    message.className = 'suggestion-form__message';
    submit.disabled = true;
    submit.textContent = 'Submitting…';
    try {
      var payload = Object.fromEntries(new FormData(form).entries());
      var res = await fetch('/submit-suggestion', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.message || 'Could not submit your suggestion.');
      form.reset();
      message.innerHTML = '<strong>✔ Thanks!</strong><span>Your suggestion has been sent.</span>';
      message.classList.add('is-success');
      setTimeout(function () {
        closeModal();
        message.textContent = '';
        message.className = 'suggestion-form__message';
      }, 2000);
    } catch (err) {
      message.textContent = err.message || 'Could not submit your suggestion.';
      message.classList.add('is-error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Submit Suggestion';
    }
  });
})();
