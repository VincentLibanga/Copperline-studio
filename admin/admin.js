/* Copperline CMS — visual editor that opens over the live site at yoursite/#admin.
   With the PHP files in /api it signs in, saves, uploads images and shows enquiries.
   Without a server it runs in demo mode and keeps changes in this browser only. */
(function () {
  "use strict";

  var Site = window.Site;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function getPath(o, p) { return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split("."), last = ks.pop(); var t = ks.reduce(function (a, k) { if (a[k] == null) a[k] = {}; return a[k]; }, o); t[last] = v; }
  var lsGet = function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  var lsDel = function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } };

  /* ------------------------------------------------------------ State */
  var state = { mode: "checking", csrf: "", draft: null, saved: "", section: "site", collapsed: false };
  var DRAFT_KEY = "copperline-cms-draft";

  /* ------------------------------------------------------------ Content schema */
  function categoriesOf() { return (state.draft.work.categories || []).filter(Boolean); }
  function groupsOf() {
    var g = []; (state.draft.services.items || []).forEach(function (s) { if (s.group && g.indexOf(s.group) < 0) g.push(s.group); });
    return g.length ? g : ["Celebrations", "Film & motion", "Brand & digital"];
  }
  var SCHEMA = [
    { id: "site", title: "Brand & contact", target: "top", path: "site", intro: "Your business name, contact details and social links. These appear in the menu, booking section and footer.", fields: [
      { k: "name", label: "Business name" },
      { k: "tagline", label: "Tagline", help: "Shown in the browser tab after your name." },
      { k: "description", label: "Search description", type: "textarea", rows: 3, max: 200, help: "What Google shows under your name. About 150 characters." },
      { k: "email", label: "Email", type: "email" },
      { k: "phone", label: "Phone", type: "tel" },
      { k: "whatsapp", label: "WhatsApp number", type: "tel", help: "With country code and no spaces, for example 260971234567." },
      { k: "location", label: "Studio location" },
      { k: "hours", label: "Opening hours" },
      { k: "instagram", label: "Instagram link", type: "url", placeholder: "https://instagram.com/…" },
      { k: "facebook", label: "Facebook link", type: "url", placeholder: "https://facebook.com/…" },
      { k: "tiktok", label: "TikTok link", type: "url", placeholder: "https://tiktok.com/@…" },
      { k: "youtube", label: "YouTube link", type: "url", placeholder: "https://youtube.com/@…" },
      { k: "formEndpoint", label: "Custom form address (optional)", type: "url", help: "Leave empty. Enquiries then arrive in the Enquiries tab and by email." }
    ] },
    { id: "hero", title: "Opening slideshow", target: "top", path: "hero", intro: "The first screen visitors see. Each slide pairs a photo with the coloured word in the headline.", fields: [
      { k: "kicker", label: "Small label above the headline" },
      { k: "line1", label: "Headline, first line" },
      { k: "line2", label: "Headline, second line" },
      { k: "primaryButton", label: "Main button text" },
      { k: "secondaryButton", label: "Second button text" },
      { k: "slides", label: "Slides", type: "list", add: "Add slide", itemLabel: function (it) { return it.word || "New slide"; }, thumb: "image",
        blank: { word: "", image: "", caption: "", focusX: 50, focusY: 50 }, fields: [
          { k: "word", label: "Coloured word", help: "For example: weddings" },
          { k: "image", label: "Photo", type: "image", focus: true, help: "Wide photos work best. Click the preview to set where the slide opens from." },
          { k: "caption", label: "Caption", help: "Shown in the small box at the bottom right." }
        ] }
    ] },
    { id: "statement", title: "Studio intro", target: ".statement", path: "statement", fields: [
      { k: "label", label: "Small label" },
      { k: "text", label: "Intro text", type: "textarea", rows: 4 },
      { k: "highlights", label: "Words to colour", help: "Copy phrases from the intro text, separated by commas." },
      { k: "facts", label: "Fact cards", type: "list", add: "Add fact", itemLabel: function (it) { return it.label || "New fact"; }, blank: { label: "", value: "" }, fields: [
        { k: "label", label: "Label" }, { k: "value", label: "Value" }
      ] }
    ] },
    { id: "services", title: "Services", target: "#services", path: "services", fields: [
      { k: "title", label: "Section title" },
      { k: "intro", label: "Section intro", type: "textarea", rows: 2 },
      { k: "items", label: "Services", type: "list", add: "Add service", itemLabel: function (it) { return it.title || "New service"; }, thumb: "image",
        blank: { title: "", group: "", size: "third", image: "", line: "", includes: [] }, fields: [
          { k: "title", label: "Service name" },
          { k: "group", label: "Group", type: "combo", options: groupsOf, help: "Pick a group or type a new one." },
          { k: "size", label: "Card size", type: "select", options: [["wide", "Wide"], ["medium", "Medium"], ["half", "Half width"], ["third", "One third"]] },
          { k: "image", label: "Photo (optional)", type: "image" },
          { k: "line", label: "One-line description", type: "textarea", rows: 2 },
          { k: "includes", label: "What is included", type: "tags", add: "Add item" }
        ] }
    ] },
    { id: "work", title: "Work", target: "#work", path: "work", intro: "Your portfolio. Tick “Show in selected work” for the projects in the side-scrolling gallery.", fields: [
      { k: "featuredTitle", label: "Gallery title" },
      { k: "featuredIntro", label: "Gallery intro", type: "textarea", rows: 2 },
      { k: "allTitle", label: "Grid title" },
      { k: "categories", label: "Categories (filter buttons)", type: "tags", add: "Add category" },
      { k: "items", label: "Projects", type: "list", add: "Add project", itemLabel: function (it) { return it.title || "New project"; }, thumb: "image",
        blank: { title: "", category: "", featured: false, type: "photo", duration: "", image: "", place: "", delivered: "", video: "", text: "" }, fields: [
          { k: "title", label: "Project title" },
          { k: "image", label: "Photo or video still", type: "image" },
          { k: "category", label: "Category", type: "select", options: function () { return [["", "Choose…"]].concat(categoriesOf().map(function (c) { return [c, c]; })); } },
          { k: "type", label: "Type", type: "select", options: [["photo", "Photography"], ["film", "Film / video"]] },
          { k: "video", label: "Video link", type: "url", placeholder: "https://youtube.com/watch?v=…", help: "YouTube or Vimeo. Adds a “Watch the film” button.", when: function (it) { return it.type === "film"; } },
          { k: "duration", label: "Video length", placeholder: "3:48", when: function (it) { return it.type === "film"; } },
          { k: "place", label: "Location" },
          { k: "delivered", label: "What was delivered" },
          { k: "text", label: "Description", type: "textarea", rows: 3 },
          { k: "featured", label: "Show in selected work", type: "toggle" }
        ] }
    ] },
    { id: "editing", title: "Before & after", target: "#editing", path: "editing", fields: [
      { k: "show", label: "Show this section", type: "toggle" },
      { k: "label", label: "Small label" }, { k: "title", label: "Title" }, { k: "text", label: "Text", type: "textarea", rows: 3 },
      { k: "before", label: "Before image (unedited)", type: "image" }, { k: "beforeLabel", label: "Before label" },
      { k: "after", label: "After image (finished)", type: "image" }, { k: "afterLabel", label: "After label" },
      { k: "chips", label: "Settings chips", type: "list", add: "Add chip", itemLabel: function (it) { return it.label || "New chip"; }, blank: { label: "", value: "" }, fields: [
        { k: "label", label: "Label" }, { k: "value", label: "Value" }
      ] }
    ] },
    { id: "design", title: "Graphic design", target: "#design", path: "design", fields: [
      { k: "show", label: "Show this section", type: "toggle" },
      { k: "title", label: "Title" }, { k: "intro", label: "Intro", type: "textarea", rows: 2 },
      { k: "items", label: "Design pieces", type: "list", add: "Add design", itemLabel: function (it) { return it.title || "New design"; }, thumb: "image", blank: { title: "", note: "", image: "" }, fields: [
        { k: "image", label: "Image", type: "image", help: "Portrait images (4 × 5) fit best." }, { k: "title", label: "Title" }, { k: "note", label: "Note" }
      ] }
    ] },
    { id: "digital", title: "Content & marketing", target: "#digital", path: "digital", fields: [
      { k: "show", label: "Show this section", type: "toggle" },
      { k: "label", label: "Small label" }, { k: "title", label: "Title" }, { k: "text", label: "Text", type: "textarea", rows: 3 },
      { k: "steps", label: "Steps", type: "list", add: "Add step", itemLabel: function (it) { return it.title || "New step"; }, blank: { title: "", text: "" }, fields: [
        { k: "title", label: "Step" }, { k: "text", label: "Description" }
      ] },
      { k: "calendarTitle", label: "Phone: calendar title" },
      { k: "calendar", label: "Phone: calendar rows", type: "list", add: "Add row", itemLabel: function (it) { return [it.day, it.type].filter(Boolean).join(" · ") || "New row"; }, blank: { day: "", type: "Reel", text: "" }, fields: [
        { k: "day", label: "Day" }, { k: "type", label: "Post type", type: "select", options: [["Reel", "Reel"], ["Story", "Story"], ["Carousel", "Carousel"], ["Ad", "Ad"], ["Post", "Post"], ["Video", "Video"]] }, { k: "text", label: "Post idea" }
      ] },
      { k: "calendarNote", label: "Phone: note at the bottom" }
    ] },
    { id: "process", title: "How we work", target: "#process", path: "process", fields: [
      { k: "title", label: "Title" }, { k: "intro", label: "Intro" },
      { k: "steps", label: "Steps", type: "list", add: "Add step", itemLabel: function (it) { return it.title || "New step"; }, blank: { title: "", text: "" }, fields: [
        { k: "title", label: "Step name" }, { k: "text", label: "Description", type: "textarea", rows: 3 }
      ] }
    ] },
    { id: "faq", title: "Questions", target: ".faq", path: "faq", fields: [
      { k: "label", label: "Small label" }, { k: "title", label: "Title" },
      { k: "items", label: "Questions", type: "list", add: "Add question", itemLabel: function (it) { return it.q || "New question"; }, blank: { q: "", a: "" }, fields: [
        { k: "q", label: "Question" }, { k: "a", label: "Answer", type: "textarea", rows: 4 }
      ] }
    ] },
    { id: "contact", title: "Booking form", target: "#contact", path: "contact", intro: "The service list in the form comes from your Services automatically.", fields: [
      { k: "label", label: "Small label" }, { k: "title", label: "Title" }, { k: "text", label: "Text", type: "textarea", rows: 2 },
      { k: "budgets", label: "Budget options", type: "tags", add: "Add option", help: "Remove all options to hide the budget field." },
      { k: "showLight", label: "Show best light for the date", type: "toggle" },
      { k: "places", label: "Towns for the light planner", type: "list", add: "Add town", itemLabel: function (it) { return it.name || "New town"; }, blank: { name: "", lat: -15.4, lon: 28.3 }, fields: [
        { k: "name", label: "Town" }, { k: "lat", label: "Latitude", type: "number", help: "South is negative, for example -15.39." }, { k: "lon", label: "Longitude", type: "number" }
      ] }
    ] },
    { id: "footer", title: "Footer", target: ".site-footer", path: "footer", fields: [
      { k: "ctaTitle", label: "Banner headline" }, { k: "ctaButton", label: "Banner button" }, { k: "copyright", label: "Copyright line" }
    ] }
  ];

  /* ------------------------------------------------------------ API */
  function api(path, opts) {
    opts = opts || {};
    var headers = { Accept: "application/json" };
    if (opts.json) headers["Content-Type"] = "application/json";
    if (state.csrf) headers["X-CSRF-Token"] = state.csrf;
    return fetch("api/" + path, { method: opts.method || (opts.json || opts.body ? "POST" : "GET"), credentials: "same-origin", headers: headers,
      body: opts.json ? JSON.stringify(opts.json) : opts.body })
      .then(function (r) {
        return r.text().then(function (t) {
          var data; try { data = JSON.parse(t); } catch (e) { var err = new Error("no-api"); err.status = r.status; throw err; }
          if (!r.ok || data.ok === false) { var e2 = new Error(data.error || "Request failed"); e2.status = r.status; e2.data = data; throw e2; }
          return data;
        });
      });
  }

  /* ------------------------------------------------------------ Shell */
  var root, body, statusEl, saveBtn, navEl, menuEl;
  function build() {
    root = h("aside", { class: "cms", id: "cms", "aria-label": "Site editor" });
    var tab = h("button", { class: "cms-tab", type: "button", onclick: function () { setCollapsed(false); } }, [h("span", { class: "cms-tab-dot" }), "Edit site"]);
    statusEl = h("span", { class: "cms-status", text: "Loading…" });
    saveBtn = h("button", { class: "cms-btn cms-primary", type: "button", onclick: save, text: "Publish" });
    var more = h("button", { class: "cms-btn cms-icon", type: "button", "aria-label": "More options", "aria-expanded": "false", onclick: toggleMenu, text: "⋯" });
    menuEl = h("div", { class: "cms-menu", hidden: true });
    var top = h("div", { class: "cms-top" }, [
      h("div", { class: "cms-brand" }, [h("span", { class: "cms-logo" }), h("div", null, [h("b", { text: "Site editor" }), statusEl])]),
      h("div", { class: "cms-actions" }, [
        h("button", { class: "cms-btn cms-ghost", type: "button", title: "Hide the panel to see the whole page", onclick: function () { setCollapsed(true); }, text: "Preview" }),
        saveBtn, more, menuEl
      ])
    ]);
    navEl = h("nav", { class: "cms-nav", "aria-label": "Sections" });
    body = h("div", { class: "cms-body" });
    root.appendChild(top); root.appendChild(navEl); root.appendChild(body);
    document.body.appendChild(root); document.body.appendChild(tab);
    document.addEventListener("click", function (e) { if (!menuEl.hidden && !e.target.closest(".cms-menu") && !e.target.closest(".cms-icon")) closeMenu(); });
    window.addEventListener("beforeunload", function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });
  }
  function setCollapsed(c) { state.collapsed = c; document.documentElement.classList.toggle("cms-collapsed", c); }
  function toggleMenu() { if (menuEl.hidden) openMenu(); else closeMenu(); }
  function closeMenu() { menuEl.hidden = true; $(".cms-icon", root).setAttribute("aria-expanded", "false"); }
  function openMenu() {
    menuEl.textContent = "";
    if (!state.draft || navEl.hidden) { menuEl.appendChild(h("button", { type: "button", onclick: function () { closeMenu(); close(); }, text: "Close editor" })); menuEl.hidden = false; return; }
    var items = [["Undo unsaved changes", revert, !dirty()]];
    if (state.mode === "server") items.push(["Enquiries", function () { showView("enquiries"); }], ["Change password", function () { showView("password"); }]);
    items.push(["Download a backup", exportJson], ["Restore from a backup…", importJson]);
    if (state.mode === "demo") items.push(["Clear demo changes", clearDemo]);
    if (state.mode === "server") items.push(["Sign out", logout]);
    items.push(["Close editor", close]);
    items.forEach(function (it) { menuEl.appendChild(h("button", { type: "button", disabled: it[2] || null, onclick: function () { closeMenu(); it[1](); }, text: it[0] })); });
    menuEl.hidden = false; $(".cms-icon", root).setAttribute("aria-expanded", "true");
  }

  function dirty() { return state.draft && JSON.stringify(state.draft) !== state.saved; }
  function setStatus() {
    if (!statusEl) return;
    var d = dirty();
    statusEl.className = "cms-status" + (d ? " is-dirty" : "") + (state.mode === "demo" ? " is-demo" : "");
    statusEl.textContent = state.mode === "demo" ? (d ? "Demo · unsaved changes" : "Demo mode · saved in this browser") : (d ? "Unsaved changes" : "All changes published");
    saveBtn.disabled = !d;
    saveBtn.textContent = state.mode === "demo" ? "Save" : "Publish";
  }
  var renderTimer = null;
  function changed() {
    setStatus();
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { Site.render(clone(state.draft)); }, 200);
  }
  function toast(msg, kind) {
    var t = h("div", { class: "cms-toast" + (kind ? " " + kind : ""), role: "status", text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("out"); }, 3200);
    setTimeout(function () { t.remove(); }, 3800);
  }

  /* ------------------------------------------------------------ Auth screens */
  function authScreen(kind) {
    navEl.hidden = true; body.textContent = ""; saveBtn.hidden = true;
    statusEl.textContent = kind === "setup" ? "First-time setup" : "Signed out";
    statusEl.className = "cms-status is-off";
    var pw = h("input", { type: "password", id: "cms-pw", autocomplete: kind === "setup" ? "new-password" : "current-password", required: true, minlength: kind === "setup" ? 10 : null });
    var pw2 = kind === "setup" ? h("input", { type: "password", id: "cms-pw2", autocomplete: "new-password", required: true }) : null;
    var code = kind === "setup" ? h("input", { type: "text", id: "cms-code", autocomplete: "off", spellcheck: "false", required: true }) : null;
    var msg = h("p", { class: "cms-err", role: "alert" });
    var btn = h("button", { class: "cms-btn cms-primary cms-wide", type: "submit", text: kind === "setup" ? "Create password and start" : "Sign in" });
    var form = h("form", { class: "cms-auth" }, [
      h("h2", { text: kind === "setup" ? "Create your admin password" : "Sign in to edit your site" }),
      h("p", { class: "cms-help", text: kind === "setup" ? "This is the only password for the editor. Use at least 10 characters and keep it somewhere safe." : "Enter the admin password for this website." }),
      code ? h("label", { for: "cms-code", text: "Setup code" }) : null, code,
      code ? h("p", { class: "cms-help", text: "Open the file data/setup-code.txt in your hosting file manager and copy the code. It works once." }) : null,
      h("label", { for: "cms-pw", text: kind === "setup" ? "New password" : "Password" }), pw,
      pw2 ? h("label", { for: "cms-pw2", text: "Repeat password" }) : null, pw2,
      msg, btn
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault(); msg.textContent = "";
      if (kind === "setup") {
        if (pw.value.length < 10) { msg.textContent = "Use at least 10 characters."; pw.focus(); return; }
        if (pw.value !== pw2.value) { msg.textContent = "The two passwords do not match."; pw2.focus(); return; }
        if (!code.value.trim()) { msg.textContent = "Enter the setup code."; code.focus(); return; }
      }
      btn.disabled = true;
      api("auth.php", { json: { action: kind === "setup" ? "setup" : "login", password: pw.value, code: code ? code.value : "" } })
        .then(function (d) { state.csrf = d.csrf; startEditor(); })
        .catch(function (err) { btn.disabled = false; msg.textContent = err.message === "no-api" ? "The server did not respond. Try again." : err.message; pw.select(); });
    });
    body.appendChild(form);
    setTimeout(function () { (code || pw).focus(); }, 50);
  }
  function logout() {
    if (dirty()) toast("Unpublished changes stay in this tab until you reload.", "bad");
    api("auth.php", { json: { action: "logout" } }).then(function () { state.csrf = ""; authScreen("login"); }, function () { authScreen("login"); });
  }

  /* ------------------------------------------------------------ Editor */
  function startEditor() {
    if (!state.draft) {
      state.draft = clone(Site.content);
      state.saved = JSON.stringify(state.draft);
      if (state.mode === "demo") {
        var d = lsGet(DRAFT_KEY);
        if (d) { try { state.draft = JSON.parse(d); state.saved = d; Site.render(clone(state.draft)); } catch (e) { /* ignore broken draft */ } }
      }
    }
    navEl.hidden = false; saveBtn.hidden = false;
    renderNav(); showView(state.section); setStatus();
  }
  function renderNav() {
    navEl.textContent = "";
    SCHEMA.forEach(function (s) {
      navEl.appendChild(h("button", { type: "button", "aria-current": String(state.section === s.id), onclick: function () { showView(s.id, true); }, text: s.title }));
    });
    if (state.mode === "server") navEl.appendChild(h("button", { type: "button", class: "cms-nav-inbox", "aria-current": String(state.section === "enquiries"), onclick: function () { showView("enquiries"); }, text: "Enquiries" }));
  }
  function showView(id, scroll) {
    state.section = id;
    $$("button", navEl).forEach(function (b) { b.setAttribute("aria-current", "false"); });
    var sec = SCHEMA.filter(function (s) { return s.id === id; })[0];
    body.textContent = ""; body.scrollTop = 0;
    if (id === "enquiries") { renderEnquiries(); markNav("Enquiries"); return; }
    if (id === "password") { renderPassword(); return; }
    if (!sec) return;
    markNav(sec.title);
    body.appendChild(h("div", { class: "cms-head" }, [h("h2", { text: sec.title }), sec.intro ? h("p", { class: "cms-help", text: sec.intro }) : null]));
    var obj = getPath(state.draft, sec.path);
    if (!obj) { obj = {}; setPath(state.draft, sec.path, obj); }
    body.appendChild(fieldsFor(sec.fields, obj, function () { changed(); }));
    if (scroll && sec.target) {
      var el = sec.target === "top" ? document.body : $(sec.target);
      if (el) { var y = sec.target === "top" ? 0 : el.getBoundingClientRect().top + window.scrollY - 20; window.scrollTo({ top: y, behavior: "smooth" }); }
    }
  }
  function markNav(title) { $$("button", navEl).forEach(function (b) { if (b.textContent === title) { b.setAttribute("aria-current", "true"); b.scrollIntoView({ block: "nearest", inline: "nearest" }); } }); }

  var uid = 0;
  function fieldsFor(fields, obj, onChange) {
    var wrap = h("div", { class: "cms-fields" });
    function draw() {
      wrap.textContent = "";
      fields.forEach(function (f) {
        if (f.when && !f.when(obj)) return;
        wrap.appendChild(field(f, obj, onChange, draw));
      });
    }
    draw();
    return wrap;
  }
  function field(f, obj, onChange, redraw) {
    var id = "cms-f" + (++uid), t = f.type || "text", val = obj[f.k];
    var help = f.help ? h("p", { class: "cms-help", text: f.help }) : null;
    function set(v, rerender) { obj[f.k] = v; onChange(); if (rerender) redraw(); }
    if (t === "toggle") {
      var cb = h("input", { type: "checkbox", id: id, role: "switch" }); cb.checked = val !== false && !!val;
      cb.addEventListener("change", function () { set(cb.checked); });
      return h("div", { class: "cms-field cms-toggle" }, [h("label", { for: id }, [cb, h("span", { class: "cms-switch", "aria-hidden": "true" }), f.label]), help]);
    }
    if (t === "list") return listField(f, obj, onChange);
    if (t === "tags") return tagsField(f, obj, onChange, id);
    if (t === "image") return imageField(f, obj, onChange, id);
    var input;
    if (t === "textarea") { input = h("textarea", { id: id, rows: f.rows || 3, maxlength: f.max || null, placeholder: f.placeholder || null }); input.value = val == null ? "" : val; }
    else if (t === "select") {
      input = h("select", { id: id });
      var opts = typeof f.options === "function" ? f.options() : f.options;
      var found = false;
      opts.forEach(function (o) { var op = h("option", { value: o[0], text: o[1] }); if (String(val) === String(o[0])) { op.selected = true; found = true; } input.appendChild(op); });
      if (!found && val) { var op = h("option", { value: val, text: val }); op.selected = true; input.appendChild(op); }
    } else if (t === "combo") {
      var listId = id + "-list";
      input = h("input", { id: id, type: "text", list: listId, autocomplete: "off" }); input.value = val || "";
      var dl = h("datalist", { id: listId }, f.options().map(function (o) { return h("option", { value: o }); }));
      input.addEventListener("input", function () { set(input.value); });
      return h("div", { class: "cms-field" }, [h("label", { for: id, text: f.label }), input, dl, help]);
    } else {
      input = h("input", { id: id, type: t === "number" ? "number" : t === "url" ? "url" : t === "email" ? "email" : t === "tel" ? "tel" : "text", step: t === "number" ? "any" : null, placeholder: f.placeholder || null });
      input.value = val == null ? "" : val;
    }
    var counter = f.max ? h("span", { class: "cms-count" }) : null;
    function count() { if (counter) counter.textContent = input.value.length + " / " + f.max; }
    count();
    input.addEventListener(t === "select" ? "change" : "input", function () {
      var v = input.value;
      if (t === "number") v = v === "" ? "" : Number(v);
      obj[f.k] = v; count(); onChange();
      if (t === "select") redraw();
    });
    if (t === "url") input.addEventListener("blur", function () {
      var v = input.value.trim();
      if (v && !/^https?:\/\//i.test(v)) { input.value = "https://" + v.replace(/^\/+/, ""); obj[f.k] = input.value; onChange(); }
    });
    return h("div", { class: "cms-field" }, [h("div", { class: "cms-label-row" }, [h("label", { for: id, text: f.label }), counter]), input, help]);
  }

  function tagsField(f, obj, onChange, id) {
    if (!Array.isArray(obj[f.k])) obj[f.k] = [];
    var list = obj[f.k];
    var box = h("div", { class: "cms-field" });
    function draw() {
      box.textContent = "";
      box.appendChild(h("label", { for: id, text: f.label }));
      var ul = h("ul", { class: "cms-tags" });
      list.forEach(function (v, i) {
        var inp = h("input", { type: "text", "aria-label": f.label + " " + (i + 1) }); inp.value = v;
        inp.addEventListener("input", function () { list[i] = inp.value; onChange(); });
        ul.appendChild(h("li", null, [inp,
          h("button", { type: "button", class: "cms-mini", "aria-label": "Move up", disabled: i === 0 || null, onclick: function () { list.splice(i - 1, 0, list.splice(i, 1)[0]); onChange(); draw(); }, text: "↑" }),
          h("button", { type: "button", class: "cms-mini danger", "aria-label": "Remove", onclick: function () { list.splice(i, 1); onChange(); draw(); }, text: "×" })
        ]));
      });
      box.appendChild(ul);
      var add = h("input", { type: "text", id: id, placeholder: (f.add || "Add") + " and press Enter" });
      add.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); var v = add.value.trim(); if (!v) return; list.push(v); onChange(); draw(); $("#" + id).focus(); }
      });
      box.appendChild(add);
      if (f.help) box.appendChild(h("p", { class: "cms-help", text: f.help }));
    }
    draw();
    return box;
  }

  function listField(f, obj, onChange) {
    if (!Array.isArray(obj[f.k])) obj[f.k] = [];
    var list = obj[f.k];
    var box = h("div", { class: "cms-field cms-list" });
    var open = {};
    function draw() {
      box.textContent = "";
      box.appendChild(h("div", { class: "cms-label-row" }, [h("span", { class: "cms-list-title", text: f.label }), h("span", { class: "cms-count", text: list.length + " item" + (list.length === 1 ? "" : "s") })]));
      list.forEach(function (it, i) {
        var isOpen = !!open[i];
        var thumbSrc = f.thumb ? it[f.thumb] : "";
        var head = h("div", { class: "cms-item-head" }, [
          h("button", { type: "button", class: "cms-item-toggle", "aria-expanded": String(isOpen), onclick: function () { open[i] = !open[i]; draw(); } }, [
            thumbSrc ? h("img", { src: thumbSrc, alt: "" }) : (f.thumb ? h("span", { class: "cms-thumb-empty" }) : null),
            h("span", { class: "cms-item-name", text: f.itemLabel(it) }),
            h("span", { class: "cms-chev", "aria-hidden": "true", text: isOpen ? "–" : "+" })
          ]),
          h("button", { type: "button", class: "cms-mini", "aria-label": "Move up", disabled: i === 0 || null, onclick: function () { move(i, -1); }, text: "↑" }),
          h("button", { type: "button", class: "cms-mini", "aria-label": "Move down", disabled: i === list.length - 1 || null, onclick: function () { move(i, 1); }, text: "↓" }),
          h("button", { type: "button", class: "cms-mini", "aria-label": "Duplicate", onclick: function () { list.splice(i + 1, 0, clone(it)); shiftOpen(i + 1, 1); onChange(); draw(); }, text: "⧉" }),
          deleteBtn(function () { list.splice(i, 1); shiftOpen(i, -1); onChange(); draw(); })
        ]);
        var card = h("div", { class: "cms-item" + (isOpen ? " open" : "") }, [head]);
        if (isOpen) card.appendChild(fieldsFor(f.fields, it, function () { onChange(); var n = $(".cms-item-name", card); if (n) n.textContent = f.itemLabel(it); var im = $(".cms-item-toggle img", card); if (im && f.thumb) im.src = it[f.thumb]; }));
        box.appendChild(card);
      });
      box.appendChild(h("button", { type: "button", class: "cms-btn cms-add", onclick: function () { list.push(clone(f.blank || {})); open[list.length - 1] = true; onChange(); draw(); }, text: "+ " + (f.add || "Add") }));
    }
    function shiftOpen(from, d) { var n = {}; Object.keys(open).forEach(function (k) { k = +k; if (k < from) n[k] = open[k]; else if (k + d >= from) n[k + d] = open[k]; }); open = n; }
    function move(i, d) { var j = i + d; var t = list[i]; list[i] = list[j]; list[j] = t; var o = open[i]; open[i] = open[j]; open[j] = o; onChange(); draw(); }
    draw();
    return box;
  }
  function deleteBtn(onConfirm) {
    var b = h("button", { type: "button", class: "cms-mini danger", "aria-label": "Delete", text: "×" });
    var armed = false, timer;
    b.addEventListener("click", function () {
      if (armed) { clearTimeout(timer); onConfirm(); return; }
      armed = true; b.textContent = "Delete?"; b.classList.add("armed");
      timer = setTimeout(function () { armed = false; b.textContent = "×"; b.classList.remove("armed"); }, 2500);
    });
    return b;
  }

  /* ------------------------------------------------------------ Images */
  function imageField(f, obj, onChange, id) {
    var box = h("div", { class: "cms-field cms-image" });
    function draw() {
      box.textContent = "";
      var src = obj[f.k] || "";
      box.appendChild(h("label", { for: id, text: f.label }));
      var prev = h("div", { class: "cms-img-prev" + (src ? "" : " empty") });
      if (src) {
        var img = h("img", { src: src, alt: "" });
        prev.appendChild(img);
        if (f.focus) {
          var dot = h("span", { class: "cms-focus", "aria-hidden": "true" });
          dot.style.left = (obj.focusX == null ? 50 : obj.focusX) + "%"; dot.style.top = (obj.focusY == null ? 50 : obj.focusY) + "%";
          prev.appendChild(dot); prev.classList.add("can-focus"); prev.title = "Click to set the focus point";
          prev.addEventListener("click", function (e) {
            var r = img.getBoundingClientRect();
            obj.focusX = Math.round(Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)));
            obj.focusY = Math.round(Math.min(100, Math.max(0, (e.clientY - r.top) / r.height * 100)));
            dot.style.left = obj.focusX + "%"; dot.style.top = obj.focusY + "%"; onChange();
          });
        }
      } else prev.appendChild(h("span", { text: "No image" }));
      box.appendChild(prev);
      var file = h("input", { type: "file", id: id, accept: "image/jpeg,image/png,image/webp", class: "cms-file" });
      var status = h("span", { class: "cms-help" });
      file.addEventListener("change", function () {
        var fl = file.files[0]; if (!fl) return;
        status.textContent = "Preparing image…";
        upload(fl).then(function (path) { obj[f.k] = path; onChange(); draw(); toast("Image added"); })
          .catch(function (err) { status.textContent = err.message; status.classList.add("cms-err"); });
      });
      box.appendChild(h("div", { class: "cms-img-actions" }, [
        h("label", { class: "cms-btn cms-ghost", for: id, text: src ? "Replace" : "Upload" }), file,
        h("button", { type: "button", class: "cms-btn cms-ghost", onclick: function () { pickFromLibrary(function (p) { obj[f.k] = p; onChange(); draw(); }); }, text: "Library" }),
        src ? h("button", { type: "button", class: "cms-btn cms-ghost danger", onclick: function () { obj[f.k] = ""; onChange(); draw(); }, text: "Remove" }) : null
      ]));
      box.appendChild(status);
      if (f.help) box.appendChild(h("p", { class: "cms-help", text: f.help }));
    }
    draw();
    return box;
  }
  /* Shrink large photos in the browser before upload: faster uploads, faster site. */
  function prepare(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error("Use a JPG, PNG or WebP image.")); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, hh = img.naturalHeight, s = Math.min(1, maxSide / Math.max(w, hh));
        if (s === 1 && file.size < 1.5e6) { URL.revokeObjectURL(url); resolve(file); return; }
        var c = document.createElement("canvas"); c.width = Math.round(w * s); c.height = Math.round(hh * s);
        var ctx = c.getContext("2d");
        var keepPng = file.type === "image/png" && file.size < 3e6;
        if (!keepPng) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b) { reject(new Error("This image could not be processed.")); return; }
          var name = file.name.replace(/\.[^.]+$/, "") + (keepPng ? ".png" : ".jpg");
          resolve(new File([b], name, { type: keepPng ? "image/png" : "image/jpeg" }));
        }, keepPng ? "image/png" : "image/jpeg", quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("This file is not a readable image.")); };
      img.src = url;
    });
  }
  function upload(file) {
    if (state.mode === "demo") {
      return prepare(file, 1400, 0.8).then(function (f) {
        return new Promise(function (resolve) { var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.readAsDataURL(f); });
      });
    }
    return prepare(file, 2400, 0.86).then(function (f) {
      var fd = new FormData(); fd.append("file", f, f.name);
      return api("upload.php", { body: fd }).then(function (d) { return d.path; });
    });
  }
  function pickFromLibrary(onPick) {
    var dlg = h("div", { class: "cms-modal", role: "dialog", "aria-modal": "true", "aria-label": "Image library" });
    var grid = h("div", { class: "cms-lib" }, [h("p", { class: "cms-help", text: "Loading images…" })]);
    function closeDlg() { dlg.remove(); }
    dlg.appendChild(h("div", { class: "cms-modal-card" }, [
      h("div", { class: "cms-modal-head" }, [h("h2", { text: "Image library" }), h("button", { type: "button", class: "cms-btn cms-ghost", onclick: closeDlg, text: "Close" })]),
      grid
    ]));
    dlg.addEventListener("click", function (e) { if (e.target === dlg) closeDlg(); });
    root.appendChild(dlg);
    function show(paths) {
      grid.textContent = "";
      if (!paths.length) { grid.appendChild(h("p", { class: "cms-help", text: "No images yet. Upload one first." })); return; }
      paths.forEach(function (p) {
        grid.appendChild(h("button", { type: "button", class: "cms-lib-item", title: p.length > 80 ? "Uploaded image" : p, onclick: function () { onPick(p); closeDlg(); } }, [h("img", { src: p, alt: "", loading: "lazy" })]));
      });
    }
    var used = [];
    JSON.stringify(state.draft, function (k, v) { if (typeof v === "string" && /^(images|uploads)\/|^data:image\//.test(v) && used.indexOf(v) < 0) used.push(v); return v; });
    if (state.mode === "server") api("media.php").then(function (d) { var all = d.files.map(function (x) { return x.path; }); used.forEach(function (u) { if (all.indexOf(u) < 0) all.push(u); }); show(all); }, function () { show(used); });
    else show(used);
  }

  /* ------------------------------------------------------------ Save, revert, backups */
  function save() {
    if (!dirty()) return;
    var json = JSON.stringify(state.draft);
    if (state.mode === "demo") {
      if (lsSet(DRAFT_KEY, json)) { state.saved = json; setStatus(); toast("Saved in this browser. Connect the server to publish for visitors."); }
      else toast("This browser is out of storage. Remove some uploaded images and try again.", "bad");
      return;
    }
    saveBtn.disabled = true; saveBtn.textContent = "Publishing…";
    api("content.php", { json: state.draft })
      .then(function () { state.saved = json; setStatus(); toast("Published. Visitors now see the new version."); })
      .catch(function (err) {
        setStatus();
        if (err.status === 401) { toast("Your session ended. Sign in again, then publish.", "bad"); authScreen("login"); }
        else toast(err.message === "no-api" ? "The server did not respond. Your changes are still here; try again." : err.message, "bad");
      });
  }
  function revert() {
    state.draft = JSON.parse(state.saved); Site.render(clone(state.draft)); showView(state.section); setStatus(); toast("Unsaved changes undone");
  }
  function clearDemo() {
    lsDel(DRAFT_KEY); state.draft = clone(window.SITE_CONTENT); state.saved = JSON.stringify(state.draft);
    Site.render(clone(state.draft)); showView(state.section); setStatus(); toast("Demo changes cleared");
  }
  function exportJson() {
    try {
      var blob = new Blob([JSON.stringify(state.draft, null, 2)], { type: "application/json" });
      var a = h("a", { href: URL.createObjectURL(blob), download: "site-content-" + new Date().toISOString().slice(0, 10) + ".json" });
      document.body.appendChild(a); a.click(); a.remove();
      toast("Backup downloaded");
    } catch (e) { toast("Download is not available here.", "bad"); }
  }
  function importJson() {
    var inp = h("input", { type: "file", accept: "application/json,.json" });
    inp.addEventListener("change", function () {
      var f = inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          if (!d || !d.site || !d.hero || !d.work) throw new Error("bad");
          state.draft = d; Site.render(clone(d)); showView(state.section); setStatus();
          toast("Backup loaded. Check the page, then " + (state.mode === "demo" ? "save." : "publish."));
        } catch (e) { toast("That file is not a backup from this editor.", "bad"); }
      };
      r.readAsText(f);
    });
    inp.click();
  }

  /* ------------------------------------------------------------ Enquiries + password */
  function renderEnquiries() {
    body.appendChild(h("div", { class: "cms-head" }, [h("h2", { text: "Enquiries" }), h("p", { class: "cms-help", text: "Bookings sent from the form on your website, newest first. Each one is also emailed to " + (state.draft.site.email || "your email address") + "." })]));
    var list = h("div", { class: "cms-inbox" }, [h("p", { class: "cms-help", text: "Loading…" })]);
    body.appendChild(list);
    api("enquiries.php").then(function (d) {
      list.textContent = "";
      if (!d.items.length) { list.appendChild(h("p", { class: "cms-empty", text: "No enquiries yet. They will appear here when someone uses the booking form." })); return; }
      d.items.forEach(function (q) {
        var rows = [["Service", q.service], ["Date", q.date], ["Location", q.location], ["Budget", q.budget], ["Phone", q.phone], ["Email", q.email]].filter(function (r) { return r[1]; });
        var card = h("article", { class: "cms-enq" }, [
          h("div", { class: "cms-enq-head" }, [h("b", { text: q.name }), h("span", { text: new Date(q.received * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })]),
          h("dl", null, rows.map(function (r) { return h("div", null, [h("dt", { text: r[0] }), h("dd", { text: r[1] })]); })),
          q.message ? h("p", { class: "cms-enq-msg", text: q.message }) : null,
          h("div", { class: "cms-enq-actions" }, [
            q.phone ? h("a", { class: "cms-btn cms-ghost", href: "https://wa.me/" + String(q.phone).replace(/[^\d]/g, "").replace(/^0/, "260"), target: "_blank", rel: "noopener", text: "WhatsApp" }) : null,
            deleteBtn(function () { api("enquiries.php", { json: { action: "delete", id: q.id } }).then(function () { card.remove(); toast("Enquiry deleted"); }, function (e) { toast(e.message, "bad"); }); })
          ])
        ]);
        list.appendChild(card);
      });
    }, function (e) { list.textContent = ""; list.appendChild(h("p", { class: "cms-err", text: e.status === 401 ? "Your session ended. Sign in again." : "Could not load enquiries." })); });
  }
  function renderPassword() {
    var cur = h("input", { type: "password", id: "cms-cur", autocomplete: "current-password" });
    var nw = h("input", { type: "password", id: "cms-new", autocomplete: "new-password", minlength: 10 });
    var msg = h("p", { class: "cms-err", role: "alert" });
    var form = h("form", { class: "cms-auth" }, [h("h2", { text: "Change password" }),
      h("label", { for: "cms-cur", text: "Current password" }), cur, h("label", { for: "cms-new", text: "New password (10+ characters)" }), nw, msg,
      h("button", { type: "submit", class: "cms-btn cms-primary cms-wide", text: "Change password" })]);
    form.addEventListener("submit", function (e) {
      e.preventDefault(); msg.textContent = "";
      if (nw.value.length < 10) { msg.textContent = "Use at least 10 characters."; return; }
      api("auth.php", { json: { action: "password", current: cur.value, password: nw.value } })
        .then(function () { toast("Password changed"); showView("site"); }, function (err) { msg.textContent = err.message; });
    });
    body.appendChild(form);
  }

  /* ------------------------------------------------------------ Open / close */
  function open() {
    if (!root) build();
    document.documentElement.classList.add("cms-open");
    setCollapsed(false);
    if (state.mode !== "checking" && state.draft) { setStatus(); return; }
    api("auth.php").then(function (d) {
      state.mode = "server"; state.csrf = d.csrf || "";
      if (d.setup_needed) authScreen("setup");
      else if (!d.logged_in) authScreen("login");
      else startEditor();
    }).catch(function () {
      state.mode = "demo";
      root.insertBefore(h("div", { class: "cms-banner" }, [h("b", { text: "Demo mode. " }), "No server found, so changes stay in this browser. On PHP hosting this panel signs in and publishes for every visitor."]), navEl);
      startEditor();
    });
  }
  function close() {
    if (dirty() && state.mode === "server") toast("You have unpublished changes. They stay in the editor until you publish or reload.", "bad");
    document.documentElement.classList.remove("cms-open", "cms-collapsed");
    if (location.hash === "#admin") history.replaceState(null, "", location.pathname + location.search);
  }
  window.CMS = { open: open, close: close };
})();
