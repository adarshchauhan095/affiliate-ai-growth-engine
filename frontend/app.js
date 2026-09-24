// AI Affiliate Growth Engine - Client Application Logic
const API_BASE = window.location.origin;

let activeTab = 'tab-discovery';
let productsData = [];
let selectedProductId = null;
let variantsData = [];

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const productGrid = document.getElementById('product-grid');
const urlImportForm = document.getElementById('url-import-form');
const importInput = document.getElementById('import-input');
const btnRefresh = document.getElementById('btn-refresh-data');
const btnProcessWorker = document.getElementById('btn-process-worker');
const studioSelector = document.getElementById('studio-product-selector');
const studioVariantsContainer = document.getElementById('studio-variants-container');
const btnGenerateAngles = document.getElementById('btn-generate-angles');
const studioActiveTitle = document.getElementById('studio-active-product-title');
const studioActiveSub = document.getElementById('studio-active-product-sub');
const approvalsList = document.getElementById('approvals-list');
const publishingQueueList = document.getElementById('publishing-queue-list');
const platformStatsBody = document.getElementById('platform-stats-body');
const productStatsBody = document.getElementById('product-stats-body');
const strategiesGrid = document.getElementById('strategies-grid');
const btnRunGrowthCycle = document.getElementById('btn-run-growth-cycle');
const videoModal = document.getElementById('video-modal');
const modalVideoPlayer = document.getElementById('modal-video-player');
const modalClose = document.getElementById('modal-close');

// Tab Configuration
const tabMeta = {
  'tab-discovery': {
    title: 'Product Discovery & Intelligence',
    sub: 'Discover high-converting Amazon deals, evaluate 7-factor virality scores, and inject affiliate tags.'
  },
  'tab-content': {
    title: 'Content & Video Studio',
    sub: 'Original marketing angles, hooks, and local procedural vertical 9:16 video generation.'
  },
  'tab-approvals': {
    title: 'Compliance & Approval Queue',
    sub: 'Strict FTC disclosure verification, Amazon operating agreement checks, and trademark safety.'
  },
  'tab-publishing': {
    title: 'Publishing & Multi-Channel Queue',
    sub: 'Scheduled posts across Instagram Reels, YouTube Shorts, Pinterest Pins, and GitHub Pages.'
  },
  'tab-analytics': {
    title: 'Revenue & Channel Attribution',
    sub: 'Attributed affiliate clicks, conversions, orders, and revenue per mille (RPM).'
  },
  'tab-growth': {
    title: 'AI Growth Strategist',
    sub: 'Autonomous feedback loop analyzing performance anomalies and generating optimization actions.'
  }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupEventListeners();
  loadTelemetry();
  loadProducts();
  loadAnalytics();
  loadStrategies();
  setInterval(loadTelemetry, 10000); // 10s heartbeat poll
});

function setupTabs() {
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      navItems.forEach(i => i.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      activeTab = tabId;

      pageTitle.textContent = tabMeta[tabId].title;
      pageSubtitle.textContent = tabMeta[tabId].sub;

      if (tabId === 'tab-approvals') loadApprovals();
      if (tabId === 'tab-publishing') loadPublishingQueue();
      if (tabId === 'tab-analytics') loadAnalytics();
      if (tabId === 'tab-growth') loadStrategies();
    });
  });
}

