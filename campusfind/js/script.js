/* ============================================================
   CampusFind - script.js
   All CRUD logic + page rendering lives here.
   Beginner-friendly, heavily commented.
   ============================================================ */

/* ---------- 1. CONSTANTS ---------- */

const STORAGE_KEY = "campusfind_items";
const TOAST_KEY = "campusfind_toast"; // used to show a toast after a redirect
let itemsCache = [];

// Category -> Font Awesome icon map (easy to extend)
const CATEGORY_ICONS = {
  "Electronics": "fa-laptop",
  "IDs and Cards": "fa-id-card",
  "Bags": "fa-briefcase",
  "Accessories": "fa-glasses",
  "Personal Items": "fa-box-open"
};

// Status -> CSS class map (used for colored badges)
const STATUS_CLASS = {
  "Searching": "badge-searching",
  "Unclaimed": "badge-unclaimed",
  "Claimed": "badge-claimed",
  "Closed": "badge-closed"
};


/* ---------- 2. LOCALSTORAGE + API HELPER FUNCTIONS (CRUD CORE) ---------- */

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const text = await response.text();
  let payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}

async function refreshItemsFromServer(force = false) {
  if (!force && itemsCache.length > 0) {
    return itemsCache;
  }

  try {
    const items = await apiRequest('/api/items');
    itemsCache = Array.isArray(items) ? items : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsCache));
    return itemsCache;
  } catch (error) {
    console.warn('Could not refresh from server, using local data instead:', error.message);
    const localItems = getItems();
    itemsCache = localItems;
    return localItems;
  }
}

// READ: get every item from localStorage
function getItems() {
  if (itemsCache.length > 0) return itemsCache;

  const data = localStorage.getItem(STORAGE_KEY);
  itemsCache = data ? JSON.parse(data) : [];
  return itemsCache;
}

// Save the whole array back to localStorage
function saveItems(items) {
  itemsCache = Array.isArray(items) ? items : [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsCache));
}

// READ: get a single item by its id
function getItemById(id) {
  const items = getItems();
  return items.find(item => String(item.id) === String(id));
}

// CREATE: add a brand new item
async function addItem(item) {
  try {
    const response = await apiRequest('/api/items', {
      method: 'POST',
      body: JSON.stringify(item)
    });

    const items = getItems();
    const dbItem = {
      ...item,
      id: response.itemId,
      createdAt: Date.now()
    };

    saveItems([dbItem, ...items.filter(existing => existing.id !== response.itemId)]);
    return dbItem;
  } catch (error) {
    console.error('Database save failed:', error.message);

    const items = getItems();
    const newItem = {
      ...item,
      id: generateId(),
      createdAt: Date.now()
    };

    items.unshift(newItem);
    saveItems(items);
    return newItem;
  }
}

