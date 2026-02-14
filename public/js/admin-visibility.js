(function () {
  function qsAll(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function setBadge(card, hidden) {
    if (!card) return;
    const existing = card.querySelector('.game-card__hiddenBadge');
    if (hidden) {
      if (existing) return;
      const body = card.querySelector('.game-card__body');
      if (!body) return;
      const badge = document.createElement('div');
      badge.className = 'game-card__hiddenBadge';
      badge.textContent = 'Hidden (Live)';
      // Insert right after the title, matching template placement
      const title = body.querySelector('.game-card__title');
      if (title && title.parentNode) {
        title.parentNode.insertBefore(badge, title.nextSibling);
      } else {
        body.insertBefore(badge, body.firstChild);
      }
    } else {
      if (existing) existing.remove();
    }
  }

  const buttons = qsAll(".admin-visibility-toggle");
  if (!buttons.length) return;

  // Hint to the user if the helper isn't running
  async function pingHelper() {
    try {
      const r = await fetch("http://127.0.0.1:7331/ping", { method: "GET" });
      return r.ok;
    } catch (_) {
      return false;
    }
  }

  function setBtn(btn, hidden) {
    btn.dataset.hidden = hidden ? "true" : "false";
    btn.textContent = hidden ? "Hidden" : "Visible";
    btn.classList.toggle("is-hidden", !!hidden);
  }

  function setAllOnPage(gameId, hidden) {
    qsAll('.admin-visibility-toggle[data-game-id="' + String(gameId) + '"]').forEach((b) => {
      setBtn(b, hidden);
      const card = b.closest('.game-card');
      setBadge(card, hidden);
    });
  }

  buttons.forEach((btn) => {
    // Initialize visual state
    setBtn(btn, btn.dataset.hidden === "true");

    btn.addEventListener("click", async () => {
      const idRaw = btn.getAttribute("data-game-id");
      const id = Number(idRaw);
      if (!Number.isFinite(id)) {
        alert("Missing/invalid game id on this card.");
        return;
      }

      const currentlyHidden = btn.dataset.hidden === "true";
      const newHidden = !currentlyHidden;

      if (btn.disabled) return;
      btn.disabled = true;

      // Fast fail message if helper isn't running
      const helperOk = await pingHelper();
      if (!helperOk) {
        btn.disabled = false;
        alert("Preview visibility helper isn't running.\n\nUse ./tools/preview.sh (recommended),\nor run: python3 tools/visibility_server.py\n\nThen refresh this page.");
        return;
      }

      try {
        const res = await fetch("http://127.0.0.1:7331/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: id, hidden: newHidden })
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || ("HTTP " + res.status));
        }

        // Update all occurrences on this page immediately.
        setAllOnPage(id, newHidden);
      } catch (e) {
        alert("Could not toggle visibility.\n\n" + (e && e.message ? e.message : String(e)));
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
