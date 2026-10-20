// Firestore Data Access Layer with Atomic ASIN Lifecycle & Monotonic Counters
import { db } from "../config/firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// In-Memory Collection Caches for Sub-second UI Responsiveness
export const state = {
  products: new Map(),
  videos: new Map(),
  videoProducts: new Map(),
  comments: new Map(),
  distribution: null,
  counters: null,
  lastSyncTime: null
};

// =============================================================================
// 1. Counter Initialization & Sequence Allocation
// =============================================================================

export function formatId(prefix, seq) {
  const padLength = 4;
  const numStr = String(seq);
  const padded = numStr.length < padLength ? numStr.padStart(padLength, "0") : numStr;
  return `BD99-${prefix}${padded}`;
}

export function parseSeq(idStr) {
  if (!idStr || typeof idStr !== "string") return 0;
  const match = idStr.match(/\d+$/);
  return match ? parseInt(match[0], 10) : 0;
}

export async function ensureCountersInitialized() {
  const countersRef = doc(db, "system_meta", "counters");
  
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(countersRef);
    if (snap.exists()) {
      state.counters = snap.data();
      return state.counters;
    }

    // First-run reconciliation: find highest existing IDs
    const [pSnap, vSnap, cSnap] = await Promise.all([
      getDocs(query(collection(db, "products"), orderBy("id", "desc"), limit(1))),
      getDocs(query(collection(db, "videos"), orderBy("id", "desc"), limit(1))),
      getDocs(query(collection(db, "comments"), orderBy("id", "desc"), limit(1)))
    ]);

    const maxP = pSnap.empty ? 0 : parseSeq(pSnap.docs[0].id);
    const maxV = vSnap.empty ? 0 : parseSeq(vSnap.docs[0].id);
    const maxC = cSnap.empty ? 0 : parseSeq(cSnap.docs[0].id);

    const initialCounters = {
      lastProductSeq: maxP,
      lastVideoSeq: maxV,
      lastCommentSeq: maxC
    };

    tx.set(countersRef, initialCounters);
    state.counters = initialCounters;
    return initialCounters;
  });
}

// =============================================================================
// 2. Product Registry & ASIN Lifecycle Management
// =============================================================================

export async function createProduct(productInput) {
  const cleanAsin = productInput.asin ? productInput.asin.trim().toUpperCase() : null;
  const countersRef = doc(db, "system_meta", "counters");

  return await runTransaction(db, async (tx) => {
    // 1. Check ASIN Reservation if ASIN is provided
    let asinRef = null;
    if (cleanAsin) {
      asinRef = doc(db, "asin_index", cleanAsin);
      const asinSnap = await tx.get(asinRef);
      if (asinSnap.exists()) {
        const existingPid = asinSnap.data().productId;
        throw new Error(`ASIN_EXISTS: ASIN ${cleanAsin} is already reserved by product ${existingPid}`);
      }
    }

    // 2. Allocate Monotonic Sequence ID
    const counterSnap = await tx.get(countersRef);
    if (!counterSnap.exists()) {
      throw new Error("Counters not initialized. Please refresh the application.");
    }

    const currentSeq = counterSnap.data().lastProductSeq || 0;
    const nextSeq = currentSeq + 1;
    const productId = formatId("P", nextSeq);
    const productRef = doc(db, "products", productId);

    // 3. Construct Validated Product Payload
    const now = serverTimestamp();
    const productDoc = {
      id: productId,
      seq: nextSeq,
      productName: productInput.productName.trim(),
      asin: cleanAsin,
      amazonProductUrl: productInput.amazonProductUrl.trim(),
      affiliateUrl: productInput.affiliateUrl.trim(),
      price: typeof productInput.price === "number" ? productInput.price : null,
      currency: productInput.currency || "INR",
      priceLastChecked: productInput.price ? now : null,
      category: productInput.category.trim(),
      brand: productInput.brand ? productInput.brand.trim() : null,
      searchKeywords: Array.isArray(productInput.searchKeywords) ? productInput.searchKeywords : [],
      imageUrl: productInput.imageUrl ? productInput.imageUrl.trim() : null,
      productNotes: productInput.productNotes ? productInput.productNotes.trim() : null,
      status: productInput.status || "Active",
      lastVerified: now,
      createdAt: now,
      updatedAt: now
    };

    // 4. Atomic Multi-Document Commits
    tx.set(productRef, productDoc);
    
    if (cleanAsin && asinRef) {
      tx.set(asinRef, {
        asin: cleanAsin,
        productId: productId,
        createdAt: now
      });
    }

    tx.set(countersRef, { lastProductSeq: nextSeq }, { merge: true });

    return { ...productDoc, id: productId, seq: nextSeq };
  });
}

