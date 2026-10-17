(function () {
  "use strict";

  var STORAGE_KEY = "tge_favourites_v1";
  var modal = document.querySelector("[data-favourites-modal]");
  var openBtn = document.querySelector("[data-favourites-open]");
  var listEl = modal ? modal.querySelector("[data-favourites-list]") : null;
  var emptyEl = modal ? modal.querySelector("[data-favourites-empty]") : null;
  var clearBtn = modal ? modal.querySelector("[data-favourites-clear]") : null;
  var countEls = document.querySelectorAll("[data-favourites-count]");
  var games = (window.TGE_FEATURE_DATA && Array.isArray(window.TGE_FEATURE_DATA.favourites)) ? window.TGE_FEATURE_DATA.favourites : [];
  var gameMap = {};

  games.forEach(function (g) {
    g.id = String(g.id || "");
    g.title = String(g.title || "");
    g.url = String(g.url || "");
    g.categoryLabel = String(g.categoryLabel || "").replace(/&amp;/gi, "&");
    if (g.id) gameMap[g.id] = g;
  });

  function load() {
    try {
      var value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
    } catch (e) { return []; }
  }

  function save(ids) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch (e) {}
  }

  function uniqueValid(ids) {
    var seen = {};
    return ids.filter(function (id) {
      if (seen[id] || !gameMap[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  var favourites = uniqueValid(load());
  if (favourites.length !== load().length) save(favourites);

  function isFavourite(id) { return favourites.indexOf(id) !== -1; }

  function syncCardButtons() {
    document.querySelectorAll("[data-favourite-toggle]").forEach(function (button) {
      var id = String(button.getAttribute("data-favourite-id") || "");
      var active = isFavourite(id);
      var game = gameMap[id];
      button.classList.toggle("is-favourite", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.setAttribute("title", active ? "Remove from favourites" : "Add to favourites");
      button.setAttribute("aria-label", (active ? "Remove " : "Add ") + (game ? game.title : "this game") + (active ? " from favourites" : " to favourites"));
      var icon = button.querySelector("span");
      if (icon) icon.textContent = active ? "♥" : "♡";
    });
    countEls.forEach(function (el) { el.textContent = String(favourites.length); });
  }

  function removeFavourite(id) {
    favourites = favourites.filter(function (x) { return x !== id; });
    save(favourites);
    syncCardButtons();
    renderList();
  }

  function toggleFavourite(id) {
    if (!gameMap[id]) return;
    if (isFavourite(id)) removeFavourite(id);
    else {
      favourites.unshift(id);
      favourites = uniqueValid(favourites);
      save(favourites);
      syncCardButtons();
      renderList();
    }
  }

  function renderList() {
    if (!listEl || !emptyEl || !clearBtn) return;
    listEl.innerHTML = "";
    var savedGames = favourites.map(function (id) { return gameMap[id]; }).filter(Boolean);
    emptyEl.hidden = savedGames.length > 0;
    clearBtn.hidden = savedGames.length === 0;

    savedGames.forEach(function (game) {
      var row = document.createElement("div");
      row.className = "favourites-item";

      var info = document.createElement("a");
      info.className = "favourites-item__info";
      info.href = game.url;
      info.target = "_blank";
      info.rel = "noopener noreferrer";

      var title = document.createElement("strong");
      title.className = "favourites-item__title";
      title.textContent = game.title;
      var category = document.createElement("span");
      category.className = "favourites-item__category";
      category.textContent = game.categoryLabel || "Game";
      info.appendChild(title);
      info.appendChild(category);

      var actions = document.createElement("div");
      actions.className = "favourites-item__actions";
      var open = document.createElement("a");
      open.className = "favourites-item__open";
      open.href = game.url;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "Open ↗";
      open.setAttribute("aria-label", "Open " + game.title);

      var remove = document.createElement("button");
      remove.className = "favourites-item__remove";
      remove.type = "button";
      remove.textContent = "♥";
      remove.title = "Remove from favourites";
      remove.setAttribute("aria-label", "Remove " + game.title + " from favourites");
      remove.addEventListener("click", function () { removeFavourite(game.id); });

      actions.appendChild(open);
      actions.appendChild(remove);
      row.appendChild(info);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  function openModal() {
    if (!modal || !openBtn) return;
    renderList();
    modal.hidden = false;
    document.body.classList.add("has-favourites-modal");
    openBtn.setAttribute("aria-expanded", "true");
    setTimeout(function () {
      var focusTarget = modal.querySelector(".favourites-item__info, [data-favourites-close]");
      if (focusTarget) focusTarget.focus();
    }, 0);
  }

  function closeModal() {
    if (!modal || !openBtn) return;
    modal.hidden = true;
    document.body.classList.remove("has-favourites-modal");
    openBtn.setAttribute("aria-expanded", "false");
    openBtn.focus();
  }

  document.addEventListener("click", function (e) {
    var button = e.target && e.target.closest ? e.target.closest("[data-favourite-toggle]") : null;
    if (!button) return;
    e.preventDefault();
    e.stopPropagation();
    toggleFavourite(String(button.getAttribute("data-favourite-id") || ""));
  });

  if (openBtn && modal) {
    openBtn.addEventListener("click", openModal);
    modal.querySelectorAll("[data-favourites-close]").forEach(function (el) { el.addEventListener("click", closeModal); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!favourites.length) return;
      favourites = [];
      save(favourites);
      syncCardButtons();
      renderList();
    });
  }

  // Portable format: TGEF1. + URL-safe base64 of UTF-8 JSON.
  // No account, server, or personal information is required.
  var transfer = modal ? modal.querySelector(".favourites-transfer") : null;
  if (transfer) {
    var codeBox = transfer.querySelector("[data-favourites-code]");
    var status = transfer.querySelector("[data-favourites-status]");
    var fileInput = transfer.querySelector("[data-favourites-file]");
    function message(value) { status.textContent = value; }
    function payload() { return { format: "tge-favourites", version: 1, ids: favourites.slice() }; }
    function toCode(data) {
      var bytes = new TextEncoder().encode(JSON.stringify(data));
      var binary = "";
      bytes.forEach(function (b) { binary += String.fromCharCode(b); });
      return "TGEF1." + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    function parsePayload(data) {
      if (!data || data.format !== "tge-favourites" || data.version !== 1 || !Array.isArray(data.ids) || data.ids.length > 20000) throw new Error("Invalid or unsupported favourites backup.");
      if (!data.ids.every(function (id) { return typeof id === "string" && id.length <= 300; })) throw new Error("Invalid favourites list.");
      return data.ids;
    }
    function merge(data) {
      var ids = parsePayload(data);
      var merged = uniqueValid(favourites.concat(ids));
      var added = merged.length - favourites.length;
      var unavailable = ids.filter(function (id) { return !gameMap[id]; }).length;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); }
      catch (e) { throw new Error("Unable to save favourites on this device."); }
      favourites = merged;
      syncCardButtons(); renderList();
      message("Imported " + added + " new favourite(s)." + (unavailable ? " " + unavailable + " unavailable project(s) skipped." : "") + " Existing favourites kept.");
    }
    transfer.querySelector("[data-favourites-export]").addEventListener("click", function () {
      if (!favourites.length) { message("You have no favourites to export yet."); return; }
      var blob = new Blob([JSON.stringify(payload(), null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a"); link.href = url; link.download = "thegamingemporium-favourites.json";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      message("Backup file created. Keep it somewhere safe.");
    });
    transfer.querySelector("[data-favourites-copy]").addEventListener("click", function () {
      if (!favourites.length) { message("You have no favourites to copy yet."); return; }
      var code = toCode(payload()); codeBox.value = code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { message("Transfer code copied. Paste it on your other device."); }, function () { message("Copy the code from the text box to transfer it."); });
      } else { codeBox.focus(); codeBox.select(); message("Copy the selected code to transfer it."); }
    });
    transfer.querySelector("[data-favourites-import-code]").addEventListener("click", function () {
      try {
        var code = codeBox.value.trim();
        if (!/^TGEF1\.[A-Za-z0-9_-]+$/.test(code) || code.length > 150000) throw new Error("Invalid transfer code.");
        var encoded = code.slice(6).replace(/-/g, "+").replace(/_/g, "/");
        var binary = atob(encoded); var bytes = Uint8Array.from(binary, function (c) { return c.charCodeAt(0); });
        merge(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
      } catch (e) { message("Import failed: " + (e.message || "Invalid code.")); }
    });
    transfer.querySelector("[data-favourites-import-file]").addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 1000000) { message("Backup file is too large."); fileInput.value = ""; return; }
      file.text().then(function (content) { merge(JSON.parse(content)); }).catch(function (e) { message("Import failed: " + (e.message || "Invalid file.")); });
      fileInput.value = "";
    });
  }

  syncCardButtons();
  renderList();
})();
