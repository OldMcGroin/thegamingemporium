(function () {
  "use strict";

  var modal = document.querySelector("[data-stats-modal]");
  if (!modal) return;

  var openers = document.querySelectorAll("[data-stats-open]");
  var closers = modal.querySelectorAll("[data-stats-close]");
  var panel = modal.querySelector(".site-stats-modal__panel");
  var lastFocus = null;
  var stats = (window.TGE_FEATURE_DATA && window.TGE_FEATURE_DATA.stats) ? window.TGE_FEATURE_DATA.stats : {};

  modal.querySelectorAll("[data-stat-key]").forEach(function (el) {
    var key = el.getAttribute("data-stat-key");
    if (Object.prototype.hasOwnProperty.call(stats, key)) el.textContent = String(stats[key]);
  });

  var categoryStats = modal.querySelector("[data-category-stats]");
  if (categoryStats && Array.isArray(stats.categoryCounts)) {
    categoryStats.textContent = "";
    stats.categoryCounts.forEach(function (item) {
      var card = document.createElement("div");
      card.className = "site-stat site-stat--category";

      var count = document.createElement("strong");
      count.textContent = String(item.count);

      var label = document.createElement("span");
      label.textContent = String(item.label || item.slug || "");

      card.appendChild(count);
      card.appendChild(label);
      categoryStats.appendChild(card);
    });
  }

  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("has-site-stats-modal");
    var close = modal.querySelector(".site-stats-modal__close");
    if (close) close.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("has-site-stats-modal");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  openers.forEach(function (button) {
    button.addEventListener("click", openModal);
  });

  closers.forEach(function (button) {
    button.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", function (event) {
    if (modal.hidden) return;
    if (event.key === "Escape") closeModal();
  });

  if (panel) {
    panel.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  }
})();
