(function () {
  var selects = Array.prototype.slice.call(document.querySelectorAll('select[data-platform-editor]'));
  if (!selects.length) return;

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  }

  var platforms = uniqueSorted(
    Array.prototype.slice.call(document.querySelectorAll('.game-card[data-category="decompilations-recompilations"]'))
      .map(function (card) { return (card.getAttribute('data-platform') || '').trim(); })
  );

  function fillSelect(sel) {
    var current = (sel.getAttribute('data-current-platform') || '').trim();
    if (current && platforms.indexOf(current) === -1) platforms.push(current);
    platforms = uniqueSorted(platforms);
    sel.innerHTML = '';
    platforms.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === current) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function setStatus(sel, text, ok) {
    var wrap = sel.closest('[data-platform-editor-wrap]');
    var status = wrap && wrap.querySelector('[data-platform-editor-status]');
    if (!status) return;
    status.textContent = text || '';
    status.classList.toggle('is-error', ok === false);
    if (text && ok !== false) {
      window.setTimeout(function () { if (status.textContent === text) status.textContent = ''; }, 1800);
    }
  }

  selects.forEach(function (sel) {
    fillSelect(sel);
    sel.addEventListener('click', function (e) { e.stopPropagation(); });
    sel.addEventListener('change', async function () {
      var id = Number(sel.getAttribute('data-game-id'));
      var platform = sel.value;
      var oldValue = sel.getAttribute('data-current-platform') || '';
      if (!Number.isFinite(id) || !platform) return;

      sel.disabled = true;
      setStatus(sel, 'Saving…');
      try {
        var res = await fetch('http://127.0.0.1:7331/platform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id, platform: platform })
        });
        if (!res.ok) throw new Error(await res.text() || ('HTTP ' + res.status));

        sel.setAttribute('data-current-platform', platform);
        var card = sel.closest('.game-card');
        if (card) card.setAttribute('data-platform', platform);
        setStatus(sel, 'Saved ✓', true);
      } catch (err) {
        sel.value = oldValue;
        setStatus(sel, 'Save failed', false);
        alert('Could not save platform.\n\n' + (err && err.message ? err.message : String(err)));
      } finally {
        sel.disabled = false;
      }
    });
  });
})();
