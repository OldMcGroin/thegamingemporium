(function() {
  // v5: Dark is the default on first visit.
  // We intentionally ignore legacy keys so older "light" values can't force Day mode.
  var key = "tge_theme_v5";

  function safeGet(k) { try { return localStorage.getItem(k); } catch(e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch(e) {} }
  function safeRemove(k) { try { localStorage.removeItem(k); } catch(e) {} }

  var stored = safeGet(key);
  if (!stored) {
    ["tge_theme_v2","tge_theme_v3","tge_theme_v4","theme","site-theme"].forEach(safeRemove);
  }

  var theme = stored || "dark";
  document.documentElement.setAttribute("data-theme", theme);

  function setIcons(t) {
    var icons = document.querySelectorAll("[data-theme-icon]");
    icons.forEach(function(el){ el.textContent = (t === "dark" ? "🌙" : "☀️"); });
  }

  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    safeSet(key, t);
    setIcons(t);
  }

  // Enable transitions only after initial theme is applied (prevents fade-on-load)
  requestAnimationFrame(function(){
    document.documentElement.classList.add("theme-transitions");
  });

  setIcons(theme);

  var toggles = document.querySelectorAll("[data-theme-toggle]");
  toggles.forEach(function(btn){
    btn.addEventListener("click", function() {
      var current = document.documentElement.getAttribute("data-theme") || "dark";
      var next = current === "dark" ? "light" : "dark";
      setTheme(next);
    });
  });
})();