// UPDATE: replace the fields of an existing item
async function updateItem(id, updatedFields) {
  const existing = getItemById(id);

  try {
    await apiRequest(`/api/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedFields)
    });

    const items = getItems();
    const index = items.findIndex(item => String(item.id) === String(id));
    if (index !== -1) {
      items[index] = { ...items[index], ...updatedFields };
      saveItems(items);
    }

    return true;
  } catch (error) {
    console.error('Database update failed:', error.message);
    const items = getItems();
    const index = items.findIndex(item => String(item.id) === String(id));
    if (index === -1) return false;
    items[index] = { ...items[index], ...updatedFields };
    saveItems(items);
    return true;
  }
}

// DELETE: remove an item permanently
async function deleteItem(id) {
  try {
    await apiRequest(`/api/items/${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Database delete failed:', error.message);
  }

  const items = getItems().filter(item => String(item.id) !== String(id));
  saveItems(items);
}

// Generate a unique-enough id for a school project
function generateId() {
  return "id-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
}


/* ---------- 3. SAMPLE DATA (loads once, first time app is opened) ---------- */

function initSampleData() {
  const existing = getItems();
  if (existing.length > 0) return; // don't overwrite real data

  // Add more sample objects to this array any time you want more demo data.
  const sampleItems = [
    {
      name: "Black Wallet",
      type: "Lost",
      category: "IDs and Cards",
      location: "University Library",
      status: "Searching",
      color: "Black",
      description: "Small black wallet with a student ID and two bank cards.",
      date: "2026-09-08",
      reporterName: "Alex Student",
      contact: "student@example.com",
      image: ""
    },
    {
      name: "Blue Umbrella",
      type: "Found",
      category: "Accessories",
      location: "Cafeteria",
      status: "Unclaimed",
      color: "Blue",
      description: "Blue foldable umbrella left near the cafeteria entrance.",
      date: "2026-09-07",
      reporterName: "Jamie Student",
      contact: "student@example.com",
      image: ""
    },
    {
      name: "Silver USB Drive",
      type: "Lost",
      category: "Electronics",
      location: "Computer Lab",
      status: "Searching",
      color: "Silver",
      description: "Small silver USB flash drive containing school documents.",
      date: "2026-09-07",
      reporterName: "Taylor Student",
      contact: "student@example.com",
      image: ""
    },
    {
      name: "Student ID",
      type: "Found",
      category: "IDs and Cards",
      location: "Room 204",
      status: "Claimed",
      color: "White",
      description: "Student identification card found inside Room 204.",
      date: "2026-09-06",
      reporterName: "Jordan Student",
      contact: "student@example.com",
      image: ""
    },
    {
      name: "White Water Bottle",
      type: "Lost",
      category: "Personal Items",
      location: "Gym",
      status: "Searching",
      color: "White",
      description: "White reusable water bottle with a small sticker.",
      date: "2026-09-05",
      reporterName: "Casey Student",
      contact: "student@example.com",
      image: ""
    }
  ];

  // Give each sample a unique id and a createdAt timestamp, oldest last
  const now = Date.now();
  const withIds = sampleItems.map((item, index) => ({
    ...item,
    id: generateId(),
    createdAt: now - index * 1000 // keeps a stable "most recent first" order
  }));

  saveItems(withIds);
}


/* ---------- 4. TOAST NOTIFICATIONS ---------- */

// Call this to show a toast immediately on the current page
function showToast(message, type = "success") {
  // Remove any existing toast first
  const old = document.querySelector(".toast");
  if (old) old.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}"></i> ${message}`;
  document.body.appendChild(toast);

  // Trigger the CSS transition
  requestAnimationFrame(() => toast.classList.add("show"));

  // Auto remove after a few seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Call this BEFORE redirecting to another page, to queue up a toast
function queueToast(message, type = "success") {
  sessionStorage.setItem(TOAST_KEY, JSON.stringify({ message, type }));
}

// Call this on every page load to show a queued toast (if any)
function showQueuedToastIfAny() {
  const raw = sessionStorage.getItem(TOAST_KEY);
  if (!raw) return;
  sessionStorage.removeItem(TOAST_KEY);
  const { message, type } = JSON.parse(raw);
  showToast(message, type);
}


/* ---------- 5. CONFIRM MODAL (used for Delete) ---------- */

function showConfirmModal(message, onConfirm) {
  const overlay = document.getElementById("confirmOverlay");
  const msgEl = document.getElementById("confirmMessage");
  const yesBtn = document.getElementById("confirmYesBtn");
  const noBtn = document.getElementById("confirmNoBtn");

  if (!overlay) {
    // Fallback in case the modal markup is missing from a page
    if (window.confirm(message)) onConfirm();
    return;
  }

  msgEl.textContent = message;
  overlay.classList.add("show");

  // Clean up old listeners by replacing the buttons with clones
  const newYes = yesBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(newYes, yesBtn);
  const newNo = noBtn.cloneNode(true);
  noBtn.parentNode.replaceChild(newNo, noBtn);

  newYes.addEventListener("click", () => {
    overlay.classList.remove("show");
    onConfirm();
  });
  newNo.addEventListener("click", () => {
    overlay.classList.remove("show");
  });
}


/* ---------- 6. NAVIGATION HELPERS ---------- */

// Marks the correct nav link as "active" based on the current filename
function setActiveNavLink() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link").forEach(link => {
    const linkPage = link.getAttribute("href").split("?")[0];
    if (linkPage === path) {
      link.classList.add("active");
    }
  });

  // Mobile menu toggle
  const toggleBtn = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
  }
}


/* ---------- 7. SMALL FORMAT HELPERS ---------- */

function formatDate(dateString) {
  if (!dateString) return "Unknown date";
  const options = { year: "numeric", month: "long", day: "numeric" };
  // Adding T00:00:00 avoids timezone shifting the date backward a day
  const d = new Date(dateString + "T00:00:00");
  if (isNaN(d)) return dateString;
  return d.toLocaleDateString(undefined, options);
}

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || "fa-tag";
}

function getStatusBadgeClass(status) {
  return STATUS_CLASS[status] || "badge-closed";
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Reads the query string, e.g. ?id=123&search=wallet
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}


/* ---------- 8. IMAGE UPLOAD (resize + compress to Base64) ---------- */

