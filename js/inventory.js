(function () {
  const state = {
    session: null,
    items: [],
    search: "",
    categoryFilter: "All",
    pendingDeleteId: null
  };

  const elements = {
    sessionInfo: document.getElementById("sessionInfo"),
    dataModeBadge: document.getElementById("dataModeBadge"),
    addItemPanel: document.getElementById("addItemPanel"),
    inventoryTablePanel: document.getElementById("inventoryTablePanel"),
    roleBadge: document.getElementById("roleBadge"),
    addItemForm: document.getElementById("addItemForm"),
    itemName: document.getElementById("itemName"),
    itemQuantity: document.getElementById("itemQuantity"),
    itemCategory: document.getElementById("itemCategory"),
    addBtn: document.getElementById("addBtn"),
    formMessage: document.getElementById("formMessage"),
    searchInput: document.getElementById("searchInput"),
    categoryFilter: document.getElementById("categoryFilter"),
    clearFilters: document.getElementById("clearFilters"),
    inventoryBody: document.getElementById("inventoryBody"),
    totalItems: document.getElementById("totalItems"),
    lowStockItems: document.getElementById("lowStockItems"),
    categoryCount: document.getElementById("categoryCount"),
    deleteModal: document.getElementById("deleteModal"),
    confirmDelete: document.getElementById("confirmDelete"),
    cancelDelete: document.getElementById("cancelDelete"),
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

  function setMessage(type, text) {
    elements.formMessage.className = "rounded-xl px-3 py-2 text-sm";

    if (!text) {
      elements.formMessage.classList.add("hidden");
      elements.formMessage.textContent = "";
      return;
    }

    if (type === "error") {
      elements.formMessage.classList.add("bg-red-50", "text-red-700", "dark:bg-red-900/30", "dark:text-red-100");
    } else {
      elements.formMessage.classList.add("bg-emerald-50", "text-emerald-700", "dark:bg-emerald-900/30", "dark:text-emerald-100");
    }

    elements.formMessage.textContent = text;
  }

  function isAdmin() {
    return state.session && state.session.role === "admin";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function generateItemId(category) {
    const prefixMap = {
      Fuel: "F",
      Tools: "T",
      "Spare Parts": "S",
      Equipment: "E"
    };

    const prefix = prefixMap[category] || "X";
    const maxSuffix = state.items
      .filter((item) => item.id.startsWith(prefix))
      .map((item) => Number(item.id.slice(1)))
      .filter((num) => Number.isFinite(num))
      .reduce((max, current) => Math.max(max, current), 0);

    return prefix + String(maxSuffix + 1).padStart(3, "0");
  }

  function filteredItems() {
    return state.items
      .filter((item) => {
        if (state.categoryFilter !== "All" && item.category !== state.categoryFilter) {
          return false;
        }

        if (state.search && !item.name.toLowerCase().includes(state.search.toLowerCase()) && !item.id.toLowerCase().includes(state.search.toLowerCase())) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function updateSummaryCards() {
    const stats = await window.InventoryAuth.getStats();
    elements.totalItems.textContent = String(stats.totalItems);
    elements.lowStockItems.textContent = String(stats.lowStockItems);
    elements.categoryCount.textContent = String(stats.categoryCount);
  }

  function lowStockBadge(quantity) {
    if (quantity <= window.InventoryAuth.LOW_STOCK_THRESHOLD) {
      return "<span class=\"rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/35 dark:text-red-100\">Low: " + quantity + "</span>";
    }

    return "<span class=\"rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-100\">" + quantity + "</span>";
  }

  function actionButtons(item) {
    if (!isAdmin()) {
      return "<span class=\"rounded-full bg-quarry-100 px-2 py-1 text-xs font-semibold uppercase text-quarry-700 dark:bg-white/10 dark:text-quarry-100\">View only</span>";
    }

    return "<div class=\"flex items-center gap-2\">" +
      "<input data-qty-input=\"" + escapeHtml(item.id) + "\" type=\"number\" min=\"0\" value=\"" + item.quantity + "\" class=\"w-20 rounded-lg border border-quarry-200 bg-white px-2 py-1 text-xs outline-none focus:border-copper-500 dark:border-white/20 dark:bg-white/5\" />" +
      "<button data-action=\"edit\" data-id=\"" + escapeHtml(item.id) + "\" class=\"rounded-lg bg-quarry-900 px-2 py-1 text-xs font-semibold text-white hover:bg-quarry-700 dark:bg-copper-500 dark:hover:bg-copper-700\">Edit</button>" +
      "<button data-action=\"delete\" data-id=\"" + escapeHtml(item.id) + "\" class=\"rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700\">Delete</button>" +
    "</div>";
  }

  async function renderTable() {
    const rows = filteredItems();

    if (rows.length === 0) {
      elements.inventoryBody.innerHTML = "<tr><td colspan=\"6\" class=\"px-3 py-6 text-center text-quarry-500 dark:text-quarry-200\">No items match your filters.</td></tr>";
      await updateSummaryCards();
      return;
    }

    elements.inventoryBody.innerHTML = rows
      .map((item) => {
        return "<tr class=\"border-t border-quarry-100 dark:border-white/10\">" +
          "<td class=\"px-3 py-3 font-semibold\">" + escapeHtml(item.id) + "</td>" +
          "<td class=\"px-3 py-3\">" + escapeHtml(item.name) + "</td>" +
          "<td class=\"px-3 py-3\">" + escapeHtml(item.category) + "</td>" +
          "<td class=\"px-3 py-3\">" + lowStockBadge(item.quantity) + "</td>" +
          "<td class=\"px-3 py-3\">" + window.InventoryAuth.formatDate(item.dateAdded) + "</td>" +
          "<td class=\"px-3 py-3\">" + actionButtons(item) + "</td>" +
        "</tr>";
      })
      .join("");

    await updateSummaryCards();
  }

  async function addItem() {
    if (!isAdmin()) {
      setMessage("error", "Worker role has view-only access.");
      return;
    }

    const name = elements.itemName.value.trim();
    const category = elements.itemCategory.value;
    const quantity = Number(elements.itemQuantity.value);

    if (!name || !category || elements.itemQuantity.value === "") {
      setMessage("error", "Please complete all fields.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      setMessage("error", "Quantity must be a non-negative whole number.");
      return;
    }

    const item = {
      id: generateItemId(category),
      name,
      quantity,
      category,
      dateAdded: new Date().toISOString()
    };

    try {
      state.items.push(item);
      state.items = await window.InventoryAuth.setInventory(state.items);
      await renderTable();
      elements.addItemForm.reset();
      setMessage("success", "Item added successfully with ID " + item.id + ".");
    } catch (error) {
      setMessage("error", error.message || "Unable to add item.");
    }
  }

  async function editItem(itemId, newQuantity) {
    if (!isAdmin()) {
      setMessage("error", "Worker role has view-only access.");
      return;
    }

    const quantity = Number(newQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setMessage("error", "Updated quantity must be a non-negative whole number.");
      return;
    }

    const target = state.items.find((item) => item.id === itemId);
    if (!target) {
      setMessage("error", "Item not found.");
      return;
    }

    try {
      target.quantity = quantity;
      state.items = await window.InventoryAuth.setInventory(state.items);
      await renderTable();
      setMessage("success", "Item quantity updated.");
    } catch (error) {
      setMessage("error", error.message || "Unable to update item.");
    }
  }

  async function deleteItem(itemId) {
    if (!isAdmin()) {
      setMessage("error", "Worker role has view-only access.");
      return;
    }

    const beforeCount = state.items.length;
    state.items = state.items.filter((item) => item.id !== itemId);

    if (state.items.length === beforeCount) {
      setMessage("error", "Item not found.");
      return;
    }

    try {
      state.items = await window.InventoryAuth.setInventory(state.items);
      await renderTable();
      setMessage("success", "Item deleted successfully.");
    } catch (error) {
      setMessage("error", error.message || "Unable to delete item.");
    }
  }

  function openDeleteModal(itemId) {
    state.pendingDeleteId = itemId;
    elements.deleteModal.classList.remove("hidden");
    elements.deleteModal.classList.add("flex");
  }

  function closeDeleteModal() {
    state.pendingDeleteId = null;
    elements.deleteModal.classList.add("hidden");
    elements.deleteModal.classList.remove("flex");
  }

  function applyRolePermissions() {
    if (isAdmin()) {
      elements.addItemPanel.classList.remove("hidden");
      elements.inventoryTablePanel.classList.remove("lg:col-span-5");
      elements.inventoryTablePanel.classList.add("lg:col-span-3");
      elements.roleBadge.textContent = "Admin";
      elements.roleBadge.classList.add("bg-emerald-100", "text-emerald-700", "dark:bg-emerald-900/35", "dark:text-emerald-100");
      setMessage("", "");
      return;
    }

    elements.addItemPanel.classList.add("hidden");
    elements.inventoryTablePanel.classList.remove("lg:col-span-3");
    elements.inventoryTablePanel.classList.add("lg:col-span-5");
    elements.roleBadge.textContent = "Worker";
    elements.roleBadge.classList.add("bg-quarry-100", "text-quarry-700", "dark:bg-white/10", "dark:text-quarry-100");

    elements.itemName.disabled = true;
    elements.itemQuantity.disabled = true;
    elements.itemCategory.disabled = true;
    elements.addBtn.disabled = true;

    setMessage("", "");
  }

  function updateThemeButtonLabel() {
    const isDark = document.documentElement.classList.contains("dark");
    elements.themeToggle.textContent = isDark ? "Light" : "Dark";
  }

  function handleTableActions(event) {
    const action = event.target.getAttribute("data-action");
    const itemId = event.target.getAttribute("data-id");

    if (!action || !itemId) {
      return;
    }

    if (action === "edit") {
      const input = document.querySelector("input[data-qty-input='" + itemId + "']");
      if (!input) {
        setMessage("error", "Quantity input missing.");
        return;
      }

      void editItem(itemId, input.value);
    }

    if (action === "delete") {
      openDeleteModal(itemId);
    }
  }

  function bindEvents() {
    elements.addItemForm.addEventListener("submit", function (event) {
      event.preventDefault();
      void addItem();
    });

    elements.searchInput.addEventListener("input", function (event) {
      state.search = event.target.value.trim();
      void renderTable();
    });

    elements.categoryFilter.addEventListener("change", function (event) {
      state.categoryFilter = event.target.value;
      void renderTable();
    });

    elements.clearFilters.addEventListener("click", function () {
      state.search = "";
      state.categoryFilter = "All";
      elements.searchInput.value = "";
      elements.categoryFilter.value = "All";
      void renderTable();
    });

    elements.inventoryBody.addEventListener("click", handleTableActions);

    elements.cancelDelete.addEventListener("click", closeDeleteModal);
    elements.confirmDelete.addEventListener("click", function () {
      if (state.pendingDeleteId) {
        void deleteItem(state.pendingDeleteId);
      }
      closeDeleteModal();
    });

    elements.deleteModal.addEventListener("click", function (event) {
      if (event.target === elements.deleteModal) {
        closeDeleteModal();
      }
    });

    elements.themeToggle.addEventListener("click", function () {
      window.InventoryAuth.toggleTheme();
      updateThemeButtonLabel();
    });

    function logout() {
      window.InventoryAuth.logoutUser();
      window.location.href = "index.html";
    }

    elements.logoutBtn.addEventListener("click", logout);
    elements.logoutBtnSidebar.addEventListener("click", logout);
  }

  async function init() {
    state.session = window.InventoryAuth.requireAuth();
    if (!state.session) {
      return;
    }

    try {
      state.items = await window.InventoryAuth.getInventory();
      elements.sessionInfo.textContent = "Signed in as " + state.session.username + " (" + state.session.role + ")";
      renderDataModeBadge();
      updateThemeButtonLabel();
      applyRolePermissions();
      bindEvents();
      await renderTable();
    } catch (error) {
      setMessage("error", error.message || "Unable to load inventory data.");
    }
  }

  window.InventoryModule = {
    addItem,
    editItem,
    deleteItem,
    renderTable
  };

  document.addEventListener("DOMContentLoaded", function () {
    void init();
  });
})();
