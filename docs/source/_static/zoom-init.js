// Enable click-to-zoom (lightbox) on documentation screenshots (medium-zoom).
(function () {
  "use strict";
  var SELECTOR = ".md-content img.align-center";
  var zoom = null;

  function attach() {
    if (typeof mediumZoom === "undefined") return;
    if (!zoom) {
      zoom = mediumZoom(SELECTOR, { background: "rgba(0,0,0,0.9)", margin: 24 });
    } else {
      zoom.detach();          // drop nodes from the previous page
      zoom.attach(SELECTOR);  // bind the current page's screenshots
    }
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    attach();
    // Re-attach after navigation.instant swaps the page content.
    // Observe the persistent container (medium-zoom appends its overlay to
    // <body>, so observing .md-container avoids self-triggered loops).
    var container = document.querySelector(".md-container") || document.body;
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(attach, 100);
    }).observe(container, { childList: true, subtree: true });
  });
})();
