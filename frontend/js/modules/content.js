// Tab B: Content Library Module
import { state, createVideo, updateVideo, archiveVideo, getProductsForVideo } from "../services/db.js";
import { validateContentCopy } from "../services/compliance.js";
import { copyToClipboard } from "./ui-utils.js";

export function initContentTab() {
  const container = document.getElementById("tab-content");
  if (!container) return;

  renderContentView();
}

export function renderContentView() {
  const container = document.getElementById("tab-content");
  if (!container) return;

  const videos = Array.from(state.videos.values());
  const draftCount = videos.filter(v => v.status === "Draft").length;
  const pubCount = videos.filter(v => v.status === "Published").length;

  container.innerHTML = `
    <div class="view-header">
      <div class="view-title">
        <h2>Content Library</h2>
        <p>Short-form video management across Instagram Reels, YouTube Shorts, and Telegram</p>
      </div>
      <button class="btn btn-primary" id="btn-add-content">
        <span>+</span> Add Content
      </button>
    </div>

    <!-- Metrics Bar -->
    <div class="metrics-bar">
      <div class="metric-pill active" data-filter-status="ALL">
        <span>All Content</span>
        <strong>${videos.length}</strong>
      </div>
      <div class="metric-pill" data-filter-status="Published">
        <span>Published</span>
        <strong style="color:var(--accent);">${pubCount}</strong>
      </div>
      <div class="metric-pill" data-filter-status="Draft">
        <span>Drafts</span>
        <strong style="color:var(--warning);">${draftCount}</strong>
      </div>
      <div class="metric-pill" data-filter-status="Archived">
        <span>Archived</span>
        <strong>${videos.filter(v => v.status === "Archived").length}</strong>
      </div>
    </div>

    <!-- Platform Filter Pills -->
    <div class="category-scroll-bar" id="content-platform-filters">
      <button class="cat-pill active" data-platform="ALL">All Platforms</button>
      <button class="cat-pill" data-platform="Instagram">Instagram Reels</button>
      <button class="cat-pill" data-platform="YouTube">YouTube Shorts</button>
      <button class="cat-pill" data-platform="Telegram">Telegram</button>
      <button class="cat-pill" data-platform="Other">Other</button>
    </div>

    <!-- Content Cards List -->
    <div class="cards-list" id="content-cards-list">
      ${renderVideoCardsList(videos)}
    </div>
  `;

  setupContentEventListeners();
}

function renderVideoCardsList(videos) {
  if (videos.length === 0) {
    return `
      <div class="empty-state card">
        <span class="empty-icon">🎬</span>
        <h3>No Content in Library</h3>
        <p>Log your first published Reel, Short, or Draft using the "+ Add Content" button.</p>
      </div>
    `;
  }

  return videos.map((v) => {
    const products = getProductsForVideo(v.id);
    const statusClass = v.status === "Published" ? "status-active" : v.status === "Archived" ? "status-archived" : "status-warn";
    const pubDateStr = v.publishDate ? new Date(v.publishDate.seconds ? v.publishDate.seconds * 1000 : v.publishDate).toLocaleDateString() : "Unpublished Draft";

    return `
      <div class="entity-card video-card card" data-id="${v.id}">
        <div class="card-top-row">
          <div class="id-badge-group">
            <span class="entity-badge id-pill" onclick="window.copyText('${v.id}', 'Video ID')">
              ${v.id} <span class="copy-icon">📋</span>
            </span>
            <span class="platform-badge platform-${v.platform.toLowerCase()}">${v.platform} • ${v.contentType}</span>
          </div>
          <span class="status-pill ${statusClass}">${v.status}</span>
        </div>

        <h3 class="card-title">${escapeHtml(v.title)}</h3>

        ${v.captionHook ? `<div class="card-caption-preview">${escapeHtml(v.captionHook)}</div>` : ""}

        <div class="card-meta-row">
          <span class="meta-tag">📅 ${pubDateStr}</span>
          <span class="meta-tag">👤 ${escapeHtml(v.accountChannel || "@mybudgetdeal99")}</span>
        </div>

        <!-- Associated Products Showcase -->
        <div class="associated-products-box">
          <span class="box-label">Featured Amazon Deals (${products.length}):</span>
          ${products.length === 0 ? '<span class="empty-hint">No products linked yet.</span>' : `
            <div class="products-chip-list">
              ${products.map(p => `
                <div class="product-chip-card">
                  <div class="chip-info">
                    <strong>${p.id}: ${escapeHtml(p.productName)}</strong>
                    <span>${p.price ? `₹${p.price}` : "Deal"}</span>
                  </div>
                  <button class="btn btn-xs btn-accent" onclick="window.copyText('${escapeAttr(p.affiliateUrl)}', 'Affiliate Link')">
                    📋 Copy Link
                  </button>
                </div>
              `).join("")}
            </div>
          `}
        </div>

        <!-- Action Bar -->
        <div class="card-action-bar">
          ${v.videoUrl ? `
            <a href="${escapeAttr(v.videoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">
              ▶ Open Published Video
            </a>
            <button class="btn btn-sm btn-outline" onclick="window.copyText('${escapeAttr(v.videoUrl)}', 'Video URL')">
              📋 Copy Video URL
            </button>
          ` : `
            <span class="draft-indicator">Draft — No URL</span>
          `}
          <button class="btn btn-sm btn-ghost" onclick="window.openVideoModal('${v.id}')">
            ✏️ Edit
          </button>
          ${v.captionHook ? `
            <button class="btn btn-sm btn-ghost" onclick="window.copyText('${escapeAttr(v.captionHook)}', 'Caption')">
              📄 Copy Caption
            </button>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function setupContentEventListeners() {
  const btnAdd = document.getElementById("btn-add-content");
  if (btnAdd) {
    btnAdd.addEventListener("click", () => window.openVideoModal(null));
  }

  // Filter Pills
  document.querySelectorAll("#tab-content [data-filter-status]").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#tab-content [data-filter-status]").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const status = pill.getAttribute("data-filter-status");
      filterVideosByStatus(status);
    });
  });

  // Platform Filter Pills
  document.querySelectorAll("#content-platform-filters .cat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#content-platform-filters .cat-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const platform = pill.getAttribute("data-platform");
      filterVideosByPlatform(platform);
    });
  });
}

