// Budget Deal 99 ACMS - SPA Client Orchestrator
import { initAuth, getCurrentUser, isOperatorVerified, loginOperator, logoutOperator, requestPasswordReset, OPERATOR_EMAIL } from "./js/services/auth.js";
import { state, syncAllWorkingSets, getProductsForVideo } from "./js/services/db.js";
import { executeSearch, executeCloudTokenSearch } from "./js/services/search.js";
import { exportFullDatabaseBackup, inspectBackupPreflight, executeSafeMerge } from "./js/services/backup.js";
import { initProductsTab, renderProductsView } from "./js/modules/products.js";
import { initContentTab, renderContentView } from "./js/modules/content.js";
import { initDistributionTab, renderDistributionView } from "./js/modules/distribution.js";
import { initCommentsTab, renderCommentsView } from "./js/modules/comments.js";
import { copyToClipboard, showToast } from "./js/modules/ui-utils.js";

let activeTab = "tab-dashboard";

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupGlobalActions();

  // Initialize Auth Observer
  initAuth((user, isVerified) => {
    updateAuthUI(user, isVerified);
  });

  // Initial Sync from Firestore
  try {
    showSyncIndicator(true, "Connecting to Cloud Firestore...");
    await syncAllWorkingSets();
    showSyncIndicator(false, "Connected & Synced");
    renderActiveTab();
  } catch (err) {
    console.error("Initial Firestore sync error:", err);
    showSyncIndicator(false, "Sync Error (Check Auth)");
    renderActiveTab();
  }
});

// =============================================================================
// 1. Navigation & View Routing
// =============================================================================

function setupNavigation() {
  const navButtons = document.querySelectorAll("[data-tab-target]");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab-target");
      switchTab(targetId);
    });
  });
}

export function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll("[data-tab-target]").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-tab-target") === tabId);
  });

  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.toggle("active", pane.id === tabId);
  });

  renderActiveTab();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.switchTab = switchTab;

function renderActiveTab() {
  if (activeTab === "tab-dashboard") renderDashboardView();
  else if (activeTab === "tab-products") renderProductsView();
  else if (activeTab === "tab-content") renderContentView();
  else if (activeTab === "tab-distribution") renderDistributionView();
  else if (activeTab === "tab-comments") renderCommentsView();
}

// =============================================================================
// 2. Dashboard View & Operational Metrics
// =============================================================================

