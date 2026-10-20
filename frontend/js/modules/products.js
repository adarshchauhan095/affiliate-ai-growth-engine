// Tab A: Product Registry Module
import { state, createProduct, updateProduct, archiveProduct, getVideosForProduct } from "../services/db.js";
import { copyToClipboard } from "./ui-utils.js";

export function initProductsTab() {
  const container = document.getElementById("tab-products");
  if (!container) return;

  renderProductsView();
}

export function renderProductsView() {
  const container = document.getElementById("tab-products");
  if (!container) return;

  const products = Array.from(state.products.values());
  const activeCount = products.filter(p => p.status === "Active").length;
  const unavailCount = products.filter(p => p.status === "Unavailable" || p.status === "Recheck").length;

  container.innerHTML = `
    <div class="view-header">
      <div class="view-title">
        <h2>Product Registry</h2>
        <p>Centralized Amazon product records with verified affiliate links and stable IDs</p>
      </div>
      <button class="btn btn-primary" id="btn-add-product">
        <span>+</span> Add Product
      </button>
    </div>

    <!-- Quick Metrics & Filters Bar -->
    <div class="metrics-bar">
      <div class="metric-pill active" data-filter-status="ALL">
        <span>All Products</span>
        <strong>${products.length}</strong>
      </div>
      <div class="metric-pill" data-filter-status="Active">
        <span>Active Deals</span>
        <strong style="color:var(--accent);">${activeCount}</strong>
      </div>
      <div class="metric-pill" data-filter-status="Unavailable">
        <span>Needs Attention</span>
        <strong style="color:var(--warning);">${unavailCount}</strong>
      </div>
      <div class="metric-pill" data-filter-status="Archived">
        <span>Archived</span>
        <strong>${products.filter(p => p.status === "Archived").length}</strong>
      </div>
    </div>

    <!-- Category Pills -->
    <div class="category-scroll-bar" id="product-category-filters">
      <button class="cat-pill active" data-cat="ALL">All Categories</button>
      <button class="cat-pill" data-cat="Electronics">Electronics</button>
      <button class="cat-pill" data-cat="Home & Kitchen">Kitchen</button>
      <button class="cat-pill" data-cat="Smartwatches">Smartwatches</button>
      <button class="cat-pill" data-cat="Audio">Audio</button>
      <button class="cat-pill" data-cat="Fashion">Fashion</button>
    </div>

    <!-- Products Cards List -->
    <div class="cards-list" id="products-cards-list">
      ${renderProductCardsList(products)}
    </div>
  `;

  setupProductEventListeners();
}

function renderProductCardsList(products) {
  if (products.length === 0) {
    return `
      <div class="empty-state card">
        <span class="empty-icon">🏷️</span>
        <h3>No Products in Registry</h3>
        <p>Add your first Amazon India deal using the "+ Add Product" button above.</p>
      </div>
    `;
  }

  return products.map((p) => {
    const videos = getVideosForProduct(p.id);
    const statusClass = p.status === "Active" ? "status-active" : p.status === "Archived" ? "status-archived" : "status-warn";
    const priceDisplay = p.price !== null && p.price !== undefined ? `₹${p.price.toLocaleString("en-IN")}` : "Price Unchecked";
    const checkedDate = p.priceLastChecked ? new Date(p.priceLastChecked.seconds ? p.priceLastChecked.seconds * 1000 : p.priceLastChecked).toLocaleDateString() : "Never";

    return `
      <div class="entity-card product-card card" data-id="${p.id}">
        <div class="card-top-row">
          <div class="id-badge-group">
            <span class="entity-badge id-pill" onclick="window.copyText('${p.id}', 'Product ID')">
              ${p.id} <span class="copy-icon">📋</span>
            </span>
            ${p.asin ? `
              <span class="asin-badge" onclick="window.copyText('${p.asin}', 'ASIN')">
                ASIN: ${p.asin} <span class="copy-icon">📋</span>
              </span>
            ` : '<span class="asin-badge empty">No ASIN</span>'}
          </div>
          <span class="status-pill ${statusClass}">${p.status}</span>
        </div>

        <h3 class="card-title">${escapeHtml(p.productName)}</h3>

        <div class="card-meta-row">
          <span class="meta-tag">📁 ${escapeHtml(p.category)}</span>
          ${p.brand ? `<span class="meta-tag">🏷️ ${escapeHtml(p.brand)}</span>` : ""}
          <span class="meta-tag price-tag">💰 ${priceDisplay}</span>
        </div>

        <div class="price-disclaimer-note">
          Snapshot as of ${checkedDate}. Prices change frequently on Amazon.
        </div>

        <!-- URL & Actions Bar -->
        <div class="card-action-bar">
          <button class="btn btn-sm btn-accent" onclick="window.copyText('${escapeAttr(p.affiliateUrl)}', 'Affiliate Link')">
            📋 Copy Affiliate Link
          </button>
          <a href="${escapeAttr(p.amazonProductUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">
            ↗ Amazon Page
          </a>
          <button class="btn btn-sm btn-ghost" onclick="window.openProductModal('${p.id}')">
            ✏️ Edit
          </button>
          <button class="btn btn-sm btn-ghost" onclick="window.copyAllProductDetails('${p.id}')">
            📄 Copy All
          </button>
        </div>

        ${videos.length > 0 ? `
          <div class="linked-section">
            <span class="linked-label">Featured in ${videos.length} Video${videos.length > 1 ? "s" : ""}:</span>
            <div class="linked-tags">
              ${videos.map(v => `<span class="linked-chip" onclick="window.openVideoView('${v.id}')">${v.id} (${v.platform})</span>`).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function setupProductEventListeners() {
  const btnAdd = document.getElementById("btn-add-product");
  if (btnAdd) {
    btnAdd.addEventListener("click", () => window.openProductModal(null));
  }

  // Filter Pills
  document.querySelectorAll("[data-filter-status]").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("[data-filter-status]").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const status = pill.getAttribute("data-filter-status");
      filterProductsByStatus(status);
    });
  });

  // Category Pills
  document.querySelectorAll("#product-category-filters .cat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#product-category-filters .cat-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const cat = pill.getAttribute("data-cat");
      filterProductsByCategory(cat);
    });
  });
}

