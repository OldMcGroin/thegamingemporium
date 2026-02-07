(function() {
  // Default to dark unless a preference has been explicitly saved.
  // (Intentionally does NOT follow system preference.)
  var stored = localStorage.getItem("tge_theme_v2");
  var theme = stored || "dark";

  document.documentElement.setAttribute("data-theme", theme);

  function setIcons(t) {
    var icons = document.querySelectorAll("[data-theme-icon]");
    icons.forEach(function(el){ el.textContent = (t === "dark" ? "🌙" : "☀️"); });
  }

  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("tge_theme_v2", t);
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