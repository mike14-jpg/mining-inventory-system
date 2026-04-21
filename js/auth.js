(function () {
  const STORAGE_KEYS = {
    users: "mine_stock_users_v1",
    session: "mine_stock_session_v1",
    inventory: "mine_stock_inventory_v1",
    theme: "mine_stock_theme_v1"
  };

  const SUPABASE_TABLES = {
    users: "app_users",
    inventory: "inventory_items"
  };

  const LOW_STOCK_THRESHOLD = 10;
  const CATEGORY_LIST = ["Fuel", "Tools", "Spare Parts", "Equipment"];

  const DEMO_USERS = [
    { username: "admin", password: "1234", role: "admin" },
    { username: "worker", password: "1234", role: "worker" }
  ];

  const DEFAULT_ITEMS = [
    {
      id: "F001",
      name: "Diesel Fuel",
      quantity: 180,
      category: "Fuel",
      dateAdded: new Date().toISOString()
    },
    {
      id: "T001",
      name: "Hydraulic Wrench",
      quantity: 8,
      category: "Tools",
      dateAdded: new Date().toISOString()
    },
    {
      id: "S001",
      name: "Filter Cartridge",
      quantity: 42,
      category: "Spare Parts",
      dateAdded: new Date().toISOString()
    }
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isFetchError(error) {
    const message = String((error && error.message) || error || "").toLowerCase();
    return (
      message.indexOf("failed to fetch") !== -1 ||
      message.indexOf("fetch failed") !== -1 ||
      message.indexOf("networkerror") !== -1 ||
      message.indexOf("network request failed") !== -1 ||
      message.indexOf("load failed") !== -1
    );
  }

  function isRowLevelSecurityError(error) {
    const message = String((error && error.message) || error || "").toLowerCase();
    return message.indexOf("row-level security") !== -1 || message.indexOf("violates row-level security policy") !== -1;
  }

  function isInvalidCredentialsError(error) {
    const message = String((error && error.message) || error || "").toLowerCase();
    return message.indexOf("invalid login credentials") !== -1 || message.indexOf("invalid email or password") !== -1;
  }

  function isEmailRateLimitError(error) {
    const message = String((error && error.message) || error || "").toLowerCase();
    return (
      message.indexOf("email rate limit exceeded") !== -1 ||
      message.indexOf("over_email_send_rate_limit") !== -1 ||
      (message.indexOf("rate limit") !== -1 && message.indexOf("email") !== -1)
    );
  }

  function createSupabaseConnectionError() {
    return new Error("Unable to reach Supabase. Check internet access and Supabase URL/key, or login with local demo credentials (admin / worker). ");
  }

  function getSupabaseConfig() {
    const config = window.SUPABASE_CONFIG || {};
    return {
      url: String(config.url || "").trim(),
      anonKey: String(config.anonKey || "").trim()
    };
  }

  function isSupabaseConfigured() {
    const config = getSupabaseConfig();
    return Boolean(window.supabase && config.url && config.anonKey);
  }

  let supabaseClient = null;
  function getSupabaseClient() {
    if (!isSupabaseConfigured()) {
      return null;
    }

    if (supabaseClient) {
      return supabaseClient;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return null;
    }

    const config = getSupabaseConfig();
    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });

    return supabaseClient;
  }

  function safeRead(key, fallbackValue) {
    const raw = localStorage.getItem(key);

    if (raw === null || raw === undefined || raw === "") {
      localStorage.setItem(key, JSON.stringify(fallbackValue));
      return clone(fallbackValue);
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      localStorage.setItem(key, JSON.stringify(fallbackValue));
      return clone(fallbackValue);
    }
  }

  function safeWrite(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function seedStorage() {
    safeRead(STORAGE_KEYS.users, DEMO_USERS);
    safeRead(STORAGE_KEYS.inventory, DEFAULT_ITEMS);
  }

  function getUsersFromLocal() {
    const users = safeRead(STORAGE_KEYS.users, DEMO_USERS);
    if (!Array.isArray(users)) {
      safeWrite(STORAGE_KEYS.users, DEMO_USERS);
      return clone(DEMO_USERS);
    }

    const sanitized = users
      .map(function (entry) {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const username = String(entry.username || "").trim().toLowerCase();
        const password = String(entry.password || "");
        const role = normalizeRole(entry.role);

        if (!username || !password) {
          return null;
        }

        return {
          username,
          password,
          role
        };
      })
      .filter(Boolean);

    const missingDemoUsers = DEMO_USERS.filter(function (demoUser) {
      return sanitized.findIndex(function (entry) {
        return entry.username === demoUser.username;
      }) === -1;
    });

    const merged = sanitized.concat(clone(missingDemoUsers));
    safeWrite(STORAGE_KEYS.users, merged);
    return merged;
  }

  function upsertLocalUser(username, password, role) {
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const normalizedRole = normalizeRole(role);
    if (!normalizedUsername || !password) {
      return;
    }

    const users = getUsersFromLocal();
    const existingIndex = users.findIndex((entry) => String(entry.username || "").toLowerCase() === normalizedUsername);

    if (existingIndex >= 0) {
      users[existingIndex] = {
        username: normalizedUsername,
        password,
        role: normalizedRole
      };
    } else {
      users.push({
        username: normalizedUsername,
        password,
        role: normalizedRole
      });
    }

    safeWrite(STORAGE_KEYS.users, users);
  }

  function normalizeInventoryRecord(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const id = String(record.id || "").trim();
    const name = String(record.name || "").trim();
    const category = String(record.category || "").trim();
    const quantity = Number(record.quantity);
    let dateAdded = new Date().toISOString();
    if (record.dateAdded) {
      const parsedDate = new Date(record.dateAdded);
      if (!Number.isNaN(parsedDate.getTime())) {
        dateAdded = parsedDate.toISOString();
      }
    }

    if (!id || !name || !CATEGORY_LIST.includes(category) || !Number.isFinite(quantity) || quantity < 0) {
      return null;
    }

    return {
      id,
      name,
      category,
      quantity: Math.floor(quantity),
      dateAdded
    };
  }

  function getInventoryFromLocal() {
    const rawInventory = safeRead(STORAGE_KEYS.inventory, DEFAULT_ITEMS);

    if (!Array.isArray(rawInventory)) {
      safeWrite(STORAGE_KEYS.inventory, DEFAULT_ITEMS);
      return clone(DEFAULT_ITEMS);
    }

    const sanitized = rawInventory
      .map(normalizeInventoryRecord)
      .filter(Boolean);

    safeWrite(STORAGE_KEYS.inventory, sanitized);
    return sanitized;
  }

  function setInventoryToLocal(items) {
    if (!Array.isArray(items)) {
      throw new Error("Inventory data is invalid.");
    }

    const sanitized = items
      .map(normalizeInventoryRecord)
      .filter(Boolean);

    safeWrite(STORAGE_KEYS.inventory, sanitized);
    return sanitized;
  }

  function mapSupabaseInventoryRecord(record) {
    return normalizeInventoryRecord({
      id: record.id,
      name: record.name,
      quantity: record.quantity,
      category: record.category,
      dateAdded: record.date_added
    });
  }

  async function getUsersFromSupabase() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase client is not configured.");
    }

    const response = await client
      .from(SUPABASE_TABLES.users)
      .select("username,password,role")
      .order("username", { ascending: true });

    if (response.error) {
      throw new Error("Unable to load users from Supabase: " + response.error.message);
    }

    const users = (response.data || [])
      .filter((entry) => entry && entry.username && entry.password && (entry.role === "admin" || entry.role === "worker"))
      .map((entry) => ({
        username: String(entry.username),
        password: String(entry.password),
        role: String(entry.role)
      }));

    if (users.length > 0) {
      return users;
    }

    const seedResult = await client
      .from(SUPABASE_TABLES.users)
      .insert(clone(DEMO_USERS));

    if (seedResult.error) {
      throw new Error("Supabase users table is empty and could not be seeded: " + seedResult.error.message);
    }

    return clone(DEMO_USERS);
  }

  async function getInventoryFromSupabase() {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase client is not configured.");
    }

    const response = await client
      .from(SUPABASE_TABLES.inventory)
      .select("id,name,quantity,category,date_added")
      .order("name", { ascending: true });

    if (response.error) {
      throw new Error("Unable to load inventory from Supabase: " + response.error.message);
    }

    const sanitized = (response.data || [])
      .map(mapSupabaseInventoryRecord)
      .filter(Boolean);

    if (sanitized.length > 0) {
      return sanitized;
    }

    const defaultRows = DEFAULT_ITEMS.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      date_added: item.dateAdded
    }));

    const seedResult = await client
      .from(SUPABASE_TABLES.inventory)
      .insert(defaultRows);

    if (seedResult.error) {
      throw new Error("Supabase inventory table is empty and could not be seeded: " + seedResult.error.message);
    }

    return clone(DEFAULT_ITEMS);
  }

  async function setInventoryToSupabase(items) {
    if (!Array.isArray(items)) {
      throw new Error("Inventory data is invalid.");
    }

    const sanitized = items
      .map(normalizeInventoryRecord)
      .filter(Boolean);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase client is not configured.");
    }

    if (sanitized.length > 0) {
      const upsertRows = sanitized.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        date_added: item.dateAdded
      }));

      const upsertResult = await client
        .from(SUPABASE_TABLES.inventory)
        .upsert(upsertRows, { onConflict: "id" });

      if (upsertResult.error) {
        if (isRowLevelSecurityError(upsertResult.error)) {
          throw new Error("Supabase denied inventory write by RLS policy. Confirm you are logged in as an Admin account and re-run backend/supabase-schema.sql to refresh role policies.");
        }
        throw new Error("Unable to save inventory to Supabase: " + upsertResult.error.message);
      }
    }

    const existingResult = await client
      .from(SUPABASE_TABLES.inventory)
      .select("id");

    if (existingResult.error) {
      throw new Error("Unable to read current inventory from Supabase: " + existingResult.error.message);
    }

    const sanitizedIds = sanitized.map((item) => item.id);
    const staleIds = (existingResult.data || [])
      .map((record) => record.id)
      .filter((id) => sanitizedIds.indexOf(id) === -1);

    if (staleIds.length > 0) {
      const deleteResult = await client
        .from(SUPABASE_TABLES.inventory)
        .delete()
        .in("id", staleIds);

      if (deleteResult.error) {
        throw new Error("Unable to remove deleted inventory rows from Supabase: " + deleteResult.error.message);
      }
    }

    return sanitized;
  }

  async function getUsers() {
    if (!isSupabaseConfigured()) {
      return getUsersFromLocal();
    }

    try {
      return getUsersFromSupabase();
    } catch (error) {
      if (isFetchError(error)) {
        return getUsersFromLocal();
      }

      throw error;
    }
  }

  async function hasSupabaseAuthSession() {
    const client = getSupabaseClient();
    if (!client) {
      return false;
    }

    try {
      const response = await client.auth.getSession();
      if (response.error) {
        return false;
      }

      return Boolean(response.data && response.data.session);
    } catch (error) {
      return false;
    }
  }

  async function shouldUseSupabaseData() {
    if (!isSupabaseConfigured()) {
      return false;
    }

    const session = getSession();
    if (!session || session.authSource !== "supabase") {
      return false;
    }

    return hasSupabaseAuthSession();
  }

  async function getInventory() {
    if (!(await shouldUseSupabaseData())) {
      return getInventoryFromLocal();
    }

    try {
      return getInventoryFromSupabase();
    } catch (error) {
      if (isFetchError(error)) {
        return getInventoryFromLocal();
      }

      throw error;
    }
  }

  async function setInventory(items) {
    if (!(await shouldUseSupabaseData())) {
      return setInventoryToLocal(items);
    }

    try {
      return setInventoryToSupabase(items);
    } catch (error) {
      if (isFetchError(error)) {
        return setInventoryToLocal(items);
      }

      if (isRowLevelSecurityError(error)) {
        return setInventoryToLocal(items);
      }

      throw error;
    }
  }

  async function getStats() {
    const items = await getInventory();
    const categoryCount = new Set(items.map((item) => item.category)).size;
    const lowStockItems = items.filter((item) => item.quantity <= LOW_STOCK_THRESHOLD).length;

    return {
      totalItems: items.length,
      lowStockItems,
      categoryCount
    };
  }

  function getLandingPage(role) {
    return role === "worker" ? "inventory.html" : "dashboard.html";
  }

  function normalizeRole(role) {
    return role === "admin" ? "admin" : "worker";
  }

  function buildSession(username, role, authSource) {
    return {
      username,
      role: normalizeRole(role),
      authSource: authSource === "supabase" ? "supabase" : "local",
      loginAt: new Date().toISOString()
    };
  }

  function resolveSupabaseRole(user, fallbackRole) {
    if (!user || typeof user !== "object") {
      return normalizeRole(fallbackRole || "worker");
    }

    const metadataRole = user.user_metadata && user.user_metadata.role;
    const appRole = user.app_metadata && user.app_metadata.role;

    return normalizeRole(metadataRole || appRole || fallbackRole || "worker");
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  async function signUpWithEmail(email, password, role) {
    const normalizedEmail = normalizeEmail(email);
    const selectedRole = normalizeRole(role || "worker");
    if (!normalizedEmail || !password) {
      throw new Error("Email and password are required.");
    }

    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase is not configured.");
    }

    let response;
    try {
      response = await client.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            role: selectedRole
          }
        }
      });
    } catch (error) {
      if (isFetchError(error)) {
        throw createSupabaseConnectionError();
      }

      throw error;
    }

    if (response.error) {
      if (isEmailRateLimitError(response.error)) {
        if (client) {
          client.auth.signOut().catch(function () {
          });
        }

        upsertLocalUser(normalizedEmail, password, selectedRole);
        const localSession = buildSession(normalizedEmail, selectedRole, "local");
        safeWrite(STORAGE_KEYS.session, localSession);

        return {
          session: localSession,
          requiresEmailConfirmation: false,
          email: normalizedEmail,
          usedLocalFallback: true
        };
      }

      throw new Error(response.error.message || "Unable to create account.");
    }

    const nextUser = response.data && response.data.user;
    const nextSession = response.data && response.data.session;

    if (!nextUser) {
      throw new Error("Account creation failed.");
    }

    if (!nextSession) {
      return {
        session: null,
        requiresEmailConfirmation: true,
        email: normalizedEmail
      };
    }

    const sessionRole = resolveSupabaseRole(nextUser, selectedRole);
    const session = buildSession(nextUser.email || normalizedEmail, sessionRole, "supabase");
    safeWrite(STORAGE_KEYS.session, session);

    return {
      session,
      requiresEmailConfirmation: false,
      email: normalizedEmail,
      usedLocalFallback: false
    };
  }

  async function loginWithEmail(email, password, role) {
    const normalizedEmail = normalizeEmail(email);
    const selectedRole = normalizeRole(role || "worker");
    if (!normalizedEmail || !password) {
      throw new Error("Email and password are required.");
    }

    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase is not configured.");
    }

    let response;
    try {
      response = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
    } catch (error) {
      if (isFetchError(error)) {
        throw createSupabaseConnectionError();
      }

      throw error;
    }

    if (response.error) {
      const message = String(response.error.message || "").toLowerCase();

      if (message.indexOf("email not confirmed") !== -1) {
        throw new Error("Email not confirmed. Check your inbox before logging in.");
      }

      throw new Error(response.error.message || "Invalid email or password.");
    }

    const user = response.data && response.data.user;
    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const actualRole = resolveSupabaseRole(user);
    if (actualRole !== selectedRole) {
      await client.auth.signOut();
      throw new Error("Selected role does not match this account.");
    }

    const session = buildSession(user.email || normalizedEmail, actualRole, "supabase");
    safeWrite(STORAGE_KEYS.session, session);
    return session;
  }

  async function loginUser(username, password, role) {
    if (isSupabaseConfigured()) {
      const normalizedIdentifier = String(username || "").trim().toLowerCase();
      const looksLikeEmail = normalizedIdentifier.indexOf("@") !== -1;

      if (!looksLikeEmail) {
        return loginWithLocalCredentials(normalizedIdentifier, password, role);
      }

      try {
        return await loginWithEmail(normalizedIdentifier, password, role);
      } catch (error) {
        if (isInvalidCredentialsError(error)) {
          return loginWithLocalCredentials(normalizedIdentifier, password, role);
        }

        throw error;
      }
    }

    return loginWithLocalCredentials(username, password, role);
  }

  function loginWithLocalCredentials(username, password, role) {
    if (!username || !password) {
      throw new Error("Username and password are required.");
    }

    const users = getUsersFromLocal();
    const selectedRole = normalizeRole(role || "worker");
    const normalizedUsername = String(username).trim().toLowerCase();
    const user = users.find(
      (entry) => String(entry.username || "").toLowerCase() === normalizedUsername && entry.password === password && normalizeRole(entry.role) === selectedRole
    );

    if (!user) {
      const demoUser = DEMO_USERS.find(
        (entry) => entry.username === normalizedUsername && entry.password === password && normalizeRole(entry.role) === selectedRole
      );

      if (!demoUser) {
        throw new Error("Invalid login for the selected role.");
      }

      const client = getSupabaseClient();
      if (client) {
        client.auth.signOut().catch(function () {
        });
      }

      upsertLocalUser(demoUser.username, demoUser.password, demoUser.role);
      const restoredSession = buildSession(demoUser.username, demoUser.role, "local");
      safeWrite(STORAGE_KEYS.session, restoredSession);
      return restoredSession;
    }

    const client = getSupabaseClient();
    if (client) {
      client.auth.signOut().catch(function () {
      });
    }

    const session = buildSession(user.username, user.role, "local");

    safeWrite(STORAGE_KEYS.session, session);
    return session;
  }

  function logoutUser() {
    const client = getSupabaseClient();
    if (client) {
      client.auth.signOut().catch(function () {
      });
    }

    localStorage.removeItem(STORAGE_KEYS.session);
  }

  function getSession() {
    const session = safeRead(STORAGE_KEYS.session, null);

    if (!session || typeof session !== "object") {
      return null;
    }

    if (!session.username || !session.role) {
      return null;
    }

    session.authSource = session.authSource === "supabase" ? "supabase" : "local";

    return session;
  }

  function requireAuth() {
    const session = getSession();

    if (!session) {
      window.location.href = "index.html";
      return null;
    }

    return session;
  }

  function getDataMode() {
    const session = getSession();
    return session && session.authSource === "supabase" ? "supabase" : "local";
  }

  function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
    return nextTheme;
  }

  function initTheme() {
    const stored = localStorage.getItem(STORAGE_KEYS.theme) || "light";
    return applyTheme(stored);
  }

  function toggleTheme() {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    return applyTheme(next);
  }

  function formatDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleString();
  }

  seedStorage();
  initTheme();

  window.InventoryAuth = {
    CATEGORY_LIST,
    LOW_STOCK_THRESHOLD,
    STORAGE_KEYS,
    formatDate,
    getInventory,
    getLandingPage,
    getDataMode,
    getSession,
    getStats,
    isSupabaseConfigured,
    loginWithEmail,
    loginUser,
    logoutUser,
    requireAuth,
    signUpWithEmail,
    setInventory,
    toggleTheme
  };
})();