function renderDashboardView() {
  const container = document.getElementById("tab-dashboard");
  if (!container) return;

  const products = Array.from(state.products.values());
  const videos = Array.from(state.videos.values());
  const comments = Array.from(state.comments.values());

  const activeProducts = products.filter(p => p.status === "Active").length;
  const recheckProducts = products.filter(p => p.status === "Unavailable" || p.status === "Recheck").length;

  const pubVideos = videos.filter(v => v.status === "Published").length;
  const draftVideos = videos.filter(v => v.status === "Draft").length;

  const pendingComments = comments.filter(c => c.responseStatus === "Pending").length;

  container.innerHTML = `
    <div class="view-header">
      <div class="view-title">
        <h2>Operational Dashboard</h2>
        <p>Budget Deal 99 Content Management & Distribution Center</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" id="btn-refresh-cloud">
          🔄 Refresh
        </button>
      </div>
    </div>

    <!-- Metric Tiles Grid -->
    <div class="dashboard-metrics-grid">
      <div class="stat-card card" onclick="window.switchTab('tab-products')">
        <div class="stat-icon">🏷️</div>
        <div class="stat-data">
          <span class="stat-label">Product Registry</span>
          <div class="stat-number">${products.length}</div>
          <span class="stat-sub text-accent">${activeProducts} Active Deals</span>
          ${recheckProducts > 0 ? `<span class="stat-alert">⚠️ ${recheckProducts} Need Check</span>` : ""}
        </div>
      </div>

      <div class="stat-card card" onclick="window.switchTab('tab-content')">
        <div class="stat-icon">🎬</div>
        <div class="stat-data">
          <span class="stat-label">Content Library</span>
          <div class="stat-number">${videos.length}</div>
          <span class="stat-sub text-accent">${pubVideos} Published Videos</span>
          <span class="stat-sub text-warn">${draftVideos} Drafts</span>
        </div>
      </div>

      <div class="stat-card card" onclick="window.switchTab('tab-comments')">
        <div class="stat-icon">💬</div>
        <div class="stat-data">
          <span class="stat-label">Pending Follow-ups</span>
          <div class="stat-number" style="color:var(--warning);">${pendingComments}</div>
          <span class="stat-sub">Comments Awaiting Link</span>
        </div>
      </div>

      <div class="stat-card card" onclick="window.switchTab('tab-distribution')">
        <div class="stat-icon">⚡</div>
        <div class="stat-data">
          <span class="stat-label">Telegram & Channels</span>
          <div class="stat-number">Active</div>
          <span class="stat-sub text-accent">t.me/budgetdeal99</span>
        </div>
      </div>
    </div>

    <!-- Quick Action Launchpad -->
    <div class="card launchpad-card">
      <h3>⚡ Quick Actions</h3>
      <div class="launchpad-grid">
        <button class="btn btn-primary" onclick="window.openProductModal(null)">
          <span>+</span> Add Amazon Deal
        </button>
        <button class="btn btn-primary" onclick="window.openVideoModal(null)">
          <span>+</span> Log Content / Reel
        </button>
        <button class="btn btn-accent" onclick="window.openCommentModal()">
          <span>+</span> Log Follower Request
        </button>
        <button class="btn btn-outline" onclick="window.openSearchOverlay()">
          <span>🔍</span> Multi-Entity Search
        </button>
        <button class="btn btn-outline" onclick="window.openBackupModal()">
          <span>🛡️</span> Backup & Safe Merge
        </button>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="card recent-section">
      <h3>Recent Registered Deals</h3>
      <div class="recent-list">
        ${products.slice(0, 5).map(p => `
          <div class="recent-item">
            <span class="recent-id">${p.id}</span>
            <strong class="recent-name">${escapeHtml(p.productName)}</strong>
            <span class="recent-tag">${p.category}</span>
            <button class="btn btn-xs btn-outline" onclick="window.copyText('${escapeAttr(p.affiliateUrl)}', 'Affiliate Link')">
              📋 Copy Link
            </button>
          </div>
        `).join("") || '<p class="empty-hint">No products logged yet.</p>'}
      </div>
    </div>
  `;

  document.getElementById("btn-refresh-cloud").addEventListener("click", async () => {
    showSyncIndicator(true, "Refreshing...");
    try {
      await syncAllWorkingSets();
      showToast("Cloud sync complete!", "success");
      renderActiveTab();
    } catch (e) {
      showToast(`Refresh error: ${e.message}`, "danger");
    } finally {
      showSyncIndicator(false, "Synced");
    }
  });
}

// =============================================================================
// 3. Search Overlay & UI Router
// =============================================================================

window.openSearchOverlay = function() {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop show">
      <div class="modal-sheet search-sheet">
        <div class="modal-header">
          <h3>Universal ACMS Search</h3>
          <button class="btn-close" onclick="window.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="search-input-box">
            <input type="text" id="global-search-input" placeholder="Search by exact ID (BD99-P0001), ASIN (B08...), title, or keyword..." autofocus />
            <button class="btn btn-accent" id="btn-cloud-token-search">Cloud Token Search</button>
          </div>
          <div class="search-scope-bar" id="search-scope-status">
            Type an exact ID, ASIN, or keyword.
          </div>
          <div class="search-results-container" id="search-results-list"></div>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById("global-search-input");
  const scopeBar = document.getElementById("search-scope-status");
  const resultsContainer = document.getElementById("search-results-list");
  const btnCloud = document.getElementById("btn-cloud-token-search");

  const runSearch = async () => {
    const val = input.value.trim();
    if (!val) {
      scopeBar.textContent = "Type an exact ID, ASIN, or keyword.";
      resultsContainer.innerHTML = "";
      return;
    }

    scopeBar.textContent = "Searching...";
    try {
      const res = await executeSearch(val, "ALL");
      scopeBar.textContent = res.scopeLabel;
      resultsContainer.innerHTML = renderSearchResults(res.results);
    } catch (err) {
      scopeBar.textContent = `Search Error: ${err.message}`;
    }
  };

  input.addEventListener("input", debounce(runSearch, 250));

  btnCloud.addEventListener("click", async () => {
    const val = input.value.trim();
    if (!val) return;
    scopeBar.textContent = "Executing Cloud Token Query on Firestore...";
    try {
      const res = await executeCloudTokenSearch(val);
      scopeBar.textContent = res.scopeLabel;
      resultsContainer.innerHTML = renderSearchResults(res.results);
    } catch (err) {
      scopeBar.textContent = `Cloud Search Error: ${err.message}`;
    }
  });
};