function filterProductsByStatus(status) {
  const listEl = document.getElementById("products-cards-list");
  if (!listEl) return;
  const all = Array.from(state.products.values());
  const filtered = status === "ALL" ? all : all.filter(p => p.status === status);
  listEl.innerHTML = renderProductCardsList(filtered);
}

function filterProductsByCategory(cat) {
  const listEl = document.getElementById("products-cards-list");
  if (!listEl) return;
  const all = Array.from(state.products.values());
  const filtered = cat === "ALL" ? all : all.filter(p => p.category.toLowerCase().includes(cat.toLowerCase()));
  listEl.innerHTML = renderProductCardsList(filtered);
}

// Modal Form for Add / Edit
window.openProductModal = function(productId = null) {
  const isEdit = Boolean(productId);
  const prod = isEdit ? state.products.get(productId) : null;
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  const currentTag = (state.distribution && state.distribution.associateTag) || "mybudgetdeal9-21";

  modalContainer.innerHTML = `
    <div class="modal-backdrop show">
      <div class="modal-sheet">
        <div class="modal-header">
          <h3>${isEdit ? `Edit Product: ${prod.id}` : "Add New Amazon Product"}</h3>
          <button class="btn-close" onclick="window.closeModal()">&times;</button>
        </div>
        <form id="product-form" class="modal-body form-grid">
          <div class="form-group full-width">
            <label>Product Name *</label>
            <input type="text" id="p-name" required maxlength="200" value="${prod ? escapeAttr(prod.productName) : ""}" placeholder="e.g. Noise Pulse 2 Smartwatch with Bluetooth Calling" />
          </div>

          <div class="form-group">
            <label>Amazon Product URL (Original) *</label>
            <input type="url" id="p-url" required value="${prod ? escapeAttr(prod.amazonProductUrl) : ""}" placeholder="https://www.amazon.in/dp/B08..." />
            <small class="form-hint">Paste raw product link. ASIN will be parsed automatically.</small>
          </div>

          <div class="form-group">
            <label>Amazon ASIN (10-char)</label>
            <input type="text" id="p-asin" maxlength="10" value="${prod && prod.asin ? prod.asin : ""}" placeholder="e.g. B08XYZ1234" />
            <small class="form-hint" id="asin-helper-text">Parsed from link or enter manually. Never fabricated.</small>
          </div>

          <div class="form-group full-width">
            <label>Exact Affiliate URL *</label>
            <input type="url" id="p-aff-url" required value="${prod ? escapeAttr(prod.affiliateUrl) : ""}" placeholder="https://amzn.to/3xyz or https://www.amazon.in/dp/...?tag=${currentTag}" />
            <div class="aff-url-actions">
              <button type="button" class="btn btn-xs btn-outline" id="btn-generate-aff-url">
                ⚡ Generate Tagged Link with tag '${currentTag}'
              </button>
            </div>
            <small class="form-hint">Stored verbatim. Shortened links (amzn.to) are never modified.</small>
          </div>

          <div class="form-group">
            <label>Category *</label>
            <input type="text" id="p-category" required value="${prod ? escapeAttr(prod.category) : ""}" placeholder="e.g. Electronics, Kitchen, Smartwatches" />
          </div>

          <div class="form-group">
            <label>Brand</label>
            <input type="text" id="p-brand" value="${prod && prod.brand ? escapeAttr(prod.brand) : ""}" placeholder="e.g. Noise, Pigeon, boAt" />
          </div>

          <div class="form-group">
            <label>Price Snapshot (₹ INR)</label>
            <input type="number" step="1" min="0" id="p-price" value="${prod && prod.price !== null ? prod.price : ""}" placeholder="e.g. 1299" />
            <small class="form-hint">Snapshot price only. Flagged with date disclaimer.</small>
          </div>

          <div class="form-group">
            <label>Status *</label>
            <select id="p-status">
              <option value="Active" ${prod && prod.status === "Active" ? "selected" : ""}>Active</option>
              <option value="Unavailable" ${prod && prod.status === "Unavailable" ? "selected" : ""}>Unavailable</option>
              <option value="Recheck" ${prod && prod.status === "Recheck" ? "selected" : ""}>Recheck</option>
              ${isEdit ? `<option value="Archived" ${prod.status === "Archived" ? "selected" : ""}>Archived</option>` : ""}
            </select>
          </div>

          <div class="form-group full-width">
            <label>Search Keywords & Aliases (Comma-separated)</label>
            <input type="text" id="p-keywords" value="${prod && Array.isArray(prod.searchKeywords) ? escapeAttr(prod.searchKeywords.join(", ")) : ""}" placeholder="e.g. watch, fitness tracker, calling, waterproof" />
          </div>

          <div class="form-group full-width">
            <label>Product Notes</label>
            <textarea id="p-notes" rows="2" placeholder="Key selling hooks, deal duration, target audience...">${prod && prod.productNotes ? escapeHtml(prod.productNotes) : ""}</textarea>
          </div>

          <div class="modal-footer full-width">
            ${isEdit && prod.status !== "Archived" ? `
              <button type="button" class="btn btn-outline-danger" id="btn-archive-prod">
                Archive Product
              </button>
            ` : ""}
            <button type="button" class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-prod">
              ${isEdit ? "Save Changes" : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Auto-extract ASIN when URL changes
  const urlInput = document.getElementById("p-url");
  const asinInput = document.getElementById("p-asin");
  const affInput = document.getElementById("p-aff-url");

  urlInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    const asinMatch = val.match(/(?:\/dp\/|\/gp\/product\/|\/exec\/obidos\/ASIN\/|\/o\/ASIN\/|\/product\/)([A-Z0-9]{10})/i);
    if (asinMatch && asinMatch[1]) {
      asinInput.value = asinMatch[1].toUpperCase();
    }
  });

  // Auto-generator button
  document.getElementById("btn-generate-aff-url").addEventListener("click", () => {
    const asin = asinInput.value.trim().toUpperCase();
    if (asin && asin.length === 10) {
      affInput.value = `https://www.amazon.in/dp/${asin}?tag=${currentTag}`;
    } else {
      alert("Please ensure a valid 10-character ASIN is entered before auto-generating a tagged link.");
    }
  });

  // Archive button
  const btnArchive = document.getElementById("btn-archive-prod");
  if (btnArchive) {
    btnArchive.addEventListener("click", async () => {
      if (confirm(`Archive product ${prod.id}? It will be retained in history without breaking linked videos.`)) {
        btnArchive.disabled = true;
        try {
          await archiveProduct(prod.id);
          window.closeModal();
          renderProductsView();
        } catch (err) {
          alert(`Archive failed: ${err.message}`);
          btnArchive.disabled = false;
        }
      }
    });
  }

  // Submit Handler
  document.getElementById("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("btn-submit-prod");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const keywords = document.getElementById("p-keywords").value
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);

    const priceVal = document.getElementById("p-price").value;

    const payload = {
      productName: document.getElementById("p-name").value,
      amazonProductUrl: document.getElementById("p-url").value,
      asin: document.getElementById("p-asin").value || null,
      affiliateUrl: document.getElementById("p-aff-url").value,
      category: document.getElementById("p-category").value,
      brand: document.getElementById("p-brand").value || null,
      price: priceVal ? parseFloat(priceVal) : null,
      status: document.getElementById("p-status").value,
      searchKeywords: keywords,
      productNotes: document.getElementById("p-notes").value || null
    };

    try {
      if (isEdit) {
        await updateProduct(productId, payload);
      } else {
        await createProduct(payload);
      }
      window.closeModal();
      renderProductsView();
    } catch (err) {
      alert(`Save Error: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "Save Changes" : "Create Product";
    }
  });
};

window.copyAllProductDetails = function(productId) {
  const p = state.products.get(productId);
  if (!p) return;
  const text = `
Product: ${p.productName}
ID: ${p.id}
ASIN: ${p.asin || "N/A"}
Category: ${p.category}
Price: ${p.price !== null ? `₹${p.price}` : "N/A"}
Amazon URL: ${p.amazonProductUrl}
Affiliate Link: ${p.affiliateUrl}
Status: ${p.status}
  `.trim();
  copyToClipboard(text, "All Product Details");
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  if (!str) return "";
  return String(str).replace(/"/g, "&quot;");
}
