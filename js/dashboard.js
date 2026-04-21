(function () {
  const elements = {
    sessionInfo: document.getElementById("sessionInfo"),
    dataModeBadge: document.getElementById("dataModeBadge"),
    totalItems: document.getElementById("totalItems"),
    lowStockItems: document.getElementById("lowStockItems"),
    categoryCount: document.getElementById("categoryCount"),
    recentItemsBody: document.getElementById("recentItemsBody"),
    stockAlerts: document.getElementById("stockAlerts"),
    logoutBtn: document.getElementById("logoutBtn"),
    logoutBtnSidebar: document.getElementById("logoutBtnSidebar"),
    themeToggle: document.getElementById("themeToggle")
  };

  function renderDataModeBadge() {
    if (!elements.dataModeBadge) {
      return;
    }

    const mode = window.InventoryAuth.getDataMode();
    elements.dataModeBadge.className = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]";

    if (mode === "supabase") {
      elements.dataModeBadge.classList.add("bg-sky-100", "text-sky-700", "dark:bg-sky-900/35", "dark:text-sky-100");
      elements.dataModeBadge.textContent = "Data Mode: Supabase";
      return;
    }

    elements.dataModeBadge.classList.add("bg-amber-100", "text-amber-700", "dark:bg-amber-900/35", "dark:text-amber-100");
    elements.dataModeBadge.textContent = "Data Mode: Local";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function badgeClass(quantity) {
    return quantity <= window.InventoryAuth.LOW_STOCK_THRESHOLD
      ? "rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/35 dark:text-red-100"
      : "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-100";
  }

  function renderRecentItems(items) {
    const sorted = [...items].sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    const latest = sorted.slice(0, 6);

    if (latest.length === 0) {
      elements.recentItemsBody.innerHTML = "<tr><td colspan=\"5\" class=\"px-3 py-6 text-center text-quarry-500 dark:text-quarry-200\">No inventory items yet.</td></tr>";
      return;
    }

    elements.recentItemsBody.innerHTML = latest
      .map((item) => {
        return "<tr class=\"border-t border-quarry-100 dark:border-white/10\">" +
          "<td class=\"px-3 py-3 font-semibold\">" + escapeHtml(item.id) + "</td>" +
          "<td class=\"px-3 py-3\">" + escapeHtml(item.name) + "</td>" +
          "<td class=\"px-3 py-3\">" + escapeHtml(item.category) + "</td>" +
          "<td class=\"px-3 py-3\"><span class=\"" + badgeClass(item.quantity) + "\">" + item.quantity + "</span></td>" +
          "<td class=\"px-3 py-3\">" + window.InventoryAuth.formatDate(item.dateAdded) + "</td>" +
        "</tr>";
      })
      .join("");
  }

  function renderAlerts(items) {
    const lowStock = items
      .filter((item) => item.quantity <= window.InventoryAuth.LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.quantity - b.quantity);

    if (lowStock.length === 0) {
      elements.stockAlerts.innerHTML = "<li class=\"rounded-xl bg-emerald-100 px-3 py-2 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100\">All stock levels are healthy.</li>";
      return;
    }

    elements.stockAlerts.innerHTML = lowStock
      .map((item) => {
        return "<li class=\"rounded-xl border border-copper-300/60 bg-copper-300/20 px-3 py-2 dark:border-copper-500/40 dark:bg-copper-500/10\">" +
          "<div class=\"flex items-center justify-between\">" +
            "<span class=\"font-semibold\">" + escapeHtml(item.name) + "</span>" +
            "<span class=\"text-xs font-semibold uppercase\">" + item.quantity + " left</span>" +
          "</div>" +
          "<p class=\"text-xs text-quarry-600 dark:text-quarry-200\">" + escapeHtml(item.category) + "</p>" +
        "</li>";
      })
      .join("");
  }

  async function renderDashboard() {
    const session = window.InventoryAuth.requireAuth();
    if (!session) {
      return;
    }

    const items = await window.InventoryAuth.getInventory();
    const stats = await window.InventoryAuth.getStats();

    elements.sessionInfo.textContent = "Signed in as " + session.username + " (" + session.role + ")";
    renderDataModeBadge();
    elements.totalItems.textContent = String(stats.totalItems);
    elements.lowStockItems.textContent = String(stats.lowStockItems);
    elements.categoryCount.textContent = String(stats.categoryCount);

    renderRecentItems(items);
    renderAlerts(items);
  }

  function updateThemeButtonLabel() {
    const isDark = document.documentElement.classList.contains("dark");
    elements.themeToggle.textContent = isDark ? "Light" : "Dark";
  }

  function handleLogout() {
    window.InventoryAuth.logoutUser();
    window.location.href = "index.html";
  }

  function bindEvents() {
    elements.logoutBtn.addEventListener("click", handleLogout);
    elements.logoutBtnSidebar.addEventListener("click", handleLogout);

    elements.themeToggle.addEventListener("click", function () {
      window.InventoryAuth.toggleTheme();
      updateThemeButtonLabel();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateThemeButtonLabel();
    bindEvents();
    void renderDashboard();
  });
})();
