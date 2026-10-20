// Tab C: Distribution Links & DM Template Engine
import { state, updateDistributionSettings } from "../services/db.js";
import { copyToClipboard } from "./ui-utils.js";

export function initDistributionTab() {
  const container = document.getElementById("tab-distribution");
  if (!container) return;

  renderDistributionView();
}

export function renderDistributionView() {
  const container = document.getElementById("tab-distribution");
  if (!container) return;

  const dist = state.distribution || {
    associateTag: "mybudgetdeal9-21",
    tagConfirmed: false,
    instagramProfileUrl: "https://instagram.com/mybudgetdeal99",
    youtubeChannelUrl: "https://youtube.com/@mybudgetdeal99",
    telegramChannelUrl: "https://t.me/budgetdeal99",
    standardCta: "⚡ Check bio link & comment for direct link! Join Telegram for daily flash deals.",
    affiliateDisclosure: "As an Amazon Associate I earn from qualifying purchases. #ad",
    dmTemplate: "Hi {username}! Here is the direct deal link for {product_name}: {affiliate_url} ⚡ Join our Telegram for deals before they expire: {telegram_url}"
  };

  const tagBadgeClass = dist.tagConfirmed ? "status-active" : "status-warn";
  const tagBadgeText = dist.tagConfirmed ? "Verified Tag" : "Unconfirmed Tag";

  container.innerHTML = `
    <div class="view-header">
      <div class="view-title">
        <h2>Distribution & Reusable Links</h2>
        <p>Centralized social channels, verified Amazon Associate credentials, and response templates</p>
      </div>
    </div>

    <div class="distribution-grid">
      <!-- Amazon Associates Tag & Official Disclosure Card -->
      <div class="card dist-card">
        <div class="card-header-row">
          <h3>Amazon Associates Credentials</h3>
          <span class="status-pill ${tagBadgeClass}">${tagBadgeText}</span>
        </div>
        <p class="section-desc">Confirmed Associate Tag used for generating compliant Amazon India links.</p>

        <div class="field-item">
          <label>Amazon Associate Tag:</label>
          <div class="copy-input-row">
            <input type="text" id="dist-tag" value="${escapeAttr(dist.associateTag)}" />
            <button class="btn btn-sm btn-outline" onclick="window.copyText(document.getElementById('dist-tag').value, 'Associate Tag')">
              📋 Copy Tag
            </button>
            <button class="btn btn-sm ${dist.tagConfirmed ? 'btn-ghost' : 'btn-accent'}" id="btn-toggle-tag-confirm">
              ${dist.tagConfirmed ? "Tag Confirmed ✓" : "Confirm Tag"}
            </button>
          </div>
        </div>

        <div class="field-item">
          <label>Official Operating Agreement Disclosure:</label>
          <div class="copy-input-row">
            <textarea id="dist-disclosure" rows="2" readonly>${escapeHtml(dist.affiliateDisclosure)}</textarea>
            <button class="btn btn-sm btn-outline" onclick="window.copyText(document.getElementById('dist-disclosure').value, 'Disclosure')">
              📋 Copy
            </button>
          </div>
        </div>
      </div>

      <!-- Social Media Channel Hub -->
      <div class="card dist-card">
        <div class="card-header-row">
          <h3>Target Channels & Profile Hub</h3>
        </div>
        <p class="section-desc">Master links for audience acquisition, bios, and broadcast channels.</p>

        <div class="field-item">
          <label>Telegram Channel (Primary Distribution):</label>
          <div class="copy-input-row">
            <input type="url" id="dist-telegram" value="${escapeAttr(dist.telegramChannelUrl)}" />
            <button class="btn btn-sm btn-outline" onclick="window.copyText(document.getElementById('dist-telegram').value, 'Telegram Link')">
              📋 Copy
            </button>
            <a href="${escapeAttr(dist.telegramChannelUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost">
              ↗ Open
            </a>
          </div>
        </div>

        <div class="field-item">
          <label>Instagram Profile:</label>
          <div class="copy-input-row">
            <input type="url" id="dist-instagram" value="${escapeAttr(dist.instagramProfileUrl || '')}" placeholder="https://instagram.com/mybudgetdeal99" />
            <button class="btn btn-sm btn-outline" onclick="window.copyText(document.getElementById('dist-instagram').value, 'Instagram Link')">
              📋 Copy
            </button>
            ${dist.instagramProfileUrl ? `<a href="${escapeAttr(dist.instagramProfileUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost">↗ Open</a>` : ""}
          </div>
        </div>

        <div class="field-item">
          <label>YouTube Channel:</label>
          <div class="copy-input-row">
            <input type="url" id="dist-youtube" value="${escapeAttr(dist.youtubeChannelUrl || '')}" placeholder="https://youtube.com/@mybudgetdeal99" />
            <button class="btn btn-sm btn-outline" onclick="window.copyText(document.getElementById('dist-youtube').value, 'YouTube Link')">
              📋 Copy
            </button>
            ${dist.youtubeChannelUrl ? `<a href="${escapeAttr(dist.youtubeChannelUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-ghost">↗ Open</a>` : ""}
          </div>
        </div>

        <button class="btn btn-sm btn-primary" id="btn-save-channels" style="margin-top:12px;">
          Save Channel Links
        </button>
      </div>

      <!-- Reusable Message & DM Template Engine -->
      <div class="card dist-card full-width">
        <div class="card-header-row">
          <h3>Dynamic DM & Comment Reply Template</h3>
        </div>
        <p class="section-desc">
          Automated template for answering follower requests. Supports tokens: 
          <code>{username}</code>, <code>{product_name}</code>, <code>{affiliate_url}</code>, <code>{telegram_url}</code>.
        </p>

        <div class="field-item">
          <textarea id="dist-dm-template" rows="3">${escapeHtml(dist.dmTemplate)}</textarea>
        </div>

        <div class="template-actions-row">
          <button class="btn btn-sm btn-outline" onclick="window.copyText(document.getElementById('dist-dm-template').value, 'DM Template')">
            📋 Copy Raw Template
          </button>
          <button class="btn btn-sm btn-primary" id="btn-save-template">
            Save Template
          </button>
        </div>

        <!-- Interactive Template Tester -->
        <div class="template-tester-box">
          <h4>⚡ Live Template Tester & Message Generator</h4>
          <div class="tester-controls-grid">
            <div>
              <label>Sample Username:</label>
              <input type="text" id="test-username" value="@rahul_deals" />
            </div>
            <div>
              <label>Select Sample Product:</label>
              <select id="test-product-picker">
                ${Array.from(state.products.values()).map(p => `
                  <option value="${p.id}">${p.id}: ${escapeHtml(p.productName)}</option>
                `).join("")}
              </select>
            </div>
          </div>

          <div class="preview-output-box">
            <label>Generated Result:</label>
            <div class="preview-text" id="test-preview-result"></div>
            <button class="btn btn-sm btn-accent" id="btn-copy-preview">
              📋 Copy Formatted Message
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  setupDistributionEventListeners();
}

function setupDistributionEventListeners() {
  // Toggle Tag Confirmation
  const btnToggle = document.getElementById("btn-toggle-tag-confirm");
  if (btnToggle) {
    btnToggle.addEventListener("click", async () => {
      const current = state.distribution ? state.distribution.tagConfirmed : false;
      const tagVal = document.getElementById("dist-tag").value.trim();
      try {
        await updateDistributionSettings({
          associateTag: tagVal,
          tagConfirmed: !current
        });
        renderDistributionView();
      } catch (err) {
        alert(`Update failed: ${err.message}`);
      }
    });
  }

  // Save Channels
  const btnSaveChannels = document.getElementById("btn-save-channels");
  if (btnSaveChannels) {
    btnSaveChannels.addEventListener("click", async () => {
      btnSaveChannels.disabled = true;
      try {
        await updateDistributionSettings({
          telegramChannelUrl: document.getElementById("dist-telegram").value.trim(),
          instagramProfileUrl: document.getElementById("dist-instagram").value.trim() || null,
          youtubeChannelUrl: document.getElementById("dist-youtube").value.trim() || null
        });
        alert("Channel links successfully updated!");
      } catch (err) {
        alert(`Save failed: ${err.message}`);
      } finally {
        btnSaveChannels.disabled = false;
      }
    });
  }

  // Save Template
  const btnSaveTemplate = document.getElementById("btn-save-template");
  if (btnSaveTemplate) {
    btnSaveTemplate.addEventListener("click", async () => {
      btnSaveTemplate.disabled = true;
      try {
        await updateDistributionSettings({
          dmTemplate: document.getElementById("dist-dm-template").value.trim()
        });
        alert("DM Template saved!");
      } catch (err) {
        alert(`Save failed: ${err.message}`);
      } finally {
        btnSaveTemplate.disabled = false;
      }
    });
  }

  // Live Tester
  const testUsername = document.getElementById("test-username");
  const testPicker = document.getElementById("test-product-picker");
  const previewBox = document.getElementById("test-preview-result");
  const templateBox = document.getElementById("dist-dm-template");

  const updatePreview = () => {
    if (!previewBox || !templateBox) return;
    const template = templateBox.value;
    const username = testUsername ? testUsername.value.trim() : "@follower";
    const selectedPid = testPicker ? testPicker.value : null;
    const prod = selectedPid ? state.products.get(selectedPid) : null;

    const prodName = prod ? prod.productName : "Sample Product";
    const affUrl = prod ? prod.affiliateUrl : "https://amzn.to/sample";
    const tgUrl = (state.distribution && state.distribution.telegramChannelUrl) || "https://t.me/budgetdeal99";

    const rendered = template
      .replace(/{username}/g, username)
      .replace(/{product_name}/g, prodName)
      .replace(/{affiliate_url}/g, affUrl)
      .replace(/{telegram_url}/g, tgUrl);

    previewBox.textContent = rendered;
  };

  if (testUsername) testUsername.addEventListener("input", updatePreview);
  if (testPicker) testPicker.addEventListener("change", updatePreview);
  if (templateBox) templateBox.addEventListener("input", updatePreview);
  updatePreview();

  const btnCopyPreview = document.getElementById("btn-copy-preview");
  if (btnCopyPreview) {
    btnCopyPreview.addEventListener("click", () => {
      if (previewBox) {
        copyToClipboard(previewBox.textContent, "Formatted Message");
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(str) {
  if (!str) return "";
  return String(str).replace(/"/g, "&quot;");
}
