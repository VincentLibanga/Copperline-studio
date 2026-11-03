/* Copperline Studio — site engine.
   Every word and image comes from window.SITE_CONTENT (content/content.js).
   The admin panel (#admin) calls Site.render(newContent) to preview edits live. */
(function () {
  "use strict";

  var C = window.SITE_CONTENT;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  function pad(n) { return String(n).padStart(2, "0"); }
  function get(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else n.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : ""; }
  function kind(p) { return p.type === "film" ? "Film" + (p.duration ? " · " + p.duration : "") : "Photography"; }
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  /* Image aspect ratios, learned as images load, so layouts adapt to uploads. */
  var aspects = {};
  function aspectOf(src) { return aspects[src] || 1.5; }
  function learn(img, src, cb) {
    function done() { if (img.naturalWidth) { var a = img.naturalWidth / img.naturalHeight; if (aspects[src] !== a) { aspects[src] = a; cb && cb(a); } } }
    if (img.complete) done(); else img.addEventListener("load", done, { once: true });
  }
  var relayoutTimer = null;
  function relayoutSoon() { clearTimeout(relayoutTimer); relayoutTimer = setTimeout(function () { layout(); hsSetup(); }, 60); }

  /* ------------------------------------------------------------ Header */
  var header = $("#site-header"), menuBtn = $("#menu-btn"), nav = $("#nav"), hero = $(".hero");
  function onScroll() { header.classList.toggle("is-solid", window.scrollY > hero.offsetHeight - header.offsetHeight); }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  function setMenu(open) {
    header.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.textContent = open ? "Close" : "Menu";
    document.documentElement.style.overflow = open ? "hidden" : "";
  }
  menuBtn.addEventListener("click", function () { setMenu(!header.classList.contains("menu-open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a") && header.classList.contains("menu-open")) setMenu(false); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) $$("a", nav).forEach(function (a) { a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + en.target.id)); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["services", "work", "design", "digital", "process", "contact"].forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ------------------------------------------------------------ Hero */
  var media = $("#hero-media"), pager = $("#hero-pager"), caption = $("#hero-caption"), word = $("#hero-word");
  var slides = [], heroImgs = [], bars = [], heroI = -1, elapsed = 0, last = 0, DUR = 6000, heroHover = false, heroKey = "";
  function renderHero() {
    var s = arr(C.hero.slides).filter(function (x) { return x.image; });
    var key = JSON.stringify(s);
    var words = s.map(function (x) { return x.word; }).filter(Boolean);
    $("#hero-title-text").textContent = [C.hero.line1, C.hero.line2, words.join(", ")].join(" ").trim() + ".";
    if (key === heroKey) { if (heroI >= 0) showHero(heroI, true); return; }
    heroKey = key; slides = s; media.textContent = ""; pager.textContent = ""; heroImgs = []; bars = [];
    slides.forEach(function (f, i) {
      var img = h("img", { src: f.image, alt: "", decoding: "async" });
      img.style.setProperty("--at", (f.focusX == null ? 50 : f.focusX) + "% " + (f.focusY == null ? 50 : f.focusY) + "%");
      media.appendChild(img); heroImgs.push(img);
      var bar = h("i");
      var b = h("button", { type: "button", "aria-label": "Slide " + (i + 1) + ": " + (f.word || "") }, [h("span", { text: pad(i + 1) }), bar]);
      b.addEventListener("click", function () { if (i !== heroI) showHero(i); });
      pager.appendChild(b); bars.push(bar);
    });
    heroI = -1;
    if (slides.length) showHero(0); else { word.textContent = ""; caption.textContent = ""; }
  }
  function showHero(i, textOnly) {
    if (!slides.length) return;
    var prev = heroI;
    heroI = (i + slides.length) % slides.length;
    var f = slides[heroI];
    if (!textOnly) {
      heroImgs.forEach(function (img, k) {
        if (k === heroI) { img.style.zIndex = 3; img.classList.add("on"); img.alt = f.caption || f.word || ""; }
        else if (k === prev) { img.style.zIndex = 2; img.alt = ""; }
        else { img.style.zIndex = 1; img.classList.remove("on"); img.alt = ""; }
      });
      word.classList.remove("in"); void word.offsetWidth; word.classList.add("in");
      bars.forEach(function (b) { b.style.width = "0"; });
      elapsed = 0;
    }
    word.textContent = (f.word || "") + (f.word ? "." : "");
    $$("button", pager).forEach(function (b, k) { b.setAttribute("aria-current", String(k === heroI)); });
    caption.textContent = f.caption || "";
    caption.hidden = !f.caption;
  }
  hero.addEventListener("mouseenter", function () { heroHover = true; });
  hero.addEventListener("mouseleave", function () { heroHover = false; });
  function heroTick(t) {
    var dt = last ? Math.min(t - last, 100) : 0; last = t;
    if (!reduce && slides.length > 1 && viewer.hidden && !heroHover && document.visibilityState === "visible" && !document.documentElement.classList.contains("cms-open")) {
      elapsed += dt;
      if (elapsed >= DUR) showHero(heroI + 1);
      if (bars[heroI]) bars[heroI].style.width = Math.min(100, elapsed / DUR * 100) + "%";
    }
    requestAnimationFrame(heroTick);
  }

  /* ------------------------------------------------------------ Band + statement */
  function renderBand() {
    var t = $("#band-track"); t.textContent = "";
    arr(C.services.items).map(function (s) { return s.title; }).filter(Boolean).forEach(function (n) { t.appendChild(h("span", { class: "band-item" }, [n])); });
  }
  function highlight(el, text, phrases) {
    el.textContent = "";
    var marks = String(phrases || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var rest = text || "";
    while (rest) {
      var best = -1, hit = "";
      marks.forEach(function (m) { var i = rest.indexOf(m); if (i >= 0 && (best < 0 || i < best)) { best = i; hit = m; } });
      if (best < 0) { el.appendChild(document.createTextNode(rest)); break; }
      if (best) el.appendChild(document.createTextNode(rest.slice(0, best)));
      el.appendChild(h("span", { class: "hl", text: hit }));
      rest = rest.slice(best + hit.length);
    }
  }
  function renderStatement() {
    highlight($("#statement-text"), C.statement.text, C.statement.highlights);
    var f = $("#facts"); f.textContent = "";
    arr(C.statement.facts).forEach(function (x) { f.appendChild(h("div", null, [h("dt", { text: x.label }), h("dd", { text: x.value })])); });
  }

  /* ------------------------------------------------------------ Services bento */
  var sizeClass = { wide: "s7", medium: "s5", third: "s4", half: "s6" };
  function renderServices() {
    var bento = $("#svc-bento"); bento.textContent = "";
    var flatN = 0;
    arr(C.services.items).forEach(function (s) {
      var enquire = h("a", { class: "pill-link", href: "#contact", text: "Enquire" });
      enquire.addEventListener("click", function () { $("#f-type").value = s.title; renderLight(); });
      var media = s.image
        ? h("div", { class: "svc-media" }, [h("img", { src: s.image, alt: "", loading: "lazy", decoding: "async" })])
        : h("div", { class: "svc-art", "aria-hidden": "true" });
      var cls = "svc-card " + (sizeClass[s.size] || "s4") + (s.image ? "" : " no-img flat" + (flatN++ % 2 ? " alt" : ""));
      bento.appendChild(h("article", { class: cls }, [media, h("div", { class: "svc-body" }, [
        s.group ? h("span", { class: "chip", text: s.group }) : null,
        h("h3", { text: s.title }),
        h("p", { class: "svc-line", text: s.line }),
        h("ul", { class: "svc-includes" }, arr(s.includes).filter(Boolean).map(function (t) { return h("li", { text: t }); })),
        enquire
      ])]));
    });
    $("#footer-svc").textContent = arr(C.services.items).map(function (s) { return s.title; }).join(" · ");
  }

  /* ------------------------------------------------------------ Work: featured gallery */
  var hs = $("#work"), track = $("#hs-track"), hsVp = $("#hs-viewport"), hsBar = $("#hs-bar"), hsCount = $("#hs-count");
  var panels = [], dist = 0, featured = [];
  function renderFeatured() {
    var items = arr(C.work.items).filter(function (p) { return p.image; });
    featured = items.filter(function (p) { return p.featured; });
    if (!featured.length) featured = items.slice(0, 5);
    track.textContent = ""; panels = [];
    var pinnedHint = "Scroll to move through the work";
    track.appendChild(h("div", { class: "hs-intro" }, [h("p", { class: "hs-intro-text", text: C.work.featuredIntro }), h("p", { class: "hs-hint", id: "hs-hint", text: pinnedHint })]));
    featured.forEach(function (p, i) {
      var img = h("img", { src: p.image, alt: p.title + (p.place ? ", " + p.place : ""), loading: i > 1 ? "lazy" : "eager", decoding: "async" });
      var fig = h("button", { class: "hs-figure", type: "button", "data-cursor": p.type === "film" ? "Play" : "View", "aria-label": "Open " + p.title }, [
        img,
        p.category ? h("span", { class: "chip chip-glass hs-num", text: p.category }) : null,
        p.type === "film" && p.duration ? h("span", { class: "chip chip-glass hs-dur", text: "▶ " + p.duration }) : null,
        p.type === "film" ? h("span", { class: "play", "aria-hidden": "true" }) : null,
        h("span", { class: "hs-overlay" }, [h("b", { text: p.title }), h("span", { text: p.place })])
      ]);
      fig.addEventListener("click", function () { openViewer(featured, i); });
      var panel = h("article", { class: "hs-panel", "aria-label": p.title }, [fig, h("div", { class: "hs-text" }, [
        p.text ? h("p", { text: p.text }) : null,
        p.delivered ? h("p", { class: "hs-deliver", text: p.delivered }) : null
      ])]);
      panel.style.setProperty("--ar", Math.min(aspectOf(p.image), 1.6).toFixed(3));
      learn(img, p.image, function (a) { panel.style.setProperty("--ar", Math.min(a, 1.6).toFixed(3)); relayoutSoon(); });
      track.appendChild(panel); panels.push(panel);
    });
    var total = items.length;
    track.appendChild(h("a", { class: "hs-end", href: "#all-title" }, [h("b", { text: "See all the work" }), h("span", { text: total + " project" + (total === 1 ? "" : "s") + ", filtered by service →" })]));
  }
  function hsSetup() {
    var pin = !reduce && window.innerWidth >= 900 && window.innerHeight >= 560;
    hs.classList.toggle("pinned", pin);
    track.style.transform = "";
    if (pin) { dist = Math.max(0, track.scrollWidth - window.innerWidth); hs.style.height = (window.innerHeight + dist) + "px"; }
    else { dist = 0; hs.style.height = ""; }
    var hint = $("#hs-hint"); if (hint) hint.textContent = pin ? "Scroll to move through the work" : "Swipe to see more";
    hsUpdate();
  }
  function hsUpdate() {
    var p;
    if (hs.classList.contains("pinned")) {
      p = dist ? Math.min(1, Math.max(0, (window.scrollY - hs.offsetTop) / dist)) : 0;
      track.style.transform = "translate3d(" + (-p * dist).toFixed(1) + "px,0,0)";
    } else { var max = hsVp.scrollWidth - hsVp.clientWidth; p = max > 0 ? hsVp.scrollLeft / max : 0; }
    hsBar.style.width = (p * 100).toFixed(1) + "%";
    var idx = 0, mid = window.innerWidth * 0.55;
    panels.forEach(function (el, k) { if (el.getBoundingClientRect().left < mid) idx = k; });
    hsCount.textContent = pad(panels.length ? idx + 1 : 0) + " / " + pad(panels.length);
  }
  window.addEventListener("scroll", hsUpdate, { passive: true });
  hsVp.addEventListener("scroll", hsUpdate, { passive: true });
  window.addEventListener("resize", hsSetup);
  window.addEventListener("load", hsSetup);

  /* ------------------------------------------------------------ Work: all (justified rows) */
  var jg = $("#justified"), tabs = $("#tabs"), tiles = [], visible = [], filter = "All";
  function renderAllWork() {
    var items = arr(C.work.items).filter(function (p) { return p.image; });
    var cats = arr(C.work.categories).filter(function (c) { return items.some(function (p) { return p.category === c; }); });
    items.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
    if (filter !== "All" && cats.indexOf(filter) < 0) filter = "All";
    tabs.textContent = "";
    ["All"].concat(cats).forEach(function (c) {
      var n = c === "All" ? items.length : items.filter(function (p) { return p.category === c; }).length;
      var b = h("button", { class: "tab", type: "button", "aria-pressed": String(c === filter) }, [c, h("sup", { text: String(n) })]);
      b.addEventListener("click", function () { filter = c; applyFilter(); });
      tabs.appendChild(b);
    });
    jg.textContent = "";
    tiles = items.map(function (p) {
      var img = h("img", { src: p.image, alt: p.title + (p.place ? ", " + p.place : ""), loading: "lazy", decoding: "async" });
      var t = h("button", { class: "tile", type: "button", "data-cursor": p.type === "film" ? "Play" : "View", "aria-label": "Open " + p.title + ", " + kind(p) }, [
        img,
        p.type === "film" && p.duration ? h("span", { class: "badge", text: "▶ " + p.duration }) : null,
        h("span", { class: "tile-cap" }, [h("b", { text: p.title }), h("span", { text: [p.category, p.place].filter(Boolean).join(" · ") })])
      ]);
      t.addEventListener("click", function () { openViewer(visible, visible.indexOf(p)); });
      jg.appendChild(t);
      var tile = { el: t, p: p, a: aspectOf(p.image) };
      learn(img, p.image, function (a) { tile.a = a; relayoutSoon(); });
      return tile;
    });
    applyFilter();
  }
  function applyFilter() {
    $$(".tab", tabs).forEach(function (b) { b.setAttribute("aria-pressed", String(b.firstChild.textContent === filter)); });
    visible = tiles.filter(function (t) { return filter === "All" || t.p.category === filter; }).map(function (t) { return t.p; });
    tiles.forEach(function (t) {
      var show = filter === "All" || t.p.category === filter;
      t.el.hidden = !show;
      if (show) { t.el.style.animation = "none"; void t.el.offsetWidth; t.el.style.animation = ""; }
    });
    layout();
  }
  function layout() {
    var W = jg.clientWidth; if (!W) return;
    var gap = 12, target = W < 560 ? 170 : W < 980 ? 250 : 320;
    var shown = tiles.filter(function (t) { return !t.el.hidden; }), row = [], sum = 0;
    function place(r, hgt, fill) {
      var avail = W - gap * (r.length - 1), used = 0;
      r.forEach(function (t, k) {
        var w = Math.floor(t.a * hgt);
        if (fill && k === r.length - 1) w = avail - used;
        used += w; t.el.style.width = w + "px"; t.el.style.height = Math.round(hgt) + "px";
      });
    }
    shown.forEach(function (t) {
      row.push(t); sum += t.a;
      if (sum * target + gap * (row.length - 1) >= W) { place(row, (W - gap * (row.length - 1)) / sum, true); row = []; sum = 0; }
    });
    if (row.length) { var fit = (W - gap * (row.length - 1)) / sum; place(row, Math.min(target * 1.15, fit), fit <= target * 1.15); }
  }
  if ("ResizeObserver" in window) new ResizeObserver(layout).observe(jg); else window.addEventListener("resize", layout);

  /* ------------------------------------------------------------ Viewer */
  var viewer = $("#viewer"), vStage = $("#v-stage"), vImg = $("#v-img"), vDetails = $("#v-details"), vInfo = $("#v-info"), vWatch = $("#v-watch");
  var vList = [], vI = 0, lastFocus = null;
  function setDetails(on) {
    vDetails.hidden = !on; viewer.classList.toggle("details-open", on);
    vInfo.setAttribute("aria-pressed", String(on)); store.set("cl-details", on ? "1" : "0");
  }
  function fillViewer() {
    var p = vList[vI];
    vStage.classList.remove("zoom");
    vImg.style.opacity = "0";
    vImg.onload = function () { vImg.style.opacity = "1"; };
    vImg.src = p.image; vImg.alt = p.title + (p.place ? ", " + p.place : "");
    if (vImg.complete) vImg.style.opacity = "1";
    $("#v-count").textContent = pad(vI + 1) + " / " + pad(vList.length) + (p.category ? "   " + p.category : "");
    $("#v-title").textContent = p.title;
    $("#v-place").textContent = [p.place, kind(p)].filter(Boolean).join(" · ");
    var url = safeUrl(p.video);
    if (url) { vWatch.href = url; vWatch.hidden = false; } else vWatch.hidden = true;
    $("#v-series").textContent = p.category || "";
    $("#v-series").hidden = !p.category;
    $("#v-note").textContent = p.text || "";
    var dl = $("#v-dl"); dl.textContent = "";
    [["Service", p.category], ["Location", p.place], ["Format", kind(p)], ["Delivered", p.delivered]].forEach(function (r) {
      if (r[1]) dl.appendChild(h("div", null, [h("dt", { text: r[0] }), h("dd", { text: r[1] })]));
    });
  }
  function openViewer(list, i) {
    if (i < 0 || !list.length) return;
    vList = list; vI = i; lastFocus = document.activeElement;
    fillViewer(); viewer.hidden = false;
    setDetails(store.get("cl-details") !== "0");
    document.documentElement.style.overflow = "hidden";
    $("#v-close").focus();
  }
  function closeViewer() { viewer.hidden = true; document.documentElement.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  function step(d) { vI = (vI + d + vList.length) % vList.length; fillViewer(); }
  $("#v-close").addEventListener("click", closeViewer);
  $("#v-prev").addEventListener("click", function () { step(-1); });
  $("#v-next").addEventListener("click", function () { step(1); });
  vInfo.addEventListener("click", function () { setDetails(vDetails.hidden); });
  vImg.addEventListener("click", function (e) {
    if (!vStage.classList.contains("zoom")) {
      var r = vImg.getBoundingClientRect();
      vImg.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%";
    }
    vStage.classList.toggle("zoom");
  });
  vStage.addEventListener("click", function (e) { if (e.target === vStage) closeViewer(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && header.classList.contains("menu-open")) { setMenu(false); return; }
    if (viewer.hidden) return;
    if (e.key === "Escape") closeViewer();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "Tab") {
      var f = $$("button, a[href]", viewer).filter(function (b) { return b.offsetParent; });
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  var tx = null;
  vStage.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
  vStage.addEventListener("touchend", function (e) {
    if (tx === null || vStage.classList.contains("zoom")) return;
    var dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  /* ------------------------------------------------------------ Editing, design, digital, process, FAQ */
  var cmp = $("#compare"), range = $("#compare-range");
  range.addEventListener("input", function () { cmp.style.setProperty("--pos", range.value + "%"); });
  function renderEditing() {
    var e = C.editing;
    $("#compare-final").src = e.after || ""; $("#compare-raw").src = e.before || "";
    $("#compare").hidden = !(e.after && e.before);
    var a = $("#adjust"); a.textContent = "";
    arr(e.chips).forEach(function (c) { a.appendChild(h("div", null, [h("dt", { text: c.label }), h("dd", { text: c.value })])); });
  }
  function renderDesign() {
    var g = $("#design-grid"); g.textContent = "";
    arr(C.design.items).filter(function (d) { return d.image; }).forEach(function (d) {
      g.appendChild(h("figure", { class: "dz" }, [
        h("div", { class: "art art-img" }, [h("img", { src: d.image, alt: d.title, loading: "lazy", decoding: "async" })]),
        h("figcaption", null, [h("b", { text: d.title }), h("span", { text: d.note })])
      ]));
    });
  }
  var calTypes = { reel: "reel", story: "story", carousel: "carousel", ad: "ad", post: "carousel", video: "reel" };
  function renderDigital() {
    var t = $("#ticks"); t.textContent = "";
    arr(C.digital.steps).forEach(function (s) { t.appendChild(h("li", null, [h("b", { text: s.title }), h("span", { text: s.text })])); });
    var cal = $("#cal"); cal.textContent = "";
    arr(C.digital.calendar).forEach(function (c) {
      cal.appendChild(h("li", null, [h("span", { class: "d", text: c.day }), h("span", { class: "t " + (calTypes[String(c.type || "").toLowerCase()] || "story"), text: c.type }), h("span", { class: "c", text: c.text })]));
    });
    var n = arr(C.digital.calendar).length;
    $("#cal-count").textContent = n + " post" + (n === 1 ? "" : "s");
  }
  function renderProcess() {
    var ol = $("#steps"); ol.textContent = "";
    arr(C.process.steps).forEach(function (s, i) { ol.appendChild(h("li", null, [h("span", { class: "step-n", text: pad(i + 1) }), h("h3", { text: s.title }), h("p", { text: s.text })])); });
  }
  function renderFaq() {
    var l = $("#faq-list"); l.textContent = "";
    arr(C.faq.items).forEach(function (f) { l.appendChild(h("details", null, [h("summary", { text: f.q }), h("p", { text: f.a })])); });
  }

  /* ------------------------------------------------------------ Contact + footer */
  function digits(s) { return String(s || "").replace(/[^\d]/g, ""); }
  function renderContact() {
    var s = C.site, list = $("#contact-list"); list.textContent = "";
    if (s.phone) list.appendChild(h("li", null, [h("span", { text: "Phone" }), h("b", { text: s.phone })]));
    if (digits(s.whatsapp)) list.appendChild(h("li", null, [h("span", { text: "WhatsApp" }), h("a", { href: "https://wa.me/" + digits(s.whatsapp), target: "_blank", rel: "noopener", text: "+" + digits(s.whatsapp) })]));
    if (s.location) list.appendChild(h("li", null, [h("span", { text: "Studio" }), h("b", { text: s.location })]));
    if (s.hours) list.appendChild(h("li", null, [h("span", { text: "Hours" }), h("b", { text: s.hours })]));
    $("#copy-email").hidden = !s.email;
    var keep = $("#f-type").value;
    var ft = $("#f-type"); ft.textContent = "";
    arr(C.services.items).forEach(function (x) { ft.appendChild(h("option", { text: x.title })); });
    ft.appendChild(h("option", { text: "Something else" }));
    if (keep) ft.value = keep;
    if (!ft.value) ft.selectedIndex = 0;
    var fb = $("#f-budget"), kb = fb.value; fb.textContent = "";
    arr(C.contact.budgets).forEach(function (b) { fb.appendChild(h("option", { text: b })); });
    if (kb) fb.value = kb;
    fb.closest(".field").hidden = !arr(C.contact.budgets).length;
    var fp = $("#f-place"), kp = fp.value; fp.textContent = "";
    arr(C.contact.places).forEach(function (p, i) { fp.appendChild(h("option", { value: String(i), text: p.name })); });
    fp.appendChild(h("option", { value: "other", text: "Somewhere else" }));
    if (kp && fp.querySelector('option[value="' + kp + '"]')) fp.value = kp;
    renderLight();
    $("#footer-phone").textContent = s.phone || "";
    var so = $("#socials"); so.textContent = "";
    [["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"], ["youtube", "YouTube"]].forEach(function (k) {
      var u = safeUrl(s[k[0]]); if (u) so.appendChild(h("a", { href: u, target: "_blank", rel: "noopener", text: k[1] }));
    });
  }

  /* Best light on the client's date */
  var RAD = Math.PI / 180, OFF = 2 * 3600000;
  function elevation(ms, lat, lon) {
    var d = ms / 86400000 + 2440587.5 - 2451545.0;
    var g = ((357.529 + 0.98560028 * d) % 360) * RAD, q = (280.459 + 0.98564736 * d) % 360;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = (18.697374558 + 24.06570982441908 * d) % 24, H = (gmst * 15 + lon) * RAD - ra, la = lat * RAD;
    return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H)) / RAD;
  }
  function today() { var t = new Date(Date.now() + OFF); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()); }
  function hm(m) { m = Math.round(m); return pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60); }
  function day(ds, pl) {
    var a = ds.split("-").map(Number), start = Date.UTC(a[0], a[1] - 1, a[2]) - OFF, el = [];
    for (var m = 0; m <= 1440; m++) el.push(elevation(start + m * 60000, pl.lat, pl.lon));
    var noon = 0; el.forEach(function (v, i) { if (v > el[noon]) noon = i; });
    var gold = [], s = null;
    for (var i = 0; i <= 1440; i++) {
      var ok = el[i] >= -4 && el[i] <= 6;
      if (ok && s === null) s = i;
      if ((!ok || i === 1440) && s !== null) { gold.push([s, ok ? i : i - 1]); s = null; }
    }
    var rise = null, set = null;
    for (var j = 1; j <= 1440; j++) {
      if (el[j - 1] < -0.833 && el[j] >= -0.833 && rise === null) rise = j;
      if (el[j - 1] >= -0.833 && el[j] < -0.833) set = j;
    }
    return { el: el, am: gold.filter(function (g) { return g[0] < noon; })[0], pm: gold.filter(function (g) { return g[0] > noon; })[0], rise: rise, set: set };
  }
  var fPlace = $("#f-place"), fDate = $("#f-date"), fType = $("#f-type");
  fDate.min = today();
  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, txt) { var n = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (txt != null) n.textContent = txt; return n; }
  var noShoot = ["graphic design", "digital marketing", "video editing", "something else"];
  function renderLight() {
    var note = $("#light-note");
    var places = arr(C.contact.places);
    if (!C.contact.showLight || fPlace.value === "other" || !places[+fPlace.value] || noShoot.indexOf(String(fType.value).toLowerCase()) >= 0) { note.hidden = true; return; }
    note.hidden = false;
    var pl = places[+fPlace.value], ds = fDate.value && fDate.value >= today() ? fDate.value : today(), d = day(ds, pl);
    var when = ds === today() ? "Today" : new Date(ds + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    var head = $("#light-head"); head.textContent = "";
    head.append("Shooting outdoors? " + when + " in " + pl.name + ", the softest light starts at ");
    head.appendChild(h("strong", { text: d.am ? hm(d.am[0]) : "–" })); head.append(" and ");
    head.appendChild(h("strong", { text: d.pm ? hm(d.pm[0]) : "–" })); head.append(".");
    $("#light-am").textContent = d.am ? hm(d.am[0]) + "–" + hm(d.am[1]) : "–";
    $("#light-pm").textContent = d.pm ? hm(d.pm[0]) + "–" + hm(d.pm[1]) : "–";
    $("#light-sun").textContent = (d.rise ? hm(d.rise) : "–") + " · " + (d.set ? hm(d.set) : "–");
    var svg = $("#light-arc"); svg.textContent = "";
    var X0 = 240, X1 = 1200, W = 600, top = 6, bot = 96, EMIN = -12, EMAX = 90;
    var x = function (m) { return (m - X0) / (X1 - X0) * W; };
    var y = function (e) { return top + (EMAX - Math.max(EMIN, e)) / (EMAX - EMIN) * (bot - top); };
    [d.am, d.pm].forEach(function (g) { if (g) svg.appendChild(sv("rect", { class: "gold", x: x(g[0]), y: top, width: Math.max(2, x(g[1]) - x(g[0])), height: bot - top })); });
    svg.appendChild(sv("line", { class: "horizon", x1: 0, x2: W, y1: y(0), y2: y(0) }));
    var path = "";
    for (var m = X0; m <= X1; m += 4) path += (m === X0 ? "M" : "L") + x(m).toFixed(1) + " " + y(d.el[m]).toFixed(1);
    svg.appendChild(sv("path", { class: "curve", d: path }));
    [6, 12, 18].forEach(function (hr) { svg.appendChild(sv("text", { class: "tick", x: x(hr * 60), y: 114, "text-anchor": "middle" }, pad(hr) + ":00")); });
  }
  [fPlace, fDate, fType].forEach(function (el) { el.addEventListener("change", renderLight); });

  var copyBtn = $("#copy-email"), email = $("#contact-email");
  copyBtn.addEventListener("click", function () {
    function fallback() { var r = document.createRange(); r.selectNodeContents(email); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); copyBtn.textContent = "Selected"; }
    try { navigator.clipboard.writeText(email.textContent.trim()).then(function () { copyBtn.textContent = "Copied"; }, fallback); }
    catch (e) { fallback(); }
    setTimeout(function () { copyBtn.textContent = "Copy"; }, 2400);
  });
  var form = $("#form"), status = $("#form-status"), submit = $("#f-submit");
  function err(id, msg) {
    var i = $("#" + id), e = $("#" + id + "-err"); e.textContent = msg || "";
    if (msg) i.setAttribute("aria-invalid", "true"); else i.removeAttribute("aria-invalid");
    return !msg;
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("#f-name").value.trim(), mail = $("#f-email").value.trim(), phone = $("#f-phone").value.trim(), date = fDate.value;
    var ok = err("f-name", name ? "" : "Add your name so we know who to reply to.");
    ok = err("f-email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? "" : "Enter an email address, for example name@example.com.") && ok;
    ok = err("f-phone", !phone || /^[+\d][\d\s-]{7,}$/.test(phone) ? "" : "Enter a phone number, for example +260 97 123 4567.") && ok;
    ok = err("f-date", !date || date >= today() ? "" : "Choose today or a later date.") && ok;
    if (!ok) { form.querySelector("[aria-invalid='true']").focus(); return; }
    var data = { name: name, phone: phone, email: mail, service: fType.value, budget: $("#f-budget").value,
      location: fPlace.options[fPlace.selectedIndex] ? fPlace.options[fPlace.selectedIndex].text : "", date: date,
      message: $("#f-msg").value.trim(), company: $("#f-company").value };
    function done(state) {
      submit.disabled = false; submit.textContent = "Send enquiry";
      status.classList.toggle("ok", state === "sent");
      status.textContent = state === "sent" ? "Thank you, " + name.split(" ")[0] + ". We will reply within one working day."
        : state === "offline" ? "The enquiry form is not connected yet. Please email us at " + (C.site.email || "the address on this page") + "."
        : "The enquiry did not send. Check your connection and try again, or email us directly.";
      if (state === "sent") $("#f-msg").value = "";
      status.focus();
    }
    submit.disabled = true; submit.textContent = "Sending…";
    var custom = safeUrl(C.site.formEndpoint);
    fetch(custom || "api/enquiry.php", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { done(r.ok ? "sent" : (!custom && (r.status === 404 || r.status === 405 || r.status === 501)) ? "offline" : "failed"); },
            function () { done(custom ? "failed" : "offline"); });
  });

  /* ------------------------------------------------------------ View cursor */
  var cursor = $("#cursor"), cText = $("#cursor-text");
  if (finePointer) {
    document.documentElement.classList.add("has-cursor");
    var cx = -200, cy = -200, px = -200, py = -200;
    document.addEventListener("mousemove", function (e) {
      px = e.clientX; py = e.clientY;
      var tgt = e.target.closest && e.target.closest("[data-cursor]");
      var show = !!tgt && viewer.hidden;
      if (show) cText.textContent = tgt.getAttribute("data-cursor");
      cursor.classList.toggle("on", show);
    }, { passive: true });
    document.addEventListener("mouseleave", function () { cursor.classList.remove("on"); });
    (function follow() {
      var k = reduce ? 1 : 0.22; cx += (px - cx) * k; cy += (py - cy) * k;
      cursor.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      requestAnimationFrame(follow);
    })();
  }

  /* ------------------------------------------------------------ Render everything */
  function render(content) {
    if (content) C = content;
    $$("[data-c]").forEach(function (el) { var v = get(C, el.dataset.c); el.textContent = v == null ? "" : v; });
    $$("[data-show]").forEach(function (el) { var sec = C[el.dataset.show]; el.hidden = !!sec && sec.show === false; });
    document.title = [C.site.name, C.site.tagline].filter(Boolean).join(" — ");
    var md = $('meta[name="description"]'); if (md) md.setAttribute("content", C.site.description || "");
    renderHero(); renderBand(); renderStatement(); renderServices(); renderFeatured(); renderAllWork();
    renderEditing(); renderDesign(); renderDigital(); renderProcess(); renderFaq(); renderContact();
    $("#year").textContent = new Date().getFullYear();
    hsSetup(); layout(); onScroll();
  }
  window.Site = { render: render, get content() { return C; } };

  render();
  requestAnimationFrame(heroTick);

  /* ------------------------------------------------------------ Admin panel loader (yoursite/#admin) */
  var cmsLoading = false;
  function maybeAdmin() {
    if (location.hash !== "#admin") return;
    if (window.CMS) { window.CMS.open(); return; }
    if (cmsLoading) return;
    cmsLoading = true;
    var css = h("link", { rel: "stylesheet", href: "admin/admin.css" });
    var js = h("script", { src: "admin/admin.js" });
    js.onload = function () { if (window.CMS) window.CMS.open(); };
    js.onerror = function () { cmsLoading = false; alertLine("The admin panel files are missing from the admin folder."); };
    document.head.appendChild(css); document.body.appendChild(js);
  }
  function alertLine(msg) { var p = h("p", { class: "form-status", text: msg }); document.body.appendChild(p); }
  window.addEventListener("hashchange", maybeAdmin);
  maybeAdmin();
})();