// Reads a File object, resizes it to fit within maxSize, and returns
// a Base64 JPEG data URL via the callback. Keeps localStorage small.
function readAndResizeImage(file, callback, maxSize = 500) {
  if (!file) {
    callback("");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxSize) {
        height = Math.round((height *= maxSize / width));
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width *= maxSize / height));
        height = maxSize;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // 0.7 quality keeps file size reasonable for localStorage
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      callback(dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}


/* ============================================================
   PAGE-SPECIFIC RENDER FUNCTIONS
   Each page's inline script (at the bottom of the HTML file)
   calls the relevant function(s) below.
   ============================================================ */

/* ----- DASHBOARD (index.html) ----- */

async function renderDashboard() {
  const items = await refreshItemsFromServer();

  const total = items.length;
  const lost = items.filter(i => i.type === "Lost").length;
  const found = items.filter(i => i.type === "Found").length;
  const claimed = items.filter(i => i.status === "Claimed").length;

  setText("statTotal", total);
  setText("statLost", lost);
  setText("statFound", found);
  setText("statClaimed", claimed);

  // Recent reports = newest 5 by createdAt
  const recent = [...items]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);

  const container = document.getElementById("recentReportsContainer");
  if (!container) return;

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-box-open"></i>
        <p>No reports yet. Be the first to report an item!</p>
        <a href="item-form.html" class="btn btn-primary">Report an Item</a>
      </div>`;
    return;
  }

  container.innerHTML = recent.map(item => buildItemCard(item)).join("");
  attachCardEvents(container);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


/* ----- ITEMS PAGE (items.html) ----- */

let currentStatusFilter = "All";
let currentCategoryFilter = "All";
let currentSearchTerm = "";

async function renderItemsPage() {
  await refreshItemsFromServer();

  // Pick up a search term from the URL (e.g. coming from the dashboard)
  const urlSearch = getQueryParam("search");
  if (urlSearch) {
    currentSearchTerm = urlSearch;
    const searchInput = document.getElementById("itemsSearchInput");
    if (searchInput) searchInput.value = urlSearch;
  }

  const urlType = getQueryParam("type"); // optional: items.html?type=Lost
  if (urlType) {
    currentStatusFilter = urlType;
  }

  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  let items = getItems();

  // Filter by status/type tab
  if (currentStatusFilter !== "All") {
    if (currentStatusFilter === "Lost" || currentStatusFilter === "Found") {
      items = items.filter(i => i.type === currentStatusFilter);
    } else if (currentStatusFilter === "Claimed") {
      items = items.filter(i => i.status === "Claimed");
    }
  }

  // Filter by category
  if (currentCategoryFilter !== "All") {
    items = items.filter(i => i.category === currentCategoryFilter);
  }

  // Filter by search term (name, location, category, description)
  if (currentSearchTerm.trim() !== "") {
    const term = currentSearchTerm.toLowerCase();
    items = items.filter(i =>
      (i.name && i.name.toLowerCase().includes(term)) ||
      (i.location && i.location.toLowerCase().includes(term)) ||
      (i.category && i.category.toLowerCase().includes(term)) ||
      (i.description && i.description.toLowerCase().includes(term))
    );
  }

  // Sort newest first
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  renderItemsGrid(items);
}

function renderItemsGrid(items) {
  const container = document.getElementById("itemsContainer");
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-magnifying-glass"></i>
        <p>No items found</p>
        <a href="item-form.html" class="btn btn-primary">Report an Item</a>
      </div>`;
    return;
  }

  container.innerHTML = items.map(item => buildItemCard(item, true)).join("");
  attachCardEvents(container);
}

// Builds the reusable HTML for one item card (used in dashboard + items page)
function buildItemCard(item, withActions = false) {
  const image = item.image
    ? `<img src="${item.image}" alt="Photo of ${escapeHtml(item.name)}" class="card-img">`
    : `<div class="card-img card-img-placeholder"><i class="fa-solid ${getCategoryIcon(item.category)}"></i></div>`;

  const actions = withActions ? `
      <div class="card-actions">
        <a href="item-details.html?id=${item.id}" class="btn btn-small btn-outline">View</a>
        <a href="item-form.html?id=${item.id}" class="btn btn-small btn-outline">Edit</a>
        <button type="button" class="btn btn-small btn-danger" data-delete-id="${item.id}">Delete</button>
      </div>` : `
      <div class="card-actions">
        <a href="item-details.html?id=${item.id}" class="btn btn-small btn-primary">View</a>
      </div>`;

  return `
    <div class="item-card" data-id="${item.id}">
      ${image}
      <div class="card-body">
        <div class="card-top-row">
          <h3 class="card-title">${escapeHtml(item.name)}</h3>
          <span class="type-badge type-${item.type.toLowerCase()}">${item.type}</span>
        </div>
        <p class="card-meta"><i class="fa-solid fa-tag"></i> ${escapeHtml(item.category)}</p>
        <p class="card-meta"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(item.location)}</p>
        <p class="card-meta"><i class="fa-solid fa-calendar"></i> ${formatDate(item.date)}</p>
        <span class="badge ${getStatusBadgeClass(item.status)}">${item.status}</span>
      </div>
      ${actions}
    </div>`;
}

