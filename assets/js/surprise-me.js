(function () {
  "use strict";
  var modal = document.querySelector("[data-surprise-modal]");
  var openBtn = document.querySelector("[data-surprise-open]");
  if (!modal || !openBtn) return;

  var select = modal.querySelector("[data-surprise-category]");
  var go = modal.querySelector("[data-surprise-go]");
  var msg = modal.querySelector("[data-surprise-message]");
  var dataNode = document.getElementById("surpriseGamesData");
  var games = [];
  try { games = JSON.parse(dataNode ? dataNode.textContent : "[]"); } catch (e) {}

  // Hugo now emits proper JSON strings directly. Do not URL-encode display text:
  // URL encoding is what caused spaces to appear as + and ampersands as &amp;.
  games = games.map(function (g) {
    return {
      title: String(g.title || ""),
      url: String(g.url || ""),
      category: String(g.category || ""),
      categoryLabel: String(g.categoryLabel || "").replace(/&amp;/gi, "&")
    };
  });

  var cats = {};
  games.forEach(function (g) {
    if (g.category && g.categoryLabel) cats[g.category] = g.categoryLabel;
  });
  Object.keys(cats).sort(function (a,b) { return cats[a].localeCompare(cats[b]); }).forEach(function (key) {
    var opt = document.createElement("option");
    opt.value = key;
    opt.textContent = cats[key];
    select.appendChild(opt);
  });

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("has-surprise-modal");
    openBtn.setAttribute("aria-expanded", "true");
    msg.textContent = "";
    setTimeout(function () { select.focus(); }, 0);
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("has-surprise-modal");
    openBtn.setAttribute("aria-expanded", "false");
    openBtn.focus();
  }
  function surprise(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    // Guard against the handler firing twice (for example after a hot-reload or
    // duplicate listener). One physical click must open one destination tab only.
    if (go.dataset.surpriseOpening === "1") return;
    go.dataset.surpriseOpening = "1";
    window.setTimeout(function () { delete go.dataset.surpriseOpening; }, 1000);

    var cat = select.value;
    var pool = cat ? games.filter(function (g) { return g.category === cat; }) : games;
    if (!pool.length) { msg.textContent = "No entries found in that category."; return; }
    var pick = pool[Math.floor(Math.random() * pool.length)];
    msg.textContent = "Opening “" + pick.title + "”…";
    // Only allow normal web links. Using location assignment on a malformed URL
    // can otherwise make the browser treat it as a path on localhost/the site.
    if (!/^https?:\/\//i.test(pick.url)) {
      msg.textContent = "That entry does not have a valid web link.";
      return;
    }
    // Open exactly one destination tab and leave The Gaming Emporium where it is.
    var link = document.createElement("a");
    link.href = pick.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  openBtn.addEventListener("click", openModal);
  modal.querySelectorAll("[data-surprise-close]").forEach(function (el) { el.addEventListener("click", closeModal); });
  go.addEventListener("click", surprise);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
})();
