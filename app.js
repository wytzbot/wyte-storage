/* =========================================================
   WYTE VAULT — core app shell
   Local-first: everything lives in localStorage.
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "wyte_vault_items_v1";

  const CATEGORY_META = {
    purchase:     { icon: "🧾", label: "Purchase",     nameLabel: "Product name",  dateLabel: "Purchase date" },
    warranty:     { icon: "🛡️", label: "Warranty",     nameLabel: "Product",       dateLabel: "Expiration date" },
    return:       { icon: "📦", label: "Return",       nameLabel: "Product",       dateLabel: "Return deadline" },
    subscription: { icon: "💳", label: "Subscription", nameLabel: "Service name",  dateLabel: "Next renewal date" },
    document:     { icon: "📄", label: "Document",     nameLabel: "Document name", dateLabel: "Expiration date" },
    reminder:     { icon: "📅", label: "Reminder",     nameLabel: "What is it?",   dateLabel: "Date" }
  };

  /* ---------------- State ---------------- */
  let items = loadItems();
  let currentFilter = "all";
  let currentSearch = "";
  let pendingCategory = null;
  let detailItemId = null;
  let pendingAttachment = null;

  const SETTINGS_KEY = "wyte_vault_settings_v1";
  const DEFAULT_SETTINGS = {
    appearance: "system",
    notifStyle: "funny",
    notifPrefs: { expiry: true, subscription: true, warranty: true, return: true, document: true, weekly: false },
    defaultSort: "soonest",
    confirmDelete: true,
    plan: "free",
    onboardingComplete: false,
    lastBackupAt: null,
    pushNotifCount: 0
  };
  let settings = loadSettings();

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)) : Object.assign({}, DEFAULT_SETTINGS);
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : seedData();
    } catch (e) {
      return seedData();
    }
  }

  function saveItems() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function seedData() {
    // A couple of example items so the shell isn't empty on first run.
    const today = new Date();
    const inDays = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    return [
      { id: uid(), category: "warranty", name: "Samsung TV", org: "Samsung", price: null, date: inDays(14), notes: "", archived: false, completed: false, createdAt: Date.now() },
      { id: uid(), category: "subscription", name: "Netflix", org: "", price: 4500, frequency: "monthly", date: inDays(3), notes: "", archived: false, completed: false, createdAt: Date.now() },
      { id: uid(), category: "return", name: "Nike shoes", org: "Nike", price: 32000, date: inDays(1), notes: "", archived: false, completed: false, createdAt: Date.now() },
      { id: uid(), category: "document", name: "Passport", org: "", price: null, date: inDays(240), notes: "", archived: false, completed: false, createdAt: Date.now() }
    ];
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  /* ---------------- Date / priority helpers ---------------- */
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + "T00:00:00");
    return Math.round((target - today) / 86400000);
  }

  function priorityFor(dateStr) {
    const d = daysUntil(dateStr);
    if (d === null) return "unknown";
    if (d < 0) return "urgent";
    if (d <= 7) return "urgent";
    if (d <= 30) return "soon";
    if (d <= 90) return "upcoming";
    return "safe";
  }

  function priorityLabel(dateStr) {
    const d = daysUntil(dateStr);
    if (d === null) return "No date";
    if (d < 0) return `Expired ${Math.abs(d)}d ago`;
    if (d === 0) return "Today";
    if (d === 1) return "Tomorrow";
    if (d < 60) return `${d}d left`;
    const months = Math.round(d / 30);
    return `${months}mo left`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function longCountdown(dateStr) {
    const d = daysUntil(dateStr);
    if (d === null) return "No date set";
    if (d < 0) return `Expired ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago`;
    if (d === 0) return "Expires today";
    if (d === 1) return "Expires tomorrow";
    if (d < 90) return `Expires in ${d} days`;
    const months = Math.round(d / 30);
    return `Expires in ${months} month${months === 1 ? "" : "s"}`;
  }

  /* ---------------- Rendering: Home ---------------- */
  function renderHome() {
    renderPlanCard();
    const active = items.filter((it) => !it.archived && !it.completed);
    const counts = { safe: 0, upcoming: 0, soon: 0, urgent: 0, unknown: 0 };
    active.forEach((it) => counts[priorityFor(it.date)]++);

    const summaryRow = document.getElementById("summary-row");
    summaryRow.innerHTML = `
      <div class="stat-card stat-card--safe"><span class="stat-card__num">${counts.safe + counts.upcoming}</span><span class="stat-card__label">safe</span></div>
      <div class="stat-card stat-card--soon"><span class="stat-card__num">${counts.soon}</span><span class="stat-card__label">coming up</span></div>
      <div class="stat-card stat-card--urgent"><span class="stat-card__num">${counts.urgent}</span><span class="stat-card__label">needs attention</span></div>
    `;

    const upcoming = active
      .filter((it) => it.date)
      .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
      .slice(0, 6);

    const list = document.getElementById("coming-up-list");
    if (upcoming.length === 0) {
      list.innerHTML = emptyStateHTML("🎉", "Nothing urgent", "Your future self is currently impressed.");
    } else {
      list.innerHTML = upcoming.map(itemCardHTML).join("");
    }
    bindItemCardClicks(list);
  }

  /* ---------------- Rendering: Vault list ---------------- */
  function renderVault() {
    let list = items.filter((it) => !it.completed);

    if (currentFilter === "archived") {
      list = list.filter((it) => it.archived);
    } else {
      list = list.filter((it) => !it.archived);
      if (currentFilter !== "all") {
        list = list.filter((it) => it.category === currentFilter);
      }
    }

    if (currentSearch.trim()) {
      const q = currentSearch.trim().toLowerCase();
      list = list.filter((it) =>
        [it.name, it.org, it.notes, CATEGORY_META[it.category]?.label]
          .filter(Boolean)
          .some((f) => f.toLowerCase().includes(q))
      );
    }

    list = list.slice().sort((a, b) => {
      const da = a.date ? daysUntil(a.date) : Infinity;
      const db = b.date ? daysUntil(b.date) : Infinity;
      return da - db;
    });

    const container = document.getElementById("vault-list");
    if (list.length === 0) {
      container.innerHTML = emptyStateHTML("🗂️", "Your vault is empty", "Add your first warranty, subscription, receipt or important document.", true);
    } else {
      container.innerHTML = list.map(itemCardHTML).join("");
    }
    bindItemCardClicks(container);

    const addBtn = container.querySelector("[data-empty-add]");
    if (addBtn) addBtn.addEventListener("click", openCategorySheet);
  }

  /* ---------------- Rendering: Alerts ---------------- */
  function renderAlerts() {
    const active = items.filter((it) => !it.archived && !it.completed && it.date);
    const alerts = active
      .filter((it) => ["urgent", "soon"].includes(priorityFor(it.date)))
      .sort((a, b) => daysUntil(a.date) - daysUntil(b.date));

    const container = document.getElementById("alerts-list");
    if (alerts.length === 0) {
      container.innerHTML = emptyStateHTML("🎉", "Nothing urgent", "Your future self is currently impressed.");
    } else {
      container.innerHTML = alerts.map(itemCardHTML).join("");
    }
    bindItemCardClicks(container);
  }

  /* ---------------- Timeline ---------------- */
  function renderTimeline() {
    const active = items.filter((it) => !it.archived && !it.completed && it.date);
    const sorted = active.slice().sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
    const container = document.getElementById("alerts-timeline");

    if (sorted.length === 0) {
      container.innerHTML = emptyStateHTML("📅", "Nothing on the timeline", "Items with a date will show up here, grouped by month.");
      return;
    }

    let html = "";
    let lastMonth = "";
    sorted.forEach((it) => {
      const d = new Date(it.date + "T00:00:00");
      const monthKey = d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
      if (monthKey !== lastMonth) {
        html += `<div class="timeline-month">${monthKey}</div>`;
        lastMonth = monthKey;
      }
      html += itemCardHTML(it);
    });
    container.innerHTML = html;
    bindItemCardClicks(container);
  }

  document.getElementById("alerts-mode-list").addEventListener("click", () => setAlertsMode("list"));
  document.getElementById("alerts-mode-timeline").addEventListener("click", () => setAlertsMode("timeline"));
  function setAlertsMode(mode) {
    document.getElementById("alerts-mode-list").classList.toggle("chip--active", mode === "list");
    document.getElementById("alerts-mode-timeline").classList.toggle("chip--active", mode === "timeline");
    document.getElementById("alerts-list").style.display = mode === "list" ? "" : "none";
    document.getElementById("alerts-timeline").style.display = mode === "timeline" ? "" : "none";
    if (mode === "timeline") renderTimeline();
  }

  /* ---------------- Card / empty-state markup ---------------- */
  function itemCardHTML(it) {
    const meta = CATEGORY_META[it.category] || CATEGORY_META.reminder;
    const pr = priorityFor(it.date);
    const subParts = [it.org, meta.label].filter(Boolean);
    return `
      <button class="item-card" data-item-id="${it.id}">
        <span class="item-card__icon">${meta.icon}</span>
        <span class="item-card__body">
          <span class="item-card__name">${escapeHTML(it.name)}</span>
          <span class="item-card__sub">${escapeHTML(subParts.join(" · "))}</span>
          <span class="item-card__date">${formatDate(it.date)}</span>
        </span>
        <span class="stamp stamp--${pr}">${priorityLabel(it.date)}</span>
      </button>
    `;
  }

  function emptyStateHTML(icon, title, body, withAddButton) {
    return `
      <div class="empty-state">
        <span class="empty-state__icon">${icon}</span>
        <p class="empty-state__title">${title}</p>
        <p class="empty-state__body">${body}</p>
        ${withAddButton ? `<button class="btn btn--primary" data-empty-add style="width:auto;padding:12px 22px;">Add something</button>` : ""}
      </div>
    `;
  }

  function bindItemCardClicks(container) {
    container.querySelectorAll("[data-item-id]").forEach((btn) => {
      btn.addEventListener("click", () => openDetail(btn.getAttribute("data-item-id")));
    });
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  /* ---------------- Navigation ---------------- */
  function switchView(name) {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("view--active", v.dataset.view === name));
    document.querySelectorAll(".nav-btn[data-nav]").forEach((b) => b.classList.toggle("nav-btn--active", b.dataset.nav === name));
    if (name === "home") renderHome();
    if (name === "vault") renderVault();
    if (name === "alerts") { renderAlerts(); setAlertsMode("list"); }
    if (name === "settings") { renderNotifSettings(); renderPlanCard(); }
  }

  document.querySelectorAll(".nav-btn[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.nav));
  });

  /* ---------------- Sheets ---------------- */
  function openSheet(id) {
    const dialog = document.getElementById(id);
    if (dialog.open) return;
    dialog.showModal();
  }
  function closeSheet(id) {
    const dialog = document.getElementById(id);
    if (dialog.open) dialog.close();
  }
  // Native browser behavior: Esc key closes a <dialog> automatically.
  // We add click-on-backdrop-to-dismiss, since that's not native either.
  document.querySelectorAll("dialog.sheet").forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      if (dialog.id === "sheet-ad" && !document.getElementById("ad-close-btn").classList.contains("is-ready")) return;
      dialog.close();
    });
    // Ad dialog: don't let Esc skip it early either.
    if (dialog.id === "sheet-ad") {
      dialog.addEventListener("cancel", (e) => {
        if (!document.getElementById("ad-close-btn").classList.contains("is-ready")) e.preventDefault();
      });
    }
  });
  document.querySelectorAll("[data-close-sheet]").forEach((btn) => {
    btn.addEventListener("click", () => closeSheet(btn.getAttribute("data-close-sheet")));
  });

  document.getElementById("nav-add-btn").addEventListener("click", openCategorySheet);
  function openCategorySheet() {
    openSheet("sheet-add-category");
  }

  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingCategory = btn.getAttribute("data-category");
      closeSheet("sheet-add-category");
      openAddForm(pendingCategory);
    });
  });

  /* ---------------- Add item form ---------------- */
  function openAddForm(category, prefill) {
    const meta = CATEGORY_META[category] || CATEGORY_META.reminder;
    document.getElementById("add-form-title").textContent = `Add ${meta.label.toLowerCase()}`;
    document.getElementById("field-label-name").textContent = meta.nameLabel;
    document.getElementById("field-label-date").textContent = meta.dateLabel;

    const showOrg = ["purchase", "warranty", "return"].includes(category);
    document.getElementById("field-wrap-org").style.display = showOrg ? "" : "none";
    document.getElementById("field-label-org").textContent = category === "warranty" ? "Warranty provider" : "Merchant / Store";

    const showPrice = ["purchase", "return", "subscription"].includes(category);
    document.getElementById("field-wrap-price").style.display = showPrice ? "" : "none";

    const showFreq = category === "subscription";
    document.getElementById("field-wrap-freq").style.display = showFreq ? "" : "none";

    const form = document.getElementById("add-item-form");
    form.reset();
    form.dataset.category = category;
    pendingAttachment = null;
    document.getElementById("attachment-preview").innerHTML = "";

    if (prefill) {
      if (prefill.name) document.getElementById("field-name").value = prefill.name;
      if (prefill.price != null) document.getElementById("field-price").value = prefill.price;
      if (prefill.date) document.getElementById("field-date").value = prefill.date;
      if (prefill.frequency) document.getElementById("field-frequency").value = prefill.frequency;
    }

    openSheet("sheet-add-form");
  }

  const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024; // keep localStorage usable

  document.getElementById("field-attachment").addEventListener("change", (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById("attachment-preview");
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      preview.innerHTML = `<div class="attachment-chip">File too large for local storage (max 1.5MB). <button type="button" id="attachment-clear-btn">Remove</button></div>`;
      e.target.value = "";
      pendingAttachment = null;
      bindAttachmentClear();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingAttachment = { name: file.name, type: file.type, size: file.size, dataUrl: reader.result };
      preview.innerHTML = `<div class="attachment-chip"><span>${escapeHTML(file.name)} · ${Math.round(file.size / 1024)}KB</span><button type="button" id="attachment-clear-btn">Remove</button></div>`;
      bindAttachmentClear();
    };
    reader.readAsDataURL(file);
  });

  function bindAttachmentClear() {
    const btn = document.getElementById("attachment-clear-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      pendingAttachment = null;
      document.getElementById("field-attachment").value = "";
      document.getElementById("attachment-preview").innerHTML = "";
    });
  }

  document.getElementById("add-item-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const category = form.dataset.category || "reminder";
    const newItem = {
      id: uid(),
      category,
      name: document.getElementById("field-name").value.trim(),
      org: document.getElementById("field-org").value.trim(),
      price: document.getElementById("field-price").value ? Number(document.getElementById("field-price").value) : null,
      frequency: document.getElementById("field-frequency").value,
      date: document.getElementById("field-date").value,
      notes: document.getElementById("field-notes").value.trim(),
      attachment: pendingAttachment,
      archived: false,
      completed: false,
      createdAt: Date.now()
    };
    try {
      items.push(newItem);
      saveItems();
    } catch (err) {
      items.pop();
      alert("Couldn't save — local storage is full. Try removing the attachment or freeing up space (Settings → Vault → Export, then clear old items).");
      return;
    }
    closeSheet("sheet-add-form");
    switchView("vault");
  });

  /* ---------------- Quick Add (local rule-based parsing) ---------------- */
  document.getElementById("quick-add-open-btn").addEventListener("click", () => {
    closeSheet("sheet-add-category");
    document.getElementById("quick-add-input").value = "";
    document.getElementById("quick-add-preview").innerHTML = "";
    openSheet("sheet-quick-add");
  });

  document.getElementById("quick-add-parse-btn").addEventListener("click", () => {
    const text = document.getElementById("quick-add-input").value.trim();
    const preview = document.getElementById("quick-add-preview");
    if (!text) {
      preview.innerHTML = `<p class="sheet__hint">Type something first.</p>`;
      return;
    }
    const parsed = parseQuickAdd(text);
    preview.innerHTML = `
      <div class="detail-rows" style="margin-top:10px;">
        <div class="detail-row"><span class="detail-row__label">Name</span><span>${escapeHTML(parsed.name || "—")}</span></div>
        <div class="detail-row"><span class="detail-row__label">Category</span><span>${CATEGORY_META[parsed.category].label}</span></div>
        <div class="detail-row"><span class="detail-row__label">Price</span><span>${parsed.price != null ? "₦" + parsed.price : "—"}</span></div>
        <div class="detail-row"><span class="detail-row__label">Date</span><span>${parsed.date ? formatDate(parsed.date) : "Not detected — you'll set it next"}</span></div>
      </div>
      <p class="sheet__hint">Nothing was invented — review and adjust on the next screen before saving.</p>
      <button class="btn btn--primary" id="quick-add-continue-btn" type="button">Looks good, continue</button>
    `;
    document.getElementById("quick-add-continue-btn").addEventListener("click", () => {
      closeSheet("sheet-quick-add");
      openAddForm(parsed.category, parsed);
    });
  });

  function parseQuickAdd(text) {
    const lower = text.toLowerCase();

    // Category guess
    let category = "reminder";
    if (/renew|subscription|per month|\/mo|monthly|yearly/.test(lower)) category = "subscription";
    else if (/warrant/.test(lower)) category = "warranty";
    else if (/return|refund/.test(lower)) category = "return";
    else if (/passport|licen[cs]e|visa|certificate|insurance/.test(lower)) category = "document";
    else if (/receipt|bought|purchase/.test(lower)) category = "purchase";

    // Price: ₦4500, $15.49, 4500 naira
    let price = null;
    const priceMatch = text.match(/[₦$€£]\s?([\d,]+(?:\.\d+)?)/) || text.match(/([\d,]+(?:\.\d+)?)\s?(?:naira|ngn)/i);
    if (priceMatch) price = Number(priceMatch[1].replace(/,/g, ""));

    // Frequency
    let frequency = "monthly";
    if (/yearly|\/yr|per year|annually/.test(lower)) frequency = "yearly";
    else if (/weekly|\/wk|per week/.test(lower)) frequency = "weekly";

    // Date: "on August 15", "on 15 August", or explicit yyyy-mm-dd
    let date = null;
    const monthNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    const monthDayMatch = lower.match(new RegExp(`(${monthNames.join("|")})\\s+(\\d{1,2})`));
    const dayMonthMatch = lower.match(new RegExp(`(\\d{1,2})\\s+(${monthNames.join("|")})`));

    if (isoMatch) {
      date = isoMatch[0];
    } else if (monthDayMatch) {
      date = buildDateFromMonthDay(monthNames.indexOf(monthDayMatch[1]), Number(monthDayMatch[2]));
    } else if (dayMonthMatch) {
      date = buildDateFromMonthDay(monthNames.indexOf(dayMonthMatch[2]), Number(dayMonthMatch[1]));
    }

    // Name: text before the first recognized keyword/price/date fragment
    let name = text
      .replace(priceMatch ? priceMatch[0] : "", "")
      .split(/\brenews?\b|\bon\b|\bevery\b/i)[0]
      .trim()
      .replace(/[-–,]+$/, "")
      .trim();
    if (!name) name = text.slice(0, 40);

    return { category, price, frequency, date, name };
  }

  function buildDateFromMonthDay(monthIndex, day) {
    if (monthIndex < 0 || !day) return null;
    const now = new Date();
    let year = now.getFullYear();
    let candidate = new Date(year, monthIndex, day);
    if (candidate < now) candidate = new Date(year + 1, monthIndex, day);
    return candidate.toISOString().slice(0, 10);
  }

  /* ---------------- Item detail ---------------- */
  function openDetail(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    detailItemId = id;
    const meta = CATEGORY_META[it.category] || CATEGORY_META.reminder;
    const rows = [];
    if (it.org) rows.push(["Merchant / Provider", it.org]);
    if (it.price != null) rows.push(["Price", "₦" + it.price.toLocaleString()]);
    if (it.category === "subscription" && it.frequency) rows.push(["Billing", it.frequency]);
    rows.push(["Date", formatDate(it.date)]);
    if (it.notes) rows.push(["Notes", it.notes]);
    if (it.attachment) rows.push(["Attachment", it.attachment.name]);

    document.getElementById("detail-content").innerHTML = `
      <div class="detail-header">
        <span class="detail-header__icon">${meta.icon}</span>
        <div>
          <h2 class="detail-title">${escapeHTML(it.name)}</h2>
          <p class="detail-countdown">${longCountdown(it.date)}</p>
        </div>
      </div>
      <div class="detail-rows">
        ${rows.map(([label, val]) => `<div class="detail-row"><span class="detail-row__label">${label}</span><span>${escapeHTML(val)}</span></div>`).join("")}
      </div>
      ${it.attachment ? `<button class="btn btn--ghost" id="detail-open-attachment" style="margin-bottom:10px;">Open attachment</button>` : ""}
      <div class="detail-actions">
        <button class="btn btn--ghost" data-action="complete">${it.completed ? "Mark active" : "Mark completed"}</button>
        <button class="btn btn--ghost" data-action="archive">${it.archived ? "Restore" : "Archive"}</button>
        <button class="btn btn--danger" data-action="delete">Delete</button>
        <button class="btn btn--ghost" data-close-sheet="sheet-detail">Close</button>
      </div>
    `;

    if (it.attachment) {
      document.getElementById("detail-open-attachment").addEventListener("click", () => {
        const w = window.open();
        if (w) w.document.write(`<iframe src="${it.attachment.dataUrl}" style="width:100%;height:100%;border:none;"></iframe>`);
      });
    }

    document.querySelector('[data-action="complete"]').addEventListener("click", () => {
      it.completed = !it.completed;
      saveItems();
      closeSheet("sheet-detail");
      refreshCurrentView();
    });
    document.querySelector('[data-action="archive"]').addEventListener("click", () => {
      it.archived = !it.archived;
      saveItems();
      closeSheet("sheet-detail");
      refreshCurrentView();
    });
    document.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (!confirm(`Delete "${it.name}" permanently? This can't be undone.`)) return;
      items = items.filter((x) => x.id !== it.id);
      saveItems();
      closeSheet("sheet-detail");
      refreshCurrentView();
    });

    openSheet("sheet-detail");
  }

  function refreshCurrentView() {
    const active = document.querySelector(".view--active");
    if (active) switchView(active.dataset.view);
  }

  /* ---------------- Vault filters & search ---------------- */
  document.getElementById("filter-row").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll("#filter-row .chip").forEach((c) => {
      c.classList.remove("chip--active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("chip--active");
    chip.setAttribute("aria-selected", "true");
    currentFilter = chip.getAttribute("data-filter");
    renderVault();
  });

  document.getElementById("search-input").addEventListener("input", (e) => {
    currentSearch = e.target.value;
    renderVault();
  });

  /* ---------------- Settings: appearance ---------------- */
  function applyAppearance() {
    const mode = settings.appearance;
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = mode === "dark" || (mode === "system" && prefersDark);
    document.documentElement.classList.toggle("theme-dark", dark);
    document.querySelectorAll("#appearance-segmented .segmented__btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.appearance === mode);
    });
  }
  document.querySelectorAll("#appearance-segmented .segmented__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.appearance = btn.dataset.appearance;
      saveSettings();
      applyAppearance();
    });
  });

  /* ---------------- Settings: notification prefs & style ---------------- */
  function renderNotifSettings() {
    document.querySelectorAll("[data-notif-pref]").forEach((cb) => {
      cb.checked = !!settings.notifPrefs[cb.getAttribute("data-notif-pref")];
    });
    document.querySelectorAll("#notif-style-segmented .segmented__btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.style === settings.notifStyle);
    });
    document.getElementById("setting-default-sort").value = settings.defaultSort;
    document.getElementById("setting-confirm-delete").checked = settings.confirmDelete;
    updateNotifPermissionStatus();
    updateNotifQuotaStatus();
  }

  function updateNotifQuotaStatus() {
    const el = document.getElementById("notif-quota-status");
    if (!el) return;
    if (settings.plan === "pro") {
      el.textContent = "Unlimited reminders (Pro)";
    } else {
      const remaining = Math.max(0, 5 - settings.pushNotifCount);
      el.textContent = remaining > 0
        ? `${remaining} of 5 free reminders left`
        : "Free reminders used up — upgrade to Pro for unlimited reminders";
    }
  }

  document.querySelectorAll("[data-notif-pref]").forEach((cb) => {
    cb.addEventListener("change", () => {
      settings.notifPrefs[cb.getAttribute("data-notif-pref")] = cb.checked;
      saveSettings();
    });
  });
  document.querySelectorAll("#notif-style-segmented .segmented__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.notifStyle = btn.dataset.style;
      saveSettings();
      renderNotifSettings();
    });
  });
  document.getElementById("setting-default-sort").addEventListener("change", (e) => {
    settings.defaultSort = e.target.value;
    saveSettings();
  });
  document.getElementById("setting-confirm-delete").addEventListener("change", (e) => {
    settings.confirmDelete = e.target.checked;
    saveSettings();
  });

  function updateNotifPermissionStatus() {
    const el = document.getElementById("notif-permission-status");
    if (!("Notification" in window)) {
      el.textContent = "Not supported here";
      return;
    }
    const map = { granted: "Enabled", denied: "Blocked — enable in browser settings", default: "Not enabled" };
    el.textContent = map[Notification.permission] || "Unknown";
  }

  /* ---------------- Notification quota: 5 free, then Pro-only ---------------- */
  function canSendPush() {
    return settings.plan === "pro" || settings.pushNotifCount < 5;
  }

  function sendPushNotification(title, body) {
    if (!canSendPush()) return false;
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    new Notification(title, { body });
    if (settings.plan !== "pro") {
      settings.pushNotifCount += 1;
      saveSettings();
      updateNotifQuotaStatus();
    }
    return true;
  }

  const NOTIF_COPY = {
    subscription: { funny: (n, d) => `💳 ${n} is about to collect rent again 😂 Renews ${d}.`, simple: (n, d) => `${n} renews ${d}.`, professional: (n, d) => `Reminder: ${n} renews ${d}.` },
    warranty: { funny: (n, d) => `🛡️ ${n}'s armor expires soon 😅 Warranty ends ${d}.`, simple: (n, d) => `${n} warranty ends ${d}.`, professional: (n, d) => `Reminder: ${n} warranty ends ${d}.` },
    return: { funny: (n, d) => `📦 Last call! Return window for ${n} closes ${d} 🚪`, simple: (n, d) => `${n} return window closes ${d}.`, professional: (n, d) => `Reminder: ${n} return deadline is ${d}.` },
    document: { funny: (n, d) => `📄 ${n} is quietly expiring ${d} 👀`, simple: (n, d) => `${n} expires ${d}.`, professional: (n, d) => `Reminder: ${n} expires ${d}.` },
    purchase: { funny: (n, d) => `🧾 ${n} wants you to remember it exists 😄`, simple: (n, d) => `${n} — check on this item.`, professional: (n, d) => `Reminder regarding ${n}.` },
    reminder: { funny: (n, d) => `📅 ${n} is coming up ${d} 👀`, simple: (n, d) => `${n} — ${d}.`, professional: (n, d) => `Reminder: ${n} is due ${d}.` }
  };

  function checkAndSendDueReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today = new Date().toISOString().slice(0, 10);
    const active = items.filter((it) => !it.archived && !it.completed && it.date);
    let changed = false;

    active.forEach((it) => {
      if (!settings.notifPrefs[it.category] && it.category !== "reminder") return;
      const d = daysUntil(it.date);
      if (d !== 0 && d !== 1) return;
      if (it.lastReminderSentOn === today) return;
      if (!canSendPush()) return; // quota hit — stop silently, Settings shows the upsell

      const copyFn = (NOTIF_COPY[it.category] || NOTIF_COPY.reminder)[settings.notifStyle] || NOTIF_COPY.reminder.simple;
      const whenText = d === 0 ? "today" : "tomorrow";
      sendPushNotification("WYTE Vault", copyFn(it.name, whenText));
      it.lastReminderSentOn = today;
      changed = true;
    });

    if (changed) saveItems();
  }

  function requestNotificationPermission() {
    if (!("Notification" in window)) {
      alert("This browser doesn't support notifications. Real device push requires wrapping this app with Median.co + OneSignal.");
      return;
    }
    if (Notification.permission === "denied") {
      alert("Notifications are blocked. Enable them for this site in your browser settings, then come back.");
      return;
    }
    if (window.WyteOneSignal && window.WyteOneSignal.isConfigured()) {
      // Goes through OneSignal so the browser also gets subscribed for real
      // web push, not just local permission.
      window.WyteOneSignal.requestPermission().then(() => {
        updateNotifPermissionStatus();
        checkAndSendDueReminders();
      });
      return;
    }
    Notification.requestPermission().then(() => {
      updateNotifPermissionStatus();
      checkAndSendDueReminders();
    });
  }
  document.getElementById("enable-notif-btn").addEventListener("click", requestNotificationPermission);
  document.getElementById("notif-permission-enable-btn").addEventListener("click", () => {
    closeSheet("sheet-notif-permission");
    requestNotificationPermission();
  });

  /* ---------------- Settings: export / import ---------------- */
  document.getElementById("export-vault-btn").addEventListener("click", () => {
    const payload = { exportedAt: new Date().toISOString(), items };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wyte-vault-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("import-vault-btn").addEventListener("click", () => {
    document.getElementById("import-vault-input").click();
  });
  document.getElementById("import-vault-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed) ? parsed : parsed.items;
        if (!Array.isArray(incoming)) throw new Error("bad format");
        const existingIds = new Set(items.map((i) => i.id));
        incoming.forEach((it) => {
          if (it && it.id && !existingIds.has(it.id)) items.push(it);
        });
        saveItems();
        refreshCurrentView();
        alert(`Imported ${incoming.length} item(s).`);
      } catch (err) {
        alert("That file doesn't look like a WYTE Vault export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  /* ---------------- Backup & Sync: Google sign-in only, manual Firestore hits ----------------
     No auto-sync anywhere: Firestore is only touched when the user taps
     "Back up now" or "Restore latest" — never on every item change,
     and the payload never includes attachment file data. */
  let fbAuth = null;
  let fbDb = null;
  try {
    if (window.firebase && window.WYTE_CONFIG && window.WYTE_CONFIG.FIREBASE.apiKey) {
      firebase.initializeApp(window.WYTE_CONFIG.FIREBASE);
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
    }
  } catch (e) {
    console.warn("Firebase unavailable — Backup & Sync stays hidden.", e);
  }
  if (!fbAuth) {
    const grp = document.getElementById("settings-group-sync");
    if (grp) grp.style.display = "none";
  }

  function renderSyncUI(user) {
    const out = document.getElementById("sync-signed-out");
    const inEl = document.getElementById("sync-signed-in");
    if (user) {
      out.style.display = "none";
      inEl.style.display = "";
      document.getElementById("sync-account-email").textContent = user.email || "Signed in";
      document.getElementById("sync-last-backup").textContent = settings.lastBackupAt
        ? `Last backed up ${new Date(settings.lastBackupAt).toLocaleString()}`
        : "Not backed up yet";
    } else {
      out.style.display = "";
      inEl.style.display = "none";
    }
  }

  if (fbAuth) {
    fbAuth.onAuthStateChanged((user) => renderSyncUI(user));

    document.getElementById("google-signin-btn").addEventListener("click", () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      fbAuth.signInWithPopup(provider).catch((err) => {
        alert("Sign-in didn't go through: " + err.message);
      });
    });
    document.getElementById("google-signout-btn").addEventListener("click", () => {
      fbAuth.signOut();
    });

    document.getElementById("backup-now-btn").addEventListener("click", () => {
      const user = fbAuth.currentUser;
      if (!user || !fbDb) return;
      // Strip attachment file data — only lightweight item metadata syncs.
      const lightItems = items.map((it) => {
        const copy = Object.assign({}, it);
        if (copy.attachment) copy.attachment = { name: copy.attachment.name, type: copy.attachment.type, size: copy.attachment.size };
        return copy;
      });
      fbDb.collection("vaults").doc(user.uid).set({
        items: lightItems,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        settings.lastBackupAt = Date.now();
        saveSettings();
        renderSyncUI(user);
        alert("Backed up.");
      }).catch((err) => alert("Backup failed: " + err.message));
    });

    document.getElementById("restore-backup-btn").addEventListener("click", () => {
      const user = fbAuth.currentUser;
      if (!user || !fbDb) return;
      fbDb.collection("vaults").doc(user.uid).get().then((doc) => {
        if (!doc.exists) {
          alert("No backup found for this account yet.");
          return;
        }
        const incoming = doc.data().items || [];
        const existingIds = new Set(items.map((i) => i.id));
        let added = 0;
        incoming.forEach((it) => {
          if (it && it.id && !existingIds.has(it.id)) {
            items.push(it);
            added++;
          }
        });
        saveItems();
        refreshCurrentView();
        alert(`Restored ${added} item(s) not already on this device.`);
      }).catch((err) => alert("Restore failed: " + err.message));
    });
  }

  /* ---------------- Settings: subscription / pricing ---------------- */
  function renderPlanCard() {
    const nameEl = document.querySelector("#plan-card .plan-card__name");
    const descEl = document.querySelector("#plan-card .plan-card__desc");
    const btn = document.getElementById("open-pricing-btn");
    const banner = document.getElementById("upgrade-banner");
    if (settings.plan === "pro") {
      nameEl.textContent = "WYTE Pro";
      descEl.textContent = "Unlimited items, no ads, advanced reminders.";
      btn.textContent = "Manage";
      if (banner) banner.style.display = "none";
    } else {
      nameEl.textContent = "Free plan";
      descEl.textContent = "Limited items, ads shown, basic reminders.";
      btn.textContent = "Upgrade";
      if (banner) banner.style.display = "";
    }
  }
  document.getElementById("open-pricing-btn").addEventListener("click", openPricingSheet);
  document.getElementById("home-upgrade-btn").addEventListener("click", openPricingSheet);

  let pricingSelectedPlan = null;

  function openPricingSheet() {
    pricingSelectedPlan = null;
    document.querySelectorAll(".pricing-card").forEach((c) => c.classList.remove("is-selected"));
    document.getElementById("pricing-email-wrap").style.display = "none";
    document.getElementById("pricing-continue-btn").disabled = true;
    const emailInput = document.getElementById("pricing-email");
    emailInput.value = (fbAuth && fbAuth.currentUser && fbAuth.currentUser.email) || "";
    openSheet("sheet-pricing");
  }

  document.querySelectorAll(".pricing-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".pricing-card").forEach((c) => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
      pricingSelectedPlan = card.getAttribute("data-plan");
      const isPro = pricingSelectedPlan === "pro";
      document.getElementById("pricing-email-wrap").style.display = isPro ? "" : "none";
      document.getElementById("pricing-continue-btn").disabled = !isPro; // selecting Free disables checkout
    });
  });

  document.getElementById("pricing-continue-btn").addEventListener("click", () => {
    if (pricingSelectedPlan !== "pro") return;
    const email = document.getElementById("pricing-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      alert("Enter a valid email to continue — Paystack needs it for the receipt.");
      return;
    }
    startPaystackCheckout(email);
  });

  function startPaystackCheckout(email) {
    const cfg = window.WYTE_CONFIG || {};
    const pricing = cfg.PRICING || {};
    const btn = document.getElementById("pricing-continue-btn");
    btn.disabled = true;
    btn.textContent = "Starting checkout…";

    fetch(cfg.PAYSTACK_INIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: Math.round((pricing.monthlyPrice || 0) * 100), // kobo
        currency: pricing.currency || "NGN"
      })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          alert("Couldn't start checkout: " + (data.message || "unknown error"));
          btn.disabled = false;
          btn.textContent = "Continue to Payment";
        }
      })
      .catch(() => {
        alert("Couldn't reach the checkout server. Check your connection and try again.");
        btn.disabled = false;
        btn.textContent = "Continue to Payment";
      });
  }

  /* ---------------- Ad interstitial (self-hosted cross-promo) ---------------- */
  const AD_URL = "https://wynote.vercel.app";
  const AD_SKIP_SECONDS = 10; // "10s or less" cap — clip itself is 11.4s, skip unlocks at 10

  function showAd() {
    if (settings.plan === "pro") return; // Pro removes ads entirely
    const video = document.getElementById("ad-video");
    const closeBtn = document.getElementById("ad-close-btn");
    const countEl = document.getElementById("ad-close-count");
    const fill = document.getElementById("ad-progress-fill");
    const wrap = document.querySelector(".ad-video-wrap");

    closeBtn.disabled = true;
    closeBtn.classList.remove("is-ready");
    video.currentTime = 0;
    video.muted = true;
    fill.style.width = "0%";
    const existingFallback = wrap.querySelector(".ad-fallback");
    if (existingFallback) existingFallback.remove();

    video.onerror = () => {
      const code = video.error ? video.error.code : "unknown";
      const codeNames = { 1: "MEDIA_ERR_ABORTED", 2: "MEDIA_ERR_NETWORK", 3: "MEDIA_ERR_DECODE", 4: "MEDIA_ERR_SRC_NOT_SUPPORTED" };
      console.warn("WYTE ad video failed to load:", codeNames[code] || code, "— check assets/ads/wynote-promo.mp4 is deployed and playable at that URL.");
      // Don't trap the user behind a locked countdown for a video that can't play.
      clearInterval(tick);
      closeBtn.disabled = false;
      closeBtn.classList.add("is-ready");
      const fallback = document.createElement("div");
      fallback.className = "ad-fallback";
      fallback.textContent = "Wynote";
      wrap.appendChild(fallback);
    };

    let remaining = AD_SKIP_SECONDS;
    countEl.textContent = remaining;
    const tick = setInterval(() => {
      remaining -= 1;
      fill.style.width = `${Math.min(100, ((AD_SKIP_SECONDS - remaining) / AD_SKIP_SECONDS) * 100)}%`;
      if (remaining <= 0) {
        clearInterval(tick);
        closeBtn.disabled = false;
        closeBtn.classList.add("is-ready");
      } else {
        countEl.textContent = remaining;
      }
    }, 1000);

    openSheet("sheet-ad");
    video.play().catch(() => {}); // autoplay can be blocked; skip timer still runs
  }

  document.getElementById("ad-close-btn").addEventListener("click", () => {
    if (!document.getElementById("ad-close-btn").classList.contains("is-ready")) return;
    document.getElementById("ad-video").pause();
    closeSheet("sheet-ad");
  });
  document.getElementById("ad-cta-btn").addEventListener("click", () => {
    window.open(AD_URL, "_blank", "noopener");
  });
  document.getElementById("ad-remove-ads-btn").addEventListener("click", () => {
    closeSheet("sheet-ad");
    openSheet("sheet-pricing");
  });

  function maybeShowAd() {
    if (settings.plan === "pro") return;
    showAd();
  }

  // Exit-intent ad: hooks the hardware/browser back button (what Median.co
  // and mobile browsers route through history.back()). First back press is
  // caught and shows the ad instead of leaving; once the ad's been shown,
  // subsequent back presses exit normally.
  let exitAdShown = false;
  function setupExitAdHook() {
    if (settings.plan === "pro") return;
    history.pushState({ wyteGuard: true }, "", location.href);
    window.addEventListener("popstate", () => {
      if (exitAdShown || settings.plan === "pro") return;
      exitAdShown = true;
      history.pushState({ wyteGuard: true }, "", location.href);
      showAd();
    });
  }

  /* ---------------- Clear data ---------------- */
  document.getElementById("clear-data-btn").addEventListener("click", () => {
    if (!confirm("This clears everything stored in this browser. Continue?")) return;
    items = [];
    saveItems();
    refreshCurrentView();
  });

  /* ---------------- Onboarding ---------------- */
  const ONBOARDING_SLIDES = [
    { icon: "◈", title: "Meet WYTE Vault", body: "WYTE remembers the things you don't." },
    { icon: "😅", title: "Never miss the boring stuff again", body: "Keep track of warranties, subscriptions, documents, returns and important dates." },
    { icon: "🔐", title: "Your information stays yours", body: "WYTE is designed to keep your personal vault private and local whenever possible." },
    { icon: "🔔", title: "Want useful reminders?", body: "WYTE can remind you when your warranty, subscription, return window or document needs attention." }
  ];
  let onboardingStep = 0;

  function renderOnboardingSlide() {
    const slide = ONBOARDING_SLIDES[onboardingStep];
    const isLast = onboardingStep === ONBOARDING_SLIDES.length - 1;
    document.getElementById("onboarding-slides").innerHTML = `
      <div class="onboarding-slide">
        <span class="onboarding-slide__icon">${slide.icon}</span>
        <h2 class="onboarding-slide__title">${slide.title}</h2>
        <p class="onboarding-slide__body">${slide.body}</p>
      </div>
      <div class="onboarding-dots">
        ${ONBOARDING_SLIDES.map((_, i) => `<span class="onboarding-dot ${i === onboardingStep ? "is-active" : ""}"></span>`).join("")}
      </div>
      <div class="onboarding-actions">
        <button class="btn btn--primary" id="onboarding-next-btn">${isLast ? "Enable Notifications" : "Next"}</button>
        <button class="btn btn--text btn--muted" id="onboarding-skip-btn">${isLast ? "Maybe later" : "Skip"}</button>
      </div>
    `;
    document.getElementById("onboarding-next-btn").addEventListener("click", () => {
      if (isLast) {
        finishOnboarding();
        requestNotificationPermission();
      } else {
        onboardingStep++;
        renderOnboardingSlide();
      }
    });
    document.getElementById("onboarding-skip-btn").addEventListener("click", finishOnboarding);
  }

  function finishOnboarding() {
    settings.onboardingComplete = true;
    saveSettings();
    closeSheet("sheet-onboarding");
    setTimeout(maybeShowAd, 600);
  }

  function maybeShowOnboarding() {
    if (!settings.onboardingComplete) {
      onboardingStep = 0;
      renderOnboardingSlide();
      openSheet("sheet-onboarding");
    }
  }

  /* ---------------- Pricing (from config.js) ---------------- */
  function applyPricingConfig() {
    const cfg = (window.WYTE_CONFIG || {}).PRICING;
    if (!cfg) return;
    const el = document.getElementById("pro-price");
    if (el) el.innerHTML = `${cfg.currencySymbol}${cfg.monthlyPrice.toLocaleString()}<span>/mo</span>`;
  }

  /* ---------------- Service worker ---------------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline caching is a nice-to-have, not required for the app to work */
      });
    });
  }

  /* ---------------- Init ---------------- */
  saveItems();
  applyAppearance();
  applyPricingConfig();
  if (window.WyteOneSignal) window.WyteOneSignal.init();
  renderHome();
  setupExitAdHook();
  if (settings.onboardingComplete) {
    setTimeout(maybeShowAd, 1200);
    checkAndSendDueReminders();
  } else {
    maybeShowOnboarding();
  }
})();