// Attaches the delete-button click handlers to cards inside a container
function attachCardEvents(container) {
  container.querySelectorAll("[data-delete-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-delete-id");
      const item = getItemById(id);
      const name = item ? item.name : "this item";
      showConfirmModal(`Delete the report for "${name}"? This cannot be undone.`, () => {
        deleteItem(id);
        showToast("Item deleted successfully.", "success");
        applyFiltersAndRender();
        // Also refresh dashboard stats if we're on that page
        if (document.getElementById("statTotal")) renderDashboard();
      });
    });
  });
}

function setupItemsPageControls() {
  // Status filter buttons
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentStatusFilter = btn.getAttribute("data-filter");
      applyFiltersAndRender();
    });
  });

  // Category dropdown
  const categorySelect = document.getElementById("categoryFilter");
  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      currentCategoryFilter = categorySelect.value;
      applyFiltersAndRender();
    });
  }

  // Search input (live filtering)
  const searchInput = document.getElementById("itemsSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentSearchTerm = searchInput.value;
      applyFiltersAndRender();
    });
  }

  // Clear filters button
  const clearBtn = document.getElementById("clearFiltersBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      currentStatusFilter = "All";
      currentCategoryFilter = "All";
      currentSearchTerm = "";
      if (searchInput) searchInput.value = "";
      if (categorySelect) categorySelect.value = "All";
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      document.querySelector('.filter-btn[data-filter="All"]').classList.add("active");
      applyFiltersAndRender();
    });
  }
}


/* ----- ITEM FORM PAGE (item-form.html) ----- */

let uploadedImageData = ""; // holds the Base64 image while editing the form

function setupItemForm() {
  const form = document.getElementById("itemForm");
  const heading = document.getElementById("formHeading");
  const submitBtn = document.getElementById("submitBtn");
  const id = getQueryParam("id");
  const presetType = getQueryParam("type"); // e.g. item-form.html?type=Lost

  if (id) {
    // EDIT MODE
    const item = getItemById(id);
    if (!item) {
      showToast("That item could not be found.", "error");
    } else {
      heading.textContent = "Edit Item Report";
      submitBtn.textContent = "Save Changes";
      fillFormWithItem(item);
      uploadedImageData = item.image || "";
    }
  } else {
    // ADD MODE
    heading.textContent = "Report an Item";
    submitBtn.textContent = "Submit Report";
    if (presetType) {
      document.getElementById("type").value = presetType;
    }
    // Default the date field to today for convenience
    const dateField = document.getElementById("date");
    if (dateField && !dateField.value) {
      dateField.value = new Date().toISOString().split("T")[0];
    }
  }

  // Image preview handling
  const imageInput = document.getElementById("image");
  const previewBox = document.getElementById("imagePreview");
  if (imageInput) {
    imageInput.addEventListener("change", () => {
      const file = imageInput.files[0];
      if (!file) return;
      readAndResizeImage(file, (dataUrl) => {
        uploadedImageData = dataUrl;
        if (previewBox) {
          previewBox.innerHTML = `<img src="${dataUrl}" alt="Preview of uploaded item photo">`;
        }
      });
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleFormSubmit(id);
  });

  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      window.location.href = "items.html";
    });
  }
}

function fillFormWithItem(item) {
  document.getElementById("type").value = item.type || "Lost";
  document.getElementById("name").value = item.name || "";
  document.getElementById("category").value = item.category || "";
  document.getElementById("color").value = item.color || "";
  document.getElementById("location").value = item.location || "";
  document.getElementById("date").value = item.date || "";
  document.getElementById("description").value = item.description || "";
  document.getElementById("reporterName").value = item.reporterName || "";
  document.getElementById("contact").value = item.contact || "";
  document.getElementById("status").value = item.status || "Searching";

  const previewBox = document.getElementById("imagePreview");
  if (previewBox && item.image) {
    previewBox.innerHTML = `<img src="${item.image}" alt="Current photo of ${escapeHtml(item.name)}">`;
  }
}