export async function updateProduct(productId, updates) {
  const productRef = doc(db, "products", productId);
  const now = serverTimestamp();

  return await runTransaction(db, async (tx) => {
    const prodSnap = await tx.get(productRef);
    if (!prodSnap.exists()) {
      throw new Error(`PRODUCT_NOT_FOUND: Product ${productId} does not exist`);
    }

    const current = prodSnap.data();
    const oldAsin = current.asin;
    const newAsin = updates.asin ? updates.asin.trim().toUpperCase() : null;

    // Handle ASIN Lifecycle Changes
    if (oldAsin !== newAsin) {
      // 1. If changing to another ASIN, verify new ASIN is not already claimed
      if (newAsin) {
        const newAsinRef = doc(db, "asin_index", newAsin);
        const newAsinSnap = await tx.get(newAsinRef);
        if (newAsinSnap.exists() && newAsinSnap.data().productId !== productId) {
          throw new Error(`ASIN_EXISTS: ASIN ${newAsin} is already claimed by product ${newAsinSnap.data().productId}`);
        }
        tx.set(newAsinRef, {
          asin: newAsin,
          productId: productId,
          createdAt: now
        });
      }

      // 2. Delete old ASIN reservation atomically
      if (oldAsin) {
        const oldAsinRef = doc(db, "asin_index", oldAsin);
        tx.delete(oldAsinRef);
      }
    }

    const updatedDoc = {
      ...current,
      ...updates,
      asin: newAsin,
      updatedAt: now
    };

    // Update price timestamp if price modified
    if (updates.price !== undefined && updates.price !== current.price) {
      updatedDoc.priceLastChecked = now;
    }

    tx.set(productRef, updatedDoc);
    return updatedDoc;
  });
}

// Archive-First: Hard deletion is blocked in Security Rules; soft archive is the standard action
export async function archiveProduct(productId) {
  return await updateProduct(productId, { status: "Archived" });
}

// =============================================================================
// 3. Content Library (Videos) & Bridge Associations
// =============================================================================

export async function createVideo(videoInput, associatedProductIds = []) {
  const countersRef = doc(db, "system_meta", "counters");

  return await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(countersRef);
    if (!counterSnap.exists()) {
      throw new Error("Counters not initialized.");
    }

    const currentSeq = counterSnap.data().lastVideoSeq || 0;
    const nextSeq = currentSeq + 1;
    const videoId = formatId("V", nextSeq);
    const videoRef = doc(db, "videos", videoId);

    const now = serverTimestamp();
    const isPublished = videoInput.status === "Published";

    const videoDoc = {
      id: videoId,
      seq: nextSeq,
      title: videoInput.title.trim(),
      platform: videoInput.platform,
      contentType: videoInput.contentType,
      accountChannel: videoInput.accountChannel ? videoInput.accountChannel.trim() : "@mybudgetdeal99",
      videoUrl: isPublished ? (videoInput.videoUrl ? videoInput.videoUrl.trim() : null) : (videoInput.videoUrl || null),
      publishDate: isPublished ? (videoInput.publishDate || now) : (videoInput.publishDate || null),
      captionHook: videoInput.captionHook ? videoInput.captionHook.trim() : null,
      searchTags: Array.isArray(videoInput.searchTags) ? videoInput.searchTags : [],
      status: videoInput.status || "Draft",
      notes: videoInput.notes ? videoInput.notes.trim() : null,
      createdAt: now,
      updatedAt: now
    };

    tx.set(videoRef, videoDoc);

    // Create normalized video_products bridge links
    for (const pid of associatedProductIds) {
      const bridgeId = `vp_${videoId}_${pid}`;
      const bridgeRef = doc(db, "video_products", bridgeId);
      tx.set(bridgeRef, {
        id: bridgeId,
        videoId: videoId,
        productId: pid,
        linkedAt: now
      });
    }

    tx.set(countersRef, { lastVideoSeq: nextSeq }, { merge: true });
    return { ...videoDoc, id: videoId, seq: nextSeq };
  });
}

export async function updateVideo(videoId, updates, newProductIds = null) {
  const videoRef = doc(db, "videos", videoId);
  const now = serverTimestamp();

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(videoRef);
    if (!snap.exists()) throw new Error("Video not found");

    const current = snap.data();
    const isPublished = (updates.status || current.status) === "Published";

    const updatedDoc = {
      ...current,
      ...updates,
      videoUrl: isPublished ? (updates.videoUrl || current.videoUrl) : (updates.videoUrl !== undefined ? updates.videoUrl : current.videoUrl),
      updatedAt: now
    };

    tx.set(videoRef, updatedDoc);

    // Update associations if explicitly provided
    if (Array.isArray(newProductIds)) {
      // Find existing bridge records in cache/query
      const existingBridges = Array.from(state.videoProducts.values()).filter(b => b.videoId === videoId);
      const existingPids = new Set(existingBridges.map(b => b.productId));
      const targetPids = new Set(newProductIds);

      // Add new
      for (const pid of targetPids) {
        if (!existingPids.has(pid)) {
          const bId = `vp_${videoId}_${pid}`;
          tx.set(doc(db, "video_products", bId), {
            id: bId,
            videoId: videoId,
            productId: pid,
            linkedAt: now
          });
        }
      }

      // Remove deleted
      for (const b of existingBridges) {
        if (!targetPids.has(b.productId)) {
          tx.delete(doc(db, "video_products", b.id));
        }
      }
    }

    return updatedDoc;
  });
}