function setupEventListeners() {
  btnRefresh.addEventListener('click', () => {
    loadTelemetry();
    loadProducts();
    if (activeTab === 'tab-approvals') loadApprovals();
    if (activeTab === 'tab-publishing') loadPublishingQueue();
    if (activeTab === 'tab-analytics') loadAnalytics();
    if (activeTab === 'tab-growth') loadStrategies();
  });

  btnProcessWorker.addEventListener('click', async () => {
    btnProcessWorker.disabled = true;
    btnProcessWorker.textContent = 'Processing...';
    try {
      const res = await fetch(`${API_BASE}/api/worker/process-next`, { method: 'POST' });
      const data = await res.json();
      alert(`Worker Job Result: ${JSON.stringify(data.result || data.message)}`);
      loadTelemetry();
      loadPublishingQueue();
    } catch (e) {
      alert(`Error running worker: ${e.message}`);
    } finally {
      btnProcessWorker.disabled = false;
      btnProcessWorker.innerHTML = '<span class="btn-icon">⚡</span> Run Worker Job';
    }
  });

  urlImportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = importInput.value.trim();
    if (!val) return;

    try {
      const res = await fetch(`${API_BASE}/api/products/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_or_asin: val })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Success! Imported ASIN ${data.product.asin} with Score: ${data.score.overall_score}`);
        importInput.value = '';
        loadProducts();
      } else {
        alert(`Import Error: ${data.detail || 'Failed'}`);
      }
    } catch (err) {
      alert(`Network Error: ${err.message}`);
    }
  });

  btnGenerateAngles.addEventListener('click', async () => {
    if (!selectedProductId) return;
    btnGenerateAngles.disabled = true;
    btnGenerateAngles.textContent = 'Generating...';
    try {
      const res = await fetch(`${API_BASE}/api/products/${selectedProductId}/generate-content`, { method: 'POST' });
      const data = await res.json();
      renderStudioVariants(data.variants);
    } catch (e) {
      alert(`Generation Error: ${e.message}`);
    } finally {
      btnGenerateAngles.disabled = false;
      btnGenerateAngles.textContent = '✨ Regenerate 4 Angles';
    }
  });

  btnRunGrowthCycle.addEventListener('click', async () => {
    btnRunGrowthCycle.disabled = true;
    btnRunGrowthCycle.textContent = 'Analyzing...';
    try {
      const res = await fetch(`${API_BASE}/api/growth/evaluate`, { method: 'POST' });
      const data = await res.json();
      alert(`Strategic Cycle Complete! Generated ${data.generated_strategies_count} growth recommendations.`);
      loadStrategies();
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      btnRunGrowthCycle.disabled = false;
      btnRunGrowthCycle.textContent = '🧠 Run Strategic Analysis Cycle';
    }
  });

  modalClose.addEventListener('click', () => {
    modalVideoPlayer.pause();
    videoModal.classList.remove('show');
  });

  // Filter Buttons
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.getAttribute('data-cat');
      filterProducts(cat);
    });
  });

  document.getElementById('product-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = productsData.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.asin.toLowerCase().includes(q)
    );
    renderProducts(filtered);
  });
}

// Data Loaders
async function loadTelemetry() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    const tel = data.telemetry;
    document.getElementById('worker-status').textContent = tel.status;
    document.getElementById('worker-mode').textContent = data.approval_mode;
    document.getElementById('worker-disk').textContent = `${tel.disk_free_gb} GB`;
    document.getElementById('affiliate-tag-display').textContent = data.associate_tag;
    document.getElementById('queued-jobs-count').textContent = tel.queue_pending_count;
  } catch (e) {
    console.error('Failed to load telemetry', e);
  }
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    productsData = await res.json();
    renderProducts(productsData);
    renderStudioProductSelector(productsData);
  } catch (e) {
    console.error('Failed to load products', e);
  }
}

function renderProducts(list) {
  productGrid.innerHTML = '';
  if (!list || list.length === 0) {
    productGrid.innerHTML = '<div style="color:var(--text-muted); grid-column:1/-1;">No products found. Use the importer above!</div>';
    return;
  }

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    const scoreClass = p.latest_score >= 80 ? 'score-high' : 'score-mid';

    card.innerHTML = `
      <div class="product-card-top">
        <span class="asin-tag">${p.asin}</span>
        <div class="score-badge ${scoreClass}">
          <span>★</span>
          <span>${p.latest_score.toFixed(1)}</span>
        </div>
      </div>
      <h3 class="product-title" title="${p.title}">${p.title}</h3>
      <div class="product-prices">
        <span class="current-price">₹${p.current_price.toFixed(0)}</span>
        <span class="orig-price">₹${p.original_price.toFixed(0)}</span>
        <span class="discount-pill">${p.discount_percent.toFixed(0)}% OFF</span>
      </div>
      <div class="product-rationale">
        <strong>Angle:</strong> Verified ${p.category} with ${p.rating}★ rating (${p.review_count.toLocaleString()} reviews).
      </div>
      <div class="product-actions">
        <button class="btn btn-outline" onclick="selectProductForStudio('${p.id}')">Create Content</button>
        <a href="${p.affiliate_url}" target="_blank" class="btn btn-primary" style="text-decoration:none;">View Deal</a>
      </div>
    `;
    productGrid.appendChild(card);
  });
}

function filterProducts(cat) {
  if (cat === 'all') {
    renderProducts(productsData);
  } else {
    const filtered = productsData.filter(p => p.category.toLowerCase().includes(cat.toLowerCase()));
    renderProducts(filtered);
  }
}