function renderSearchResults(results) {
  if (results.length === 0) {
    return '<div class="empty-state"><p>No records found matching query.</p></div>';
  }

  return results.map(r => {
    const d = r.data;
    const badgeClass = `entity-badge-${r.entityType.toLowerCase()}`;

    if (r.entityType === "PRODUCT") {
      return `
        <div class="search-result-card">
          <div class="res-top">
            <span class="res-badge ${badgeClass}">PRODUCT</span>
            <span class="res-id">${d.id}</span>
            ${d.asin ? `<span class="res-asin">ASIN: ${d.asin}</span>` : ""}
            <span class="res-status">${d.status}</span>
          </div>
          <h4>${escapeHtml(d.productName)}</h4>
          <div class="res-meta">${d.category} • ${d.price ? `₹${d.price}` : "Deal"}</div>
          <div class="res-actions">
            <button class="btn btn-xs btn-accent" onclick="window.copyText('${escapeAttr(d.affiliateUrl)}', 'Affiliate Link')">
              📋 Copy Link
            </button>
            <a href="${escapeAttr(d.amazonProductUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-outline">
              ↗ Amazon
            </a>
            <button class="btn btn-xs btn-ghost" onclick="window.closeModal(); window.openProductModal('${d.id}')">
              ✏️ Edit
            </button>
          </div>
        </div>
      `;
    }

    if (r.entityType === "VIDEO") {
      return `
        <div class="search-result-card">
          <div class="res-top">
            <span class="res-badge ${badgeClass}">VIDEO</span>
            <span class="res-id">${d.id}</span>
            <span class="res-platform">${d.platform} • ${d.contentType}</span>
          </div>
          <h4>${escapeHtml(d.title)}</h4>
          <div class="res-actions">
            ${d.videoUrl ? `<a href="${escapeAttr(d.videoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-primary">▶ Open Video</a>` : '<span class="draft-indicator">Draft</span>'}
            <button class="btn btn-xs btn-ghost" onclick="window.closeModal(); window.openVideoModal('${d.id}')">
              ✏️ Edit
            </button>
          </div>
        </div>
      `;
    }

    if (r.entityType === "COMMENT") {
      return `
        <div class="search-result-card">
          <div class="res-top">
            <span class="res-badge ${badgeClass}">COMMENT</span>
            <span class="res-id">${d.id}</span>
            <span class="res-platform">${d.platform}</span>
            <span class="res-status">${d.responseStatus}</span>
          </div>
          <h4>👤 ${escapeHtml(d.username)}: "${escapeHtml(d.commentText || d.queryType)}"</h4>
          <div class="res-actions">
            <button class="btn btn-xs btn-accent" onclick="window.copyGeneratedDmForComment('${d.id}')">
              📋 Copy DM Reply
            </button>
          </div>
        </div>
      `;
    }
  }).join("");
}

// =============================================================================
// 4. Data Safety: Backup & Safe Merge Modal
// =============================================================================

window.openBackupModal = function() {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop show">
      <div class="modal-sheet">
        <div class="modal-header">
          <h3>🛡️ Data Safety, Export & Safe Merge</h3>
          <button class="btn-close" onclick="window.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="backup-section card">
            <h4>Export Database Snapshot</h4>
            <p>Download all Products, Videos, Bridge Links, and Comments into a single timestamped JSON file.</p>
            <button class="btn btn-primary" id="btn-run-export">
              ⬇ Download Full JSON Backup
            </button>
          </div>

          <div class="backup-section card">
            <h4>Safe Merge Restore (Create-Only)</h4>
            <p>Upload a previously exported JSON backup. Safe Merge guarantees existing records and reservations are never overwritten.</p>
            <input type="file" id="backup-file-input" accept=".json" class="file-picker" />
            <div id="preflight-report-box" style="display:none;" class="preflight-box"></div>
            <button class="btn btn-accent" id="btn-start-safe-merge" style="display:none;">
              Execute Safe Merge Restore
            </button>
            <div id="restore-progress-box" style="display:none;" class="progress-box"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-run-export").addEventListener("click", async () => {
    try {
      showToast("Generating backup...", "info");
      await exportFullDatabaseBackup();
      showToast("Backup downloaded successfully!", "success");
    } catch (e) {
      alert(`Export Error: ${e.message}`);
    }
  });

  const fileInput = document.getElementById("backup-file-input");
  const preflightBox = document.getElementById("preflight-report-box");
  const btnMerge = document.getElementById("btn-start-safe-merge");
  const progressBox = document.getElementById("restore-progress-box");
  let parsedBackup = null;

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      preflightBox.style.display = "block";
      preflightBox.innerHTML = "<p>Inspecting backup file and checking Firestore conflicts...</p>";
      
      const text = await file.text();
      parsedBackup = JSON.parse(text);
      const report = await inspectBackupPreflight(parsedBackup);

      preflightBox.innerHTML = `
        <h5>Preflight Inspection Report:</h5>
        <ul>
          <li><strong>Total Items:</strong> ${report.totalItems}</li>
          <li><strong>Products Safe to Import:</strong> ${report.products.safe} (${report.products.skippedId} existing IDs skipped, ${report.products.skippedAsin} ASIN conflicts skipped)</li>
          <li><strong>Videos Safe to Import:</strong> ${report.videos.safe} (${report.videos.skipped} existing IDs skipped)</li>
          <li><strong>Comments Safe to Import:</strong> ${report.comments.safe} (${report.comments.skipped} existing IDs skipped)</li>
        </ul>
        <p class="safe-merge-guarantee">✓ Safe Merge Guarantee: No existing record or reservation will be overwritten.</p>
      `;

      btnMerge.style.display = "inline-flex";
    } catch (err) {
      preflightBox.innerHTML = `<p class="text-danger">Invalid Backup: ${err.message}</p>`;
      btnMerge.style.display = "none";
    }
  });

  btnMerge.addEventListener("click", async () => {
    if (!parsedBackup) return;
    btnMerge.disabled = true;
    progressBox.style.display = "block";
    progressBox.textContent = "Starting Safe Merge...";

    try {
      const outcome = await executeSafeMerge(parsedBackup, (prog) => {
        progressBox.innerHTML = `
          <div>Progress: ${prog.processed} / ${prog.total} (${prog.percent}%)</div>
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${prog.percent}%;"></div></div>
        `;
      });

      alert(`Safe Merge Complete!\nImported: ${outcome.imported.length}\nSkipped Existing: ${outcome.skippedExisting.length}\nSkipped ASIN Conflicts: ${outcome.skippedAsinConflict.length}`);
      window.closeModal();
      await syncAllWorkingSets();
      renderActiveTab();
    } catch (err) {
      alert(`Restore Error: ${err.message}`);
      btnMerge.disabled = false;
    }
  });
};

// =============================================================================
// 5. Operator Authentication & Status UI
// =============================================================================

