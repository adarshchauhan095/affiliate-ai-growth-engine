// Safe Merge Restore Engine with Create-Only Transactions & Rule-Budget Compliance
import { db } from "../config/firebase.js";
import { state, parseSeq } from "./db.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// =============================================================================
// 1. Full Database Export
// =============================================================================

export async function exportFullDatabaseBackup() {
  const [pSnap, vSnap, bSnap, cSnap, sSnap, cntSnap] = await Promise.all([
    getDocs(collection(db, "products")),
    getDocs(collection(db, "videos")),
    getDocs(collection(db, "video_products")),
    getDocs(collection(db, "comments")),
    getDoc(doc(db, "settings", "distribution")),
    getDoc(doc(db, "system_meta", "counters"))
  ]);

  const serializeTimestamp = (v) => {
    if (!v) return null;
    if (v instanceof Timestamp || typeof v.toDate === "function") {
      return v.toDate().toISOString();
    }
    return v;
  };

  const serializeDoc = (docSnap) => {
    const data = docSnap.data();
    const clean = {};
    for (const [k, v] of Object.entries(data)) {
      if (v instanceof Timestamp || (v && typeof v.toDate === "function")) {
        clean[k] = serializeTimestamp(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  };

  const payload = {
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    sourceApp: "Budget Deal 99 ACMS",
    counters: cntSnap.exists() ? cntSnap.data() : { lastProductSeq: 0, lastVideoSeq: 0, lastCommentSeq: 0 },
    distribution: sSnap.exists() ? serializeDoc(sSnap) : null,
    products: pSnap.docs.map(serializeDoc),
    videos: vSnap.docs.map(serializeDoc),
    videoProducts: bSnap.docs.map(serializeDoc),
    comments: cSnap.docs.map(serializeDoc)
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `budgetdeal99_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return payload;
}

// =============================================================================
// 2. Safe Merge Preflight Conflict Inspection
// =============================================================================

export async function inspectBackupPreflight(backupData) {
  if (!backupData || backupData.schemaVersion !== "1.0") {
    throw new Error("INVALID_BACKUP_SCHEMA: Backup file missing required schemaVersion '1.0'");
  }

  const products = Array.isArray(backupData.products) ? backupData.products : [];
  const videos = Array.isArray(backupData.videos) ? backupData.videos : [];
  const comments = Array.isArray(backupData.comments) ? backupData.comments : [];
  const videoProducts = Array.isArray(backupData.videoProducts) ? backupData.videoProducts : [];

  // 1. Detect internal duplicate IDs or duplicate ASINs within the backup payload
  const seenBackupIds = new Set();
  const seenBackupAsins = new Set();
  const internalConflicts = [];

  for (const p of products) {
    if (!p.id) {
      internalConflicts.push("A product record in backup is missing an ID.");
      continue;
    }
    if (seenBackupIds.has(p.id)) {
      internalConflicts.push(`Duplicate ID ${p.id} found multiple times inside backup.`);
    }
    seenBackupIds.add(p.id);

    if (p.asin) {
      const asinKey = p.asin.toUpperCase();
      if (seenBackupAsins.has(asinKey)) {
        internalConflicts.push(`Duplicate ASIN ${asinKey} found on multiple products inside backup.`);
      }
      seenBackupAsins.add(asinKey);
    }
  }

  // 2. Read existing Firestore state to determine conflicts
  const [existingP, existingV, existingC, existingAsinIndex] = await Promise.all([
    getDocs(collection(db, "products")),
    getDocs(collection(db, "videos")),
    getDocs(collection(db, "comments")),
    getDocs(collection(db, "asin_index"))
  ]);

  const existingProductIds = new Set(existingP.docs.map((d) => d.id));
  const existingVideoIds = new Set(existingV.docs.map((d) => d.id));
  const existingCommentIds = new Set(existingC.docs.map((d) => d.id));
  
  const existingAsinMap = new Map();
  existingAsinIndex.docs.forEach((d) => existingAsinMap.set(d.id, d.data().productId));

  // Categorize
  let safeProductCount = 0;
  let skippedExistingProductIds = 0;
  let skippedAsinConflicts = 0;

  for (const p of products) {
    if (existingProductIds.has(p.id)) {
      skippedExistingProductIds++;
    } else if (p.asin && existingAsinMap.has(p.asin.toUpperCase())) {
      skippedAsinConflicts++;
    } else {
      safeProductCount++;
    }
  }

  let safeVideoCount = 0;
  let skippedVideoIds = 0;
  for (const v of videos) {
    if (existingVideoIds.has(v.id)) skippedVideoIds++;
    else safeVideoCount++;
  }

  let safeCommentCount = 0;
  let skippedCommentIds = 0;
  for (const c of comments) {
    if (existingCommentIds.has(c.id)) skippedCommentIds++;
    else safeCommentCount++;
  }

  return {
    totalItems: products.length + videos.length + comments.length + videoProducts.length,
    products: { total: products.length, safe: safeProductCount, skippedId: skippedExistingProductIds, skippedAsin: skippedAsinConflicts },
    videos: { total: videos.length, safe: safeVideoCount, skipped: skippedVideoIds },
    comments: { total: comments.length, safe: safeCommentCount, skipped: skippedCommentIds },
    videoProducts: { total: videoProducts.length },
    internalConflicts
  };
}

// =============================================================================
// 3. Transaction-Based Create-Only Safe Merge Execution
// =============================================================================

export async function executeSafeMerge(backupData, onProgressCallback) {
  const preflight = await inspectBackupPreflight(backupData);
  if (preflight.internalConflicts.length > 0) {
    throw new Error(`BACKUP_CORRUPTED: ${preflight.internalConflicts.join(" ")}`);
  }

  const products = backupData.products || [];
  const videos = backupData.videos || [];
  const videoProducts = backupData.videoProducts || [];
  const comments = backupData.comments || [];

  // Convert ISO timestamp strings back to Firestore Timestamps
  const parseTimestamp = (val) => {
    if (!val) return null;
    if (typeof val === "string") {
      const d = new Date(val);
      return !isNaN(d.getTime()) ? Timestamp.fromDate(d) : null;
    }
    return val;
  };

  const results = {
    imported: [],
    skippedExisting: [],
    skippedAsinConflict: [],
    failed: []
  };

  let totalProcessed = 0;
  const totalRecords = products.length + videos.length + comments.length + videoProducts.length;

  const notify = () => {
    if (onProgressCallback) {
      onProgressCallback({
        processed: totalProcessed,
        total: totalRecords,
        percent: Math.round((totalProcessed / totalRecords) * 100),
        results
      });
    }
  };

  // 1. Reconcile Counters First in a single atomic transaction
  const countersRef = doc(db, "system_meta", "counters");
  await runTransaction(db, async (tx) => {
    const cSnap = await tx.get(countersRef);
    const curr = cSnap.exists() ? cSnap.data() : { lastProductSeq: 0, lastVideoSeq: 0, lastCommentSeq: 0 };

    const maxP = Math.max(curr.lastProductSeq || 0, ...products.map((p) => p.seq || parseSeq(p.id) || 0));
    const maxV = Math.max(curr.lastVideoSeq || 0, ...videos.map((v) => v.seq || parseSeq(v.id) || 0));
    const maxC = Math.max(curr.lastCommentSeq || 0, ...comments.map((c) => c.seq || parseSeq(c.id) || 0));

    tx.set(countersRef, { lastProductSeq: maxP, lastVideoSeq: maxV, lastCommentSeq: maxC }, { merge: true });
  });

  // 2. Import Products via Isolated Create-Only Transactions (Max 2 Rule Calls / Unit)
  for (const p of products) {
    try {
      const productRef = doc(db, "products", p.id);
      const cleanAsin = p.asin ? p.asin.trim().toUpperCase() : null;
      const asinRef = cleanAsin ? doc(db, "asin_index", cleanAsin) : null;

      const outcome = await runTransaction(db, async (tx) => {
        // Optimistic Reads
        const pSnap = await tx.get(productRef);
        const aSnap = asinRef ? await tx.get(asinRef) : null;

        // Create-Only Guard: Skip if ID already exists
        if (pSnap.exists()) {
          return { status: "SKIPPED_EXISTING", id: p.id };
        }

        // Create-Only Guard: Skip if ASIN already reserved
        if (aSnap && aSnap.exists()) {
          return { status: "SKIPPED_ASIN", id: p.id, asin: cleanAsin };
        }

        const now = serverTimestamp();
        const docPayload = {
          id: p.id,
          seq: p.seq || parseSeq(p.id) || 1,
          productName: String(p.productName || "").trim(),
          asin: cleanAsin,
          amazonProductUrl: p.amazonProductUrl,
          affiliateUrl: p.affiliateUrl,
          price: typeof p.price === "number" ? p.price : null,
          currency: p.currency || "INR",
          priceLastChecked: parseTimestamp(p.priceLastChecked),
          category: String(p.category || "General").trim(),
          brand: p.brand ? String(p.brand).trim() : null,
          searchKeywords: Array.isArray(p.searchKeywords) ? p.searchKeywords : [],
          imageUrl: p.imageUrl || null,
          productNotes: p.productNotes || null,
          status: p.status || "Active",
          lastVerified: parseTimestamp(p.lastVerified) || now,
          createdAt: parseTimestamp(p.createdAt) || now,
          updatedAt: parseTimestamp(p.updatedAt) || now
        };

        // Create-Only writes
        tx.set(productRef, docPayload);
        if (asinRef) {
          tx.set(asinRef, { asin: cleanAsin, productId: p.id, createdAt: now });
        }

        return { status: "IMPORTED", id: p.id };
      });

      if (outcome.status === "IMPORTED") results.imported.push(p.id);
      else if (outcome.status === "SKIPPED_EXISTING") results.skippedExisting.push(p.id);
      else if (outcome.status === "SKIPPED_ASIN") results.skippedAsinConflict.push({ id: p.id, asin: cleanAsin });
    } catch (err) {
      results.failed.push({ id: p.id, error: err.message });
    } finally {
      totalProcessed++;
      notify();
    }
  }

  // 3. Import Videos via Create-Only Transactions
  for (const v of videos) {
    try {
      const vRef = doc(db, "videos", v.id);
      const outcome = await runTransaction(db, async (tx) => {
        const vSnap = await tx.get(vRef);
        if (vSnap.exists()) {
          return { status: "SKIPPED_EXISTING", id: v.id };
        }

        const now = serverTimestamp();
        const docPayload = {
          id: v.id,
          seq: v.seq || parseSeq(v.id) || 1,
          title: String(v.title || "").trim(),
          platform: v.platform || "Instagram",
          contentType: v.contentType || "Reel",
          accountChannel: v.accountChannel || "@mybudgetdeal99",
          videoUrl: v.videoUrl || null,
          publishDate: parseTimestamp(v.publishDate),
          captionHook: v.captionHook || null,
          searchTags: Array.isArray(v.searchTags) ? v.searchTags : [],
          status: v.status || "Draft",
          notes: v.notes || null,
          createdAt: parseTimestamp(v.createdAt) || now,
          updatedAt: parseTimestamp(v.updatedAt) || now
        };

        tx.set(vRef, docPayload);
        return { status: "IMPORTED", id: v.id };
      });

      if (outcome.status === "IMPORTED") results.imported.push(v.id);
      else results.skippedExisting.push(v.id);
    } catch (err) {
      results.failed.push({ id: v.id, error: err.message });
    } finally {
      totalProcessed++;
      notify();
    }
  }

  // 4. Import Bridge Links
  for (const b of videoProducts) {
    try {
      const bRef = doc(db, "video_products", b.id);
      const outcome = await runTransaction(db, async (tx) => {
        const bSnap = await tx.get(bRef);
        if (bSnap.exists()) return { status: "SKIPPED_EXISTING", id: b.id };

        const now = serverTimestamp();
        tx.set(bRef, {
          id: b.id,
          videoId: b.videoId,
          productId: b.productId,
          linkedAt: parseTimestamp(b.linkedAt) || now
        });
        return { status: "IMPORTED", id: b.id };
      });

      if (outcome.status === "IMPORTED") results.imported.push(b.id);
      else results.skippedExisting.push(b.id);
    } catch (err) {
      results.failed.push({ id: b.id, error: err.message });
    } finally {
      totalProcessed++;
      notify();
    }
  }

  // 5. Import Comments
  for (const c of comments) {
    try {
      const cRef = doc(db, "comments", c.id);
      const outcome = await runTransaction(db, async (tx) => {
        const cSnap = await tx.get(cRef);
        if (cSnap.exists()) return { status: "SKIPPED_EXISTING", id: c.id };

        const now = serverTimestamp();
        const docPayload = {
          id: c.id,
          seq: c.seq || parseSeq(c.id) || 1,
          dateReceived: parseTimestamp(c.dateReceived) || now,
          platform: c.platform || "Instagram",
          videoId: c.videoId,
          username: String(c.username || "Anonymous").trim(),
          queryType: c.queryType || "Link",
          commentText: c.commentText || null,
          resolvedProductId: c.resolvedProductId || null,
          responseStatus: c.responseStatus || "Pending",
          repliedAt: parseTimestamp(c.repliedAt),
          telegramCtaSent: c.telegramCtaSent || "No",
          notes: c.notes || null,
          createdAt: parseTimestamp(c.createdAt) || now,
          updatedAt: parseTimestamp(c.updatedAt) || now
        };

        tx.set(cRef, docPayload);
        return { status: "IMPORTED", id: c.id };
      });

      if (outcome.status === "IMPORTED") results.imported.push(c.id);
      else results.skippedExisting.push(c.id);
    } catch (err) {
      results.failed.push({ id: c.id, error: err.message });
    } finally {
      totalProcessed++;
      notify();
    }
  }

  // Store recovery summary in sessionStorage
  sessionStorage.setItem("bd99_last_restore_results", JSON.stringify(results));
  return results;
}