// Studio
function renderStudioProductSelector(list) {
  studioSelector.innerHTML = '';
  list.forEach(p => {
    const item = document.createElement('div');
    item.className = `selector-item ${p.id === selectedProductId ? 'selected' : ''}`;
    item.innerHTML = `
      <strong>${p.title}</strong>
      <span>₹${p.current_price.toFixed(0)} • Score: ${p.latest_score}</span>
    `;
    item.addEventListener('click', () => selectProductForStudio(p.id));
    studioSelector.appendChild(item);
  });
}

window.selectProductForStudio = async function(productId) {
  selectedProductId = productId;
  const p = productsData.find(prod => prod.id === productId);
  if (!p) return;

  // Switch to studio tab
  document.querySelector('[data-tab="tab-content"]').click();

  studioActiveTitle.textContent = p.title;
  studioActiveSub.textContent = `Category: ${p.category} | Price: ₹${p.current_price} | Affiliate Tag: Embedded`;
  btnGenerateAngles.style.display = 'inline-flex';

  renderStudioProductSelector(productsData);

  // Fetch or generate variants
  const res = await fetch(`${API_BASE}/api/variants?product_id=${productId}`);
  let variants = await res.json();
  if (!variants || variants.length === 0) {
    const genRes = await fetch(`${API_BASE}/api/products/${productId}/generate-content`, { method: 'POST' });
    const genData = await genRes.json();
    variants = genData.variants;
  }
  renderStudioVariants(variants);
};

function renderStudioVariants(variants) {
  studioVariantsContainer.innerHTML = '';
  variants.forEach(v => {
    const card = document.createElement('div');
    card.className = 'variant-card';
    const compClass = v.compliance_status === 'PASSED' ? 'comp-passed' : 'comp-warn';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="variant-angle-badge">${v.angle_type}</span>
        <span class="compliance-badge ${compClass}">${v.compliance_status}</span>
      </div>
      <div class="variant-hook">${v.hook_text}</div>
      <div class="variant-body">${v.body_script}</div>
      <div style="font-size:0.8rem; color:#60a5fa; font-family:monospace;">${v.hashtags.join(' ')}</div>
      <div style="font-size:0.75rem; color:var(--text-dim);">${v.disclosure_text}</div>
      <div style="display:flex; gap:10px; margin-top:auto;">
        <button class="btn btn-outline" style="flex:1;" onclick="previewVideo('${v.media_path || ''}', '${v.hook_text}')">
          🎬 Preview Video
        </button>
        <button class="btn btn-primary" style="flex:1;" onclick="scheduleVariant('${v.id}', '${v.product_id}', 'YOUTUBE')">
          🚀 Schedule
        </button>
      </div>
    `;
    studioVariantsContainer.appendChild(card);
  });
}

window.previewVideo = function(mediaPath, title) {
  if (!mediaPath) {
    alert("Video is being composited by FFmpeg worker. Click 'Schedule' or run the worker to generate immediately!");
    return;
  }
  const filename = mediaPath.split(/[/\\]/).pop();
  modalVideoPlayer.src = `${API_BASE}/media/${filename}`;
  document.getElementById('modal-video-title').textContent = title || 'Short Video Preview';
  videoModal.classList.add('show');
};

window.scheduleVariant = async function(variantId, productId, platform) {
  try {
    const res = await fetch(`${API_BASE}/api/jobs/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_id: variantId, product_id: productId, platform: platform })
    });
    const data = await res.json();
    alert(`Success! Job scheduled for ${platform}. Idempotency key: ${data.job.idempotency_key.substring(0, 12)}...`);
    loadTelemetry();
  } catch (e) {
    alert(`Scheduling Error: ${e.message}`);
  }
};

// Approvals Queue
async function loadApprovals() {
  try {
    const res = await fetch(`${API_BASE}/api/variants`);
    const variants = await res.json();
    const pending = variants.filter(v => v.approval_status === 'PENDING_APPROVAL');
    document.getElementById('pending-approvals-count').textContent = pending.length;

    approvalsList.innerHTML = '';
    if (pending.length === 0) {
      approvalsList.innerHTML = '<div class="card" style="color:var(--text-muted);">No pending variants awaiting review. All current content is verified or approved!</div>';
      return;
    }

    pending.forEach(v => {
      const item = document.createElement('div');
      item.className = 'approval-item';
      item.innerHTML = `
        <div class="approval-info">
          <h4>${v.hook_text}</h4>
          <p>Angle: ${v.angle_type} • Status: ${v.compliance_status} • ${v.compliance_notes.join(', ')}</p>
        </div>
        <div class="approval-actions">
          <button class="btn btn-accent" onclick="setVariantApproval('${v.id}', 'APPROVE')">Approve</button>
          <button class="btn btn-outline" onclick="setVariantApproval('${v.id}', 'REJECT')">Reject</button>
        </div>
      `;
      approvalsList.appendChild(item);
    });
  } catch (e) {
    console.error('Failed to load approvals', e);
  }
}

window.setVariantApproval = async function(variantId, action) {
  try {
    await fetch(`${API_BASE}/api/variants/${variantId}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action })
    });
    loadApprovals();
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
};

// Publishing Queue
async function loadPublishingQueue() {
  try {
    const res = await fetch(`${API_BASE}/api/jobs`);
    const jobs = await res.json();
    document.getElementById('queue-length-badge').textContent = `${jobs.length} Jobs`;

    publishingQueueList.innerHTML = '';
    if (jobs.length === 0) {
      publishingQueueList.innerHTML = '<div style="color:var(--text-muted); padding:16px;">Queue is clear. No scheduled jobs pending.</div>';
      return;
    }

    jobs.forEach(j => {
      const el = document.createElement('div');
      el.className = 'channel-item';
      el.innerHTML = `
        <div class="channel-details">
          <strong>${j.platform} • Job ${j.id}</strong>
          <span>Scheduled: ${new Date(j.scheduled_time).toLocaleString()} • Status: ${j.status}</span>
        </div>
        <span class="badge">${j.status}</span>
      `;
      publishingQueueList.appendChild(el);
    });
  } catch (e) {
    console.error('Failed to load publishing queue', e);
  }
}

// Analytics
async function loadAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/api/analytics/summary`);
    const data = await res.json();
    const m = data.metrics;

    document.getElementById('stat-revenue').textContent = `₹${m.total_revenue.toFixed(2)}`;
    document.getElementById('stat-views').textContent = m.total_views.toLocaleString();
    document.getElementById('stat-clicks').textContent = m.total_clicks.toLocaleString();
    document.getElementById('stat-orders').textContent = m.total_orders.toLocaleString();

    // Platforms
    platformStatsBody.innerHTML = '';
    if (data.platforms.length === 0) {
      platformStatsBody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);">No platform telemetry recorded yet. Run worker jobs to publish and harvest metrics.</td></tr>';
    } else {
      data.platforms.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.platform}</strong></td>
          <td>${p.total_posts}</td>
          <td>${p.views.toLocaleString()}</td>
          <td>${p.clicks}</td>
          <td>${p.orders}</td>
          <td>₹${p.revenue.toFixed(2)}</td>
          <td>${p.conversion_rate_pct}%</td>
        `;
        platformStatsBody.appendChild(tr);
      });
    }

    // Products
    productStatsBody.innerHTML = '';
    if (data.top_products.length === 0) {
      productStatsBody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">No product traffic recorded yet.</td></tr>';
    } else {
      data.top_products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${p.title.substring(0, 30)}...</strong></td>
          <td>₹${p.price.toFixed(0)}</td>
          <td>${p.score.toFixed(1)}</td>
          <td>${p.clicks}</td>
          <td>₹${p.revenue.toFixed(2)}</td>
        `;
        productStatsBody.appendChild(tr);
      });
    }
  } catch (e) {
    console.error('Failed to load analytics', e);
  }
}

// Strategies
async function loadStrategies() {
  try {
    const res = await fetch(`${API_BASE}/api/growth/strategies`);
    const strategies = await res.json();

    strategiesGrid.innerHTML = '';
    if (strategies.length === 0) {
      strategiesGrid.innerHTML = '<div class="card" style="color:var(--text-muted); grid-column:1/-1;">No strategic recommendations yet. Click "Run Strategic Analysis Cycle" above to analyze performance!</div>';
      return;
    }

    strategies.forEach(s => {
      const card = document.createElement('div');
      card.className = 'strategy-card';
      card.innerHTML = `
        <span class="strat-type-badge">${s.type}</span>
        <div class="strat-action">${s.proposed_action}</div>
        <div class="strat-rationale">${s.rationale}</div>
        <div style="font-size:0.75rem; color:var(--text-dim); margin-top:auto;">Status: ${s.status} • Priority: ${s.priority}</div>
      `;
      strategiesGrid.appendChild(card);
    });
  } catch (e) {
    console.error('Failed to load strategies', e);
  }
}
