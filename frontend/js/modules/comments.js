// Tab D: Comment and Follow-up Log Module
import { state, createComment, markCommentReplied, getProductsForVideo } from "../services/db.js";
import { copyToClipboard } from "./ui-utils.js";

export function initCommentsTab() {
  const container = document.getElementById("tab-comments");
  if (!container) return;

  renderCommentsView();
}

export function renderCommentsView() {
  const container = document.getElementById("tab-comments");
  if (!container) return;

  const comments = Array.from(state.comments.values());
  const pendingCount = comments.filter(c => c.responseStatus === "Pending").length;
  const repliedCount = comments.filter(c => c.responseStatus === "Replied").length;

  container.innerHTML = `
    <div class="view-header">
      <div class="view-title">
        <h2>Comment & Follow-up Log</h2>
        <p>Track follower link requests, resolve exact Amazon products, and dispatch DM responses</p>
      </div>
      <button class="btn btn-primary" id="btn-add-comment">
        <span>+</span> Log Comment
      </button>
    </div>

    <!-- Metrics Bar -->
    <div class="metrics-bar">
      <div class="metric-pill active" data-filter-status="ALL">
        <span>All Comments</span>
        <strong>${comments.length}</strong>
      </div>
      <div class="metric-pill" data-filter-status="Pending">
        <span>Awaiting Reply</span>
        <strong style="color:var(--warning);">${pendingCount}</strong>
      </div>
      <div class="metric-pill" data-filter-status="Replied">
        <span>Replied</span>
        <strong style="color:var(--accent);">${repliedCount}</strong>
      </div>
    </div>

    <!-- Platform Filter Pills -->
    <div class="category-scroll-bar" id="comment-platform-filters">
      <button class="cat-pill active" data-platform="ALL">All Platforms</button>
      <button class="cat-pill" data-platform="Instagram">Instagram</button>
      <button class="cat-pill" data-platform="YouTube">YouTube</button>
      <button class="cat-pill" data-platform="Telegram">Telegram</button>
    </div>

    <!-- Comments List -->
    <div class="cards-list" id="comments-cards-list">
      ${renderCommentCardsList(comments)}
    </div>
  `;

  setupCommentEventListeners();
}

function renderCommentCardsList(comments) {
  if (comments.length === 0) {
    return `
      <div class="empty-state card">
        <span class="empty-icon">💬</span>
        <h3>No Comments Logged</h3>
        <p>Log audience questions and link requests using the "+ Log Comment" button above.</p>
      </div>
    `;
  }

  return comments.map((c) => {
    const video = state.videos.get(c.videoId);
    const resolvedProduct = c.resolvedProductId ? state.products.get(c.resolvedProductId) : null;
    const isPending = c.responseStatus === "Pending";
    const statusClass = isPending ? "status-warn" : "status-active";
    const dateStr = c.dateReceived ? new Date(c.dateReceived.seconds ? c.dateReceived.seconds * 1000 : c.dateReceived).toLocaleString() : "Recent";
    const replyDateStr = c.repliedAt ? new Date(c.repliedAt.seconds ? c.repliedAt.seconds * 1000 : c.repliedAt).toLocaleString() : null;

    return `
      <div class="entity-card comment-card card" data-id="${c.id}">
        <div class="card-top-row">
          <div class="id-badge-group">
            <span class="entity-badge id-pill" onclick="window.copyText('${c.id}', 'Comment ID')">
              ${c.id} <span class="copy-icon">📋</span>
            </span>
            <span class="platform-badge platform-${c.platform.toLowerCase()}">${c.platform}</span>
            <span class="query-pill">${c.queryType}</span>
          </div>
          <span class="status-pill ${statusClass}">${c.responseStatus}</span>
        </div>

        <div class="comment-author-row">
          <strong class="author-name" onclick="window.copyText('${escapeAttr(c.username)}', 'Username')">
            👤 ${escapeHtml(c.username)} <span class="copy-icon">📋</span>
          </strong>
          <span class="comment-date">${dateStr}</span>
        </div>

        ${c.commentText ? `<div class="comment-quote">"${escapeHtml(c.commentText)}"</div>` : ""}

        <div class="comment-context-box">
          <div class="context-item">
            <span class="context-label">Video:</span>
            <strong>${video ? escapeHtml(video.title) : c.videoId}</strong>
          </div>
          <div class="context-item">
            <span class="context-label">Resolved Product:</span>
            ${resolvedProduct ? `
              <span class="resolved-chip">
                ${resolvedProduct.id}: ${escapeHtml(resolvedProduct.productName)}
                <button class="btn btn-xs btn-outline" onclick="window.copyText('${escapeAttr(resolvedProduct.affiliateUrl)}', 'Affiliate Link')">
                  📋 Copy Link
                </button>
              </span>
            ` : '<span class="unresolved-text">No product resolved</span>'}
          </div>
        </div>

        ${replyDateStr ? `<div class="reply-timestamp-note">Replied on: ${replyDateStr}</div>` : ""}

        <!-- Actions -->
        <div class="card-action-bar">
          <button class="btn btn-sm btn-accent" onclick="window.copyGeneratedDmForComment('${c.id}')">
            📋 Copy DM Response
          </button>
          ${isPending ? `
            <button class="btn btn-sm btn-primary" onclick="window.confirmReplySent('${c.id}')">
              ✓ Mark as Replied
            </button>
          ` : `
            <span class="replied-check">✓ Response Completed</span>
          `}
        </div>
      </div>
    `;
  }).join("");
}

function setupCommentEventListeners() {
  const btnAdd = document.getElementById("btn-add-comment");
  if (btnAdd) {
    btnAdd.addEventListener("click", () => window.openCommentModal());
  }

  // Filter Pills
  document.querySelectorAll("#tab-comments [data-filter-status]").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#tab-comments [data-filter-status]").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const status = pill.getAttribute("data-filter-status");
      filterCommentsByStatus(status);
    });
  });

  // Platform Filter Pills
  document.querySelectorAll("#comment-platform-filters .cat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#comment-platform-filters .cat-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const platform = pill.getAttribute("data-platform");
      filterCommentsByPlatform(platform);
    });
  });
}

function filterCommentsByStatus(status) {
  const listEl = document.getElementById("comments-cards-list");
  if (!listEl) return;
  const all = Array.from(state.comments.values());
  const filtered = status === "ALL" ? all : all.filter(c => c.responseStatus === status);
  listEl.innerHTML = renderCommentCardsList(filtered);
}

function filterCommentsByPlatform(platform) {
  const listEl = document.getElementById("comments-cards-list");
  if (!listEl) return;
  const all = Array.from(state.comments.values());
  const filtered = platform === "ALL" ? all : all.filter(c => c.platform === platform);
  listEl.innerHTML = renderCommentCardsList(filtered);
}

// Modal for Logging Comment
window.openCommentModal = function() {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  const allVideos = Array.from(state.videos.values());

  modalContainer.innerHTML = `
    <div class="modal-backdrop show">
      <div class="modal-sheet">
        <div class="modal-header">
          <h3>Log Follower Comment / Request</h3>
          <button class="btn-close" onclick="window.closeModal()">&times;</button>
        </div>
        <form id="comment-form" class="modal-body form-grid">
          <div class="form-group">
            <label>Platform *</label>
            <select id="c-platform">
              <option value="Instagram">Instagram</option>
              <option value="YouTube">YouTube</option>
              <option value="Telegram">Telegram</option>
            </select>
          </div>

          <div class="form-group">
            <label>Username / Handle *</label>
            <input type="text" id="c-username" required maxlength="100" placeholder="e.g. @priya_k" />
          </div>

          <div class="form-group full-width">
            <label>Select Video / Reel *</label>
            <select id="c-video" required>
              <option value="">-- Choose video where comment was received --</option>
              ${allVideos.map(v => `
                <option value="${v.id}">${v.id} (${v.platform}): ${escapeHtml(v.title)}</option>
              `).join("")}
            </select>
          </div>

          <!-- Auto-Resolved / Choice Product Picker -->
          <div class="form-group full-width" id="c-product-group">
            <label>Requested Amazon Product:</label>
            <select id="c-product">
              <option value="">-- Select video first to load featured products --</option>
            </select>
            <small class="form-hint" id="c-product-hint">Automatically resolves if video features 1 product.</small>
          </div>

          <div class="form-group">
            <label>Query Type *</label>
            <select id="c-query-type">
              <option value="Link">Link Request (e.g. "link please", "dm link")</option>
              <option value="Price">Price Query</option>
              <option value="Details">Specifications / Details</option>
              <option value="Custom">Custom Question</option>
            </select>
          </div>

          <div class="form-group">
            <label>Initial Response Status</label>
            <select id="c-status">
              <option value="Pending">Pending (Not yet replied)</option>
              <option value="Replied">Already Replied</option>
            </select>
          </div>

          <div class="form-group full-width">
            <label>Comment Text (Optional)</label>
            <textarea id="c-text" rows="2" placeholder="e.g. Can you share the buy link?"></textarea>
          </div>

          <!-- Generated Preview -->
          <div class="form-group full-width preview-container" id="c-preview-container" style="display:none;">
            <label>⚡ Ready-to-Send DM Message:</label>
            <div class="preview-text" id="c-dm-preview"></div>
            <button type="button" class="btn btn-xs btn-accent" id="btn-copy-modal-dm">
              📋 Copy Message
            </button>
          </div>

          <div class="modal-footer full-width">
            <button type="button" class="btn btn-outline" onclick="window.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-comment">Save Comment Log</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const videoSelect = document.getElementById("c-video");
  const productSelect = document.getElementById("c-product");
  const productHint = document.getElementById("c-product-hint");
  const previewContainer = document.getElementById("c-preview-container");
  const dmPreview = document.getElementById("c-dm-preview");
  const usernameInput = document.getElementById("c-username");

  const updateModalPreview = () => {
    const username = usernameInput.value.trim() || "@follower";
    const pid = productSelect.value;
    const prod = pid ? state.products.get(pid) : null;
    const template = (state.distribution && state.distribution.dmTemplate) || "Hi {username}! Link: {affiliate_url} ⚡ Join Telegram: {telegram_url}";
    const tgUrl = (state.distribution && state.distribution.telegramChannelUrl) || "https://t.me/budgetdeal99";

    if (prod) {
      previewContainer.style.display = "block";
      const rendered = template
        .replace(/{username}/g, username)
        .replace(/{product_name}/g, prod.productName)
        .replace(/{affiliate_url}/g, prod.affiliateUrl)
        .replace(/{telegram_url}/g, tgUrl);
      dmPreview.textContent = rendered;
    } else {
      previewContainer.style.display = "none";
    }
  };

  videoSelect.addEventListener("change", () => {
    const vid = videoSelect.value;
    if (!vid) {
      productSelect.innerHTML = '<option value="">-- Choose video first --</option>';
      updateModalPreview();
      return;
    }

    const linkedProds = getProductsForVideo(vid);
    if (linkedProds.length === 0) {
      productSelect.innerHTML = '<option value="">No products linked to this video</option>';
      productHint.textContent = "Warning: No products associated with this video.";
    } else if (linkedProds.length === 1) {
      productSelect.innerHTML = `<option value="${linkedProds[0].id}">${linkedProds[0].id}: ${escapeHtml(linkedProds[0].productName)}</option>`;
      productHint.textContent = "Automatically resolved (Video features 1 product).";
    } else {
      productSelect.innerHTML = `
        <option value="">-- Choose which product was requested (${linkedProds.length} options) --</option>
        ${linkedProds.map(p => `<option value="${p.id}">${p.id}: ${escapeHtml(p.productName)}</option>`).join("")}
      `;
      productHint.textContent = "Multiple products featured. Please select the specific deal requested.";
    }
    updateModalPreview();
  });

  productSelect.addEventListener("change", updateModalPreview);
  usernameInput.addEventListener("input", updateModalPreview);

  document.getElementById("btn-copy-modal-dm").addEventListener("click", () => {
    if (dmPreview) copyToClipboard(dmPreview.textContent, "DM Message");
  });

  // Submit Handler
  document.getElementById("comment-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("btn-submit-comment");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const payload = {
      platform: document.getElementById("c-platform").value,
      username: document.getElementById("c-username").value,
      videoId: document.getElementById("c-video").value,
      resolvedProductId: document.getElementById("c-product").value || null,
      queryType: document.getElementById("c-query-type").value,
      responseStatus: document.getElementById("c-status").value,
      commentText: document.getElementById("c-text").value || null
    };

    try {
      await createComment(payload);
      window.closeModal();
      renderCommentsView();
    } catch (err) {
      alert(`Save Error: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Comment Log";
    }
  });
};

// Copy DM response helper: copying does NOT mark replied!
window.copyGeneratedDmForComment = function(commentId) {
  const c = state.comments.get(commentId);
  if (!c) return;
  const prod = c.resolvedProductId ? state.products.get(c.resolvedProductId) : null;
  const template = (state.distribution && state.distribution.dmTemplate) || "Hi {username}! Link: {affiliate_url} ⚡ Join Telegram: {telegram_url}";
  const tgUrl = (state.distribution && state.distribution.telegramChannelUrl) || "https://t.me/budgetdeal99";

  const rendered = template
    .replace(/{username}/g, c.username)
    .replace(/{product_name}/g, prod ? prod.productName : "the requested product")
    .replace(/{affiliate_url}/g, prod ? prod.affiliateUrl : "link unavailable")
    .replace(/{telegram_url}/g, tgUrl);

  copyToClipboard(rendered, "DM Response");
};

// Explicit Mark as Replied Confirmation
window.confirmReplySent = async function(commentId) {
  if (confirm(`Confirm that you have sent the reply to ${commentId}? Status will change to Replied.`)) {
    try {
      await markCommentReplied(commentId);
      renderCommentsView();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  }
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  if (!str) return "";
  return String(str).replace(/"/g, "&quot;");
}