function handleFormSubmit(id) {
  // Gather values
  const data = {
    type: document.getElementById("type").value,
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value,
    color: document.getElementById("color").value.trim(),
    location: document.getElementById("location").value.trim(),
    date: document.getElementById("date").value,
    description: document.getElementById("description").value.trim(),
    reporterName: document.getElementById("reporterName").value.trim(),
    contact: document.getElementById("contact").value.trim(),
    status: document.getElementById("status").value,
    image: uploadedImageData || ""
  };

  // Validate required fields
  const errors = validateItemData(data);
  showFormErrors(errors);
  if (errors.length > 0) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }

  if (id) {
    updateItem(id, data);
    queueToast("Item updated successfully!", "success");
  } else {
    addItem(data);
    queueToast("Report submitted successfully!", "success");
  }

  window.location.href = "items.html";
}

function validateItemData(data) {
  const errors = [];
  if (!data.type) errors.push("type");
  if (!data.name) errors.push("name");
  if (!data.category) errors.push("category");
  if (!data.location) errors.push("location");
  if (!data.date) errors.push("date");
  if (!data.reporterName) errors.push("reporterName");
  if (!data.contact) errors.push("contact");
  return errors;
}

function showFormErrors(errorFields) {
  // Clear old error states
  document.querySelectorAll(".form-group").forEach(g => g.classList.remove("has-error"));

  errorFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      const group = field.closest(".form-group");
      if (group) group.classList.add("has-error");
    }
  });
}


/* ----- ITEM DETAILS PAGE (item-details.html) ----- */

async function renderItemDetails() {
  await refreshItemsFromServer();

  const id = getQueryParam("id");
  const item = id ? getItemById(id) : null;
  const wrapper = document.getElementById("detailsWrapper");
  const notFoundBox = document.getElementById("notFoundBox");

  if (!item) {
    wrapper.style.display = "none";
    notFoundBox.style.display = "block";
    return;
  }

  notFoundBox.style.display = "none";
  wrapper.style.display = "grid";

  const imageBox = document.getElementById("detailsImage");
  imageBox.innerHTML = item.image
    ? `<img src="${item.image}" alt="Photo of ${escapeHtml(item.name)}">`
    : `<div class="details-img-placeholder"><i class="fa-solid ${getCategoryIcon(item.category)}"></i></div>`;

  setText("detailsName", item.name);
  setText("detailsType", item.type);
  setText("detailsCategory", item.category);
  setText("detailsColor", item.color || "Not specified");
  setText("detailsLocation", item.location);
  setText("detailsDate", formatDate(item.date));
  setText("detailsDescription", item.description || "No description provided.");
  setText("detailsReporter", item.reporterName);

  const typeBadge = document.getElementById("detailsTypeBadge");
  typeBadge.textContent = item.type;
  typeBadge.className = `type-badge type-${item.type.toLowerCase()}`;

  const statusBadge = document.getElementById("detailsStatusBadge");
  statusBadge.textContent = item.status;
  statusBadge.className = `badge ${getStatusBadgeClass(item.status)}`;

  // Contact button (mailto)
  const contactBtn = document.getElementById("contactBtn");
  if (item.contact && item.contact.includes("@")) {
    contactBtn.href = `mailto:${item.contact}?subject=${encodeURIComponent("CampusFind: about your " + item.type.toLowerCase() + " item - " + item.name)}`;
    contactBtn.style.display = "inline-flex";
  } else {
    contactBtn.style.display = "none";
  }

  // Edit button
  document.getElementById("editBtn").href = `item-form.html?id=${item.id}`;

  // Delete button
  document.getElementById("deleteBtn").addEventListener("click", () => {
    showConfirmModal(`Delete the report for "${item.name}"? This cannot be undone.`, () => {
      deleteItem(item.id);
      queueToast("Item deleted successfully.", "success");
      window.location.href = "items.html";
    });
  });
}


/* ----- DASHBOARD SEARCH BAR ----- */

function setupDashboardSearch() {
  const form = document.getElementById("dashboardSearchForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = document.getElementById("dashboardSearchInput").value.trim();
    window.location.href = "items.html" + (value ? `?search=${encodeURIComponent(value)}` : "");
  });
}


/* ---------- 9. RUN ON EVERY PAGE LOAD ---------- */

document.addEventListener("DOMContentLoaded", async () => {
  initSampleData();
  await refreshItemsFromServer(true);
  setActiveNavLink();
  showQueuedToastIfAny();
  setupDashboardSearch();
});