function updateAuthUI(user, isVerified) {
  const authPill = document.getElementById("auth-status-pill");
  if (!authPill) return;

  if (user && isVerified) {
    authPill.className = "auth-pill auth-verified";
    authPill.innerHTML = `<span>🔒 Operator Verified (${escapeHtml(user.email)})</span>`;
  } else if (user) {
    authPill.className = "auth-pill auth-unverified";
    authPill.innerHTML = `<span>⚠️ Email Unverified (${escapeHtml(user.email)})</span>`;
  } else {
    authPill.className = "auth-pill auth-guest";
    authPill.innerHTML = `<span>🔓 Sign In Required</span>`;
  }
}

window.openAuthModal = function() {
  const modalContainer = document.getElementById("modal-container");
  if (!modalContainer) return;

  const user = getCurrentUser();
  const isVerified = isOperatorVerified();

  modalContainer.innerHTML = `
    <div class="modal-backdrop show">
      <div class="modal-sheet">
        <div class="modal-header">
          <h3>Operator Authentication</h3>
          <button class="btn-close" onclick="window.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          ${user ? `
            <div class="card auth-user-card">
              <p><strong>Signed in as:</strong> ${escapeHtml(user.email)}</p>
              <p><strong>Status:</strong> ${isVerified ? "✓ Verified Operator" : "⚠️ Email Unverified (Check inbox for verification email)"}</p>
              <button class="btn btn-outline-danger" id="btn-logout-operator">Sign Out</button>
            </div>
          ` : `
            <form id="auth-login-form" class="form-grid">
              <div class="form-group full-width">
                <label>Operator Email</label>
                <input type="email" id="auth-email" required value="${OPERATOR_EMAIL}" />
              </div>
              <div class="form-group full-width">
                <label>Password</label>
                <input type="password" id="auth-password" required placeholder="Enter operator password" />
              </div>
              <div class="modal-footer full-width">
                <button type="button" class="btn btn-ghost" id="btn-reset-pw">Forgot Password?</button>
                <button type="submit" class="btn btn-primary" id="btn-login-submit">Sign In</button>
              </div>
            </form>
          `}
        </div>
      </div>
    </div>
  `;

  if (user) {
    document.getElementById("btn-logout-operator").addEventListener("click", async () => {
      await logoutOperator();
      window.closeModal();
      showToast("Signed out.", "info");
    });
  } else {
    document.getElementById("auth-login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("auth-email").value;
      const pw = document.getElementById("auth-password").value;
      const btn = document.getElementById("btn-login-submit");
      btn.disabled = true;
      btn.textContent = "Signing In...";

      try {
        await loginOperator(email, pw);
        window.closeModal();
        showToast("Signed in successfully!", "success");
        await syncAllWorkingSets();
        renderActiveTab();
      } catch (err) {
        alert(`Login failed: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = "Sign In";
      }
    });

    document.getElementById("btn-reset-pw").addEventListener("click", async () => {
      const email = document.getElementById("auth-email").value;
      try {
        await requestPasswordReset(email);
        alert(`Password reset email sent to ${email}. Please check your inbox.`);
      } catch (err) {
        alert(`Reset error: ${err.message}`);
      }
    });
  }
};

// =============================================================================
// 6. Global Header Actions & Status Utilities
// =============================================================================

function setupGlobalActions() {
  const btnSearchTrigger = document.getElementById("btn-trigger-search");
  if (btnSearchTrigger) btnSearchTrigger.addEventListener("click", () => window.openSearchOverlay());

  const btnAuthTrigger = document.getElementById("auth-status-pill");
  if (btnAuthTrigger) btnAuthTrigger.addEventListener("click", () => window.openAuthModal());

  const btnBackupTrigger = document.getElementById("btn-trigger-backup");
  if (btnBackupTrigger) btnBackupTrigger.addEventListener("click", () => window.openBackupModal());
}

function showSyncIndicator(isLoading, statusText) {
  const el = document.getElementById("cloud-sync-status");
  if (el) {
    el.textContent = statusText;
    el.classList.toggle("syncing", isLoading);
  }
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  if (!str) return "";
  return String(str).replace(/"/g, "&quot;");
}