function filterVideosByStatus(status) {
  const listEl = document.getElementById("content-cards-list");
  if (!listEl) return;
  const all = Array.from(state.videos.values());
  const filtered = status === "ALL" ? all : all.filter(v => v.status === status);
  listEl.innerHTML = renderVideoCardsList(filtered);
}

function filterVideosByPlatform(platform) {
  const listEl = document.getElementById("content-cards-list");
  if (!listEl) return;
  const all = Array.from(state.videos.values());
  const filtered = platform === "ALL" ? all : all.filter(v => v.platform === platform);
  listEl.innerHTML = renderVideoCardsList(filtered);
}

// Modal Form for Add/Edit Video
window.openVideoModal = function(videoId = null) {
  const isEdit = Boolean(videoId);
  const vid = isEdit ? state.videos.get(videoId) : null;
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  // Find linked products
  const linkedProducts = isEdit ? getProductsForVideo(videoId) : [];
  const linkedProductIds = new Set(linkedProducts.map(p => p.id));
  const allProducts = Array.from(state.products.values()).filter(p => p.status !== "Archived");

  modalContainer.innerHTML = `
    <div class="modal-backdrop show">
      <div class="modal-sheet">
        <div class="modal-header">
          <h3>${isEdit ? `Edit Content: ${vid.id}` : "Log New Content / Video"}</h3>
          <button class="btn-close" onclick="window.closeModal()">&times;</button>
        </div>
        <form id="content-form" class="modal-body form-grid">
          <div class="form-group full-width">
            <label>Video Title *</label>
            <input type="text" id="v-title" required maxlength="250" value="${vid ? escapeAttr(vid.title) : ""}" placeholder="e.g. Best Smartwatch Under 1500 Rs with Bluetooth Calling" />
          </div>

          <div class="form-group">
            <label>Platform *</label>
            <select id="v-platform">
              <option value="Instagram" ${vid && vid.platform === "Instagram" ? "selected" : ""}>Instagram Reels</option>
              <option value="YouTube" ${vid && vid.platform === "YouTube" ? "selected" : ""}>YouTube Shorts</option>
              <option value="Telegram" ${vid && vid.platform === "Telegram" ? "selected" : ""}>Telegram</option>
              <option value="Facebook" ${vid && vid.platform === "Facebook" ? "selected" : ""}>Facebook</option>
              <option value="Pinterest" ${vid && vid.platform === "Pinterest" ? "selected" : ""}>Pinterest</option>
              <option value="Other" ${vid && vid.platform === "Other" ? "selected" : ""}>Other</option>
            </select>
          </div>

          <div class="form-group">
            <label>Content Format *</label>
            <select id="v-content-type">
              <option value="Reel" ${vid && vid.contentType === "Reel" ? "selected" : ""}>Reel (9:16)</option>
              <option value="Short" ${vid && vid.contentType === "Short" ? "selected" : ""}>Short (9:16)</option>
              <option value="Long-form Video" ${vid && vid.contentType === "Long-form Video" ? "selected" : ""}>Long-form Video</option>
              <option value="Post" ${vid && vid.contentType === "Post" ? "selected" : ""}>Post / Carousel</option>
              <option value="Story" ${vid && vid.contentType === "Story" ? "selected" : ""}>Story</option>
              <option value="Broadcast" ${vid && vid.contentType === "Broadcast" ? "selected" : ""}>Telegram Broadcast</option>
            </select>
          </div>

          <div class="form-group">
            <label>Publishing Status *</label>
            <select id="v-status">
              <option value="Draft" ${!vid || vid.status === "Draft" ? "selected" : ""}>Draft (Unpublished)</option>
              <option value="Published" ${vid && vid.status === "Published" ? "selected" : ""}>Published</option>
              ${isEdit ? `<option value="Archived" ${vid.status === "Archived" ? "selected" : ""}>Archived</option>` : ""}
            </select>
          </div>

          <div class="form-group">
            <label>Account / Channel</label>
            <input type="text" id="v-account" value="${vid ? escapeAttr(vid.accountChannel) : "@mybudgetdeal99"}" />
          </div>

          <div class="form-group full-width" id="published-url-group">
            <label>Published Video URL (Required if Published)</label>
            <input type="url" id="v-url" value="${vid && vid.videoUrl ? escapeAttr(vid.videoUrl) : ""}" placeholder="https://www.instagram.com/reel/... or https://youtube.com/shorts/..." />
          </div>

          <!-- Multi-Select Product Linker -->
          <div class="form-group full-width">
            <label>Feature Amazon Products in this Video:</label>
            <div class="product-picker-container" id="product-picker">
              ${allProducts.length === 0 ? '<p class="empty-hint">No products available in registry. Add products first.</p>' : allProducts.map(p => `
                <label class="product-picker-item">
                  <input type="checkbox" name="product-selector" value="${p.id}" ${linkedProductIds.has(p.id) ? "checked" : ""} />
                  <span class="picker-info">
                    <strong>${p.id}: ${escapeHtml(p.productName)}</strong>
                    <span class="picker-price">${p.price ? `₹${p.price}` : "Deal"} • ${p.category}</span>
                  </span>
                </label>
              `).join("")}
            </div>
          </div>

          <div class="form-group full-width">
            <div class="caption-header">
              <label>Caption & Hook / Script</label>
              <div id="compliance-pill" class="compliance-badge comp-passed">CHECKING</div>
            </div>
            <textarea id="v-caption" rows="3" placeholder="Paste opening hook and description... Include #ad and affiliate disclosure">${vid && vid.captionHook ? escapeHtml(vid.captionHook) : ""}</textarea>
            <div id="compliance-notes" class="compliance-notes-container"></div>
          </div>

          <div class="form-group full-width">
            <label>Search Tags (Comma-separated)</label>
            <input type="text" id="v-tags" value="${vid && Array.isArray(vid.searchTags) ? escapeAttr(vid.searchTags.join(", ")) : ""}" placeholder="deals, budgetdeal99, gadgets, viral" />
          </div>

          <div class="modal-footer full-width">
            ${isEdit && vid.status !== "Archived" ? `
              <button type="button" class="btn btn-outline-danger" id="btn-archive-vid">
                Archive Video
              </button>
            ` : ""}
            <button type="button" class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-vid">
              ${isEdit ? "Save Changes" : "Save Content"}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Real-time compliance check on caption
  const captionEl = document.getElementById("v-caption");
  const platformEl = document.getElementById("v-platform");
  const compPill = document.getElementById("compliance-pill");
  const compNotes = document.getElementById("compliance-notes");

  const runCompliance = () => {
    const res = validateContentCopy(captionEl.value, platformEl.value);
    compPill.className = `compliance-badge comp-${res.status.toLowerCase()}`;
    compPill.textContent = res.status;
    compNotes.innerHTML = res.notes.map(n => `<span class="comp-note-item">• ${n}</span>`).join("");
  };

  captionEl.addEventListener("input", runCompliance);
  platformEl.addEventListener("change", runCompliance);
  runCompliance();

  // Archive button
  const btnArchive = document.getElementById("btn-archive-vid");
  if (btnArchive) {
    btnArchive.addEventListener("click", async () => {
      if (confirm(`Archive video ${vid.id}? Links and comments will be preserved.`)) {
        btnArchive.disabled = true;
        try {
          await archiveVideo(vid.id);
          window.closeModal();
          renderContentView();
        } catch (err) {
          alert(`Archive failed: ${err.message}`);
          btnArchive.disabled = false;
        }
      }
    });
  }

  // Submit Handler
  document.getElementById("content-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("btn-submit-vid");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const statusVal = document.getElementById("v-status").value;
    const urlVal = document.getElementById("v-url").value.trim();

    if (statusVal === "Published" && !urlVal) {
      alert("A valid published video URL is required when status is set to Published.");
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "Save Changes" : "Save Content";
      return;
    }

    const selectedPids = Array.from(document.querySelectorAll("input[name='product-selector']:checked"))
      .map(cb => cb.value);

    const tags = document.getElementById("v-tags").value
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const payload = {
      title: document.getElementById("v-title").value,
      platform: document.getElementById("v-platform").value,
      contentType: document.getElementById("v-content-type").value,
      status: statusVal,
      accountChannel: document.getElementById("v-account").value,
      videoUrl: urlVal || null,
      captionHook: document.getElementById("v-caption").value || null,
      searchTags: tags
    };

    try {
      if (isEdit) {
        await updateVideo(videoId, payload, selectedPids);
      } else {
        await createVideo(payload, selectedPids);
      }
      window.closeModal();
      renderContentView();
    } catch (err) {
      alert(`Save Error: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "Save Changes" : "Save Content";
    }
  });
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  if (!str) return "";
  return String(str).replace(/"/g, "&quot;");
}