export async function archiveVideo(videoId) {
  return await updateVideo(videoId, { status: "Archived" });
}

// =============================================================================
// 4. Comments & Follow-Up Log
// =============================================================================

export async function createComment(commentInput) {
  const countersRef = doc(db, "system_meta", "counters");

  return await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(countersRef);
    if (!counterSnap.exists()) throw new Error("Counters not initialized.");

    const currentSeq = counterSnap.data().lastCommentSeq || 0;
    const nextSeq = currentSeq + 1;
    const commentId = formatId("C", nextSeq);
    const commentRef = doc(db, "comments", commentId);

    const now = serverTimestamp();
    const commentDoc = {
      id: commentId,
      seq: nextSeq,
      dateReceived: commentInput.dateReceived || now,
      platform: commentInput.platform,
      videoId: commentInput.videoId,
      username: commentInput.username.trim(),
      queryType: commentInput.queryType || "Link",
      commentText: commentInput.commentText ? commentInput.commentText.trim() : null,
      resolvedProductId: commentInput.resolvedProductId || null,
      responseStatus: commentInput.responseStatus || "Pending",
      repliedAt: commentInput.responseStatus === "Replied" ? now : null,
      telegramCtaSent: commentInput.telegramCtaSent || "No",
      notes: commentInput.notes ? commentInput.notes.trim() : null,
      createdAt: now,
      updatedAt: now
    };

    tx.set(commentRef, commentDoc);
    tx.set(countersRef, { lastCommentSeq: nextSeq }, { merge: true });
    return { ...commentDoc, id: commentId, seq: nextSeq };
  });
}

export async function markCommentReplied(commentId, notes = null) {
  const commentRef = doc(db, "comments", commentId);
  const now = serverTimestamp();

  await updateDoc(commentRef, {
    responseStatus: "Replied",
    repliedAt: now,
    notes: notes || undefined,
    updatedAt: now
  });
}

// =============================================================================
// 5. Distribution Settings Singleton
// =============================================================================

export async function getDistributionSettings() {
  const docRef = doc(db, "settings", "distribution");
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    state.distribution = snap.data();
    return state.distribution;
  }

  // Default seed
  const defaultSettings = {
    associateTag: "mybudgetdeal9-21",
    tagConfirmed: false,
    instagramProfileUrl: "https://instagram.com/mybudgetdeal99",
    youtubeChannelUrl: "https://youtube.com/@mybudgetdeal99",
    telegramChannelUrl: "https://t.me/budgetdeal99",
    standardCta: "⚡ Check bio link & comment for direct link! Join Telegram for daily flash deals.",
    affiliateDisclosure: "As an Amazon Associate I earn from qualifying purchases. #ad",
    dmTemplate: "Hi {username}! Here is the direct deal link for {product_name}: {affiliate_url} ⚡ Join our Telegram for deals before they expire: {telegram_url}",
    updatedAt: serverTimestamp()
  };

  await setDoc(docRef, defaultSettings);
  state.distribution = defaultSettings;
  return defaultSettings;
}

export async function updateDistributionSettings(updates) {
  const docRef = doc(db, "settings", "distribution");
  const updated = {
    ...updates,
    updatedAt: serverTimestamp()
  };
  await updateDoc(docRef, updated);
  state.distribution = { ...state.distribution, ...updates };
  return state.distribution;
}

// =============================================================================
// 6. Data Synchronization & Normalized Resolvers
// =============================================================================

export async function syncAllWorkingSets() {
  await ensureCountersInitialized();
  await getDistributionSettings();

  const [pDocs, vDocs, bDocs, cDocs] = await Promise.all([
    getDocs(query(collection(db, "products"), orderBy("updatedAt", "desc"), limit(50))),
    getDocs(query(collection(db, "videos"), orderBy("updatedAt", "desc"), limit(50))),
    getDocs(collection(db, "video_products")),
    getDocs(query(collection(db, "comments"), orderBy("dateReceived", "desc"), limit(50)))
  ]);

  state.products.clear();
  pDocs.forEach(d => state.products.set(d.id, d.data()));

  state.videos.clear();
  vDocs.forEach(d => state.videos.set(d.id, d.data()));

  state.videoProducts.clear();
  bDocs.forEach(d => state.videoProducts.set(d.id, d.data()));

  state.comments.clear();
  cDocs.forEach(d => state.comments.set(d.id, d.data()));

  state.lastSyncTime = new Date();
  return state;
}

// Normalized resolver: Get all products featured in a video
export function getProductsForVideo(videoId) {
  const linked = [];
  state.videoProducts.forEach((b) => {
    if (b.videoId === videoId) {
      const p = state.products.get(b.productId);
      if (p) linked.push(p);
    }
  });
  return linked;
}

// Normalized resolver: Get all videos featuring a product
export function getVideosForProduct(productId) {
  const linked = [];
  state.videoProducts.forEach((b) => {
    if (b.productId === productId) {
      const v = state.videos.get(b.videoId);
      if (v) linked.push(v);
    }
  });
  return linked;
}
