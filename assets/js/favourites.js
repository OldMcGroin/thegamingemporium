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

  syncCardButtons();
  renderList();
})();
