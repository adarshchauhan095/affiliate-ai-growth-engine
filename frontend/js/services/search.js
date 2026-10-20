// Two-Phase Multi-Tier Search Engine with Explicit Scope Disclosures
import { db } from "../config/firebase.js";
import { state } from "./db.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function executeSearch(searchQuery, entityFilter = "ALL") {
  const q = String(searchQuery || "").trim();
  if (!q) {
    return {
      results: [],
      tier: "NONE",
      scopeLabel: "Enter a search term, ASIN, or ID.",
      isComplete: true
    };
  }

  // ===========================================================================
  // TIER 1: Exact ID Match (e.g. BD99-P0042, BD99-V0010, BD99-C0005)
  // O(1) direct document fetch across the entire database in 1 read.
  // ===========================================================================
  const idMatch = q.toUpperCase().match(/^BD99-([PVC])(\d+)$/);
  if (idMatch) {
    const typeChar = idMatch[1];
    let colName = "products";
    let entityType = "PRODUCT";
    if (typeChar === "V") { colName = "videos"; entityType = "VIDEO"; }
    if (typeChar === "C") { colName = "comments"; entityType = "COMMENT"; }

    const docSnap = await getDoc(doc(db, colName, q.toUpperCase()));
    if (docSnap.exists()) {
      return {
        results: [{ entityType, data: docSnap.data(), id: docSnap.id }],
        tier: "TIER_1_EXACT_ID",
        scopeLabel: `Exact ID Match: Found 1 ${entityType} document across database.`,
        isComplete: true
      };
    }
  }

  // ===========================================================================
  // TIER 2: Exact ASIN Match (10-character alphanumeric)
  // Direct indexed fetch via /asin_index/{asin} in 2 reads.
  // ===========================================================================
  const asinMatch = q.toUpperCase().match(/^[A-Z0-9]{10}$/);
  if (asinMatch) {
    const cleanAsin = asinMatch[0];
    const asinSnap = await getDoc(doc(db, "asin_index", cleanAsin));
    if (asinSnap.exists()) {
      const pid = asinSnap.data().productId;
      const prodSnap = await getDoc(doc(db, "products", pid));
      if (prodSnap.exists()) {
        return {
          results: [{ entityType: "PRODUCT", data: prodSnap.data(), id: prodSnap.id }],
          tier: "TIER_2_EXACT_ASIN",
          scopeLabel: `Exact ASIN Match: Found product ${pid} for ASIN ${cleanAsin}.`,
          isComplete: true
        };
      }
    }
  }

  // ===========================================================================
  // TIER 3: Local In-Memory Filter (Working Set View: 0 Firestore Reads)
  // Substring, case-insensitive instant search over loaded working set.
  // ===========================================================================
  const lowerQ = q.toLowerCase();
  const localResults = [];

  if (entityFilter === "ALL" || entityFilter === "PRODUCT") {
    state.products.forEach((p) => {
      const match =
        (p.productName && p.productName.toLowerCase().includes(lowerQ)) ||
        (p.category && p.category.toLowerCase().includes(lowerQ)) ||
        (p.brand && p.brand.toLowerCase().includes(lowerQ)) ||
        (p.asin && p.asin.toLowerCase().includes(lowerQ)) ||
        (p.productNotes && p.productNotes.toLowerCase().includes(lowerQ));
      if (match) localResults.push({ entityType: "PRODUCT", data: p, id: p.id });
    });
  }

  if (entityFilter === "ALL" || entityFilter === "VIDEO") {
    state.videos.forEach((v) => {
      const match =
        (v.title && v.title.toLowerCase().includes(lowerQ)) ||
        (v.captionHook && v.captionHook.toLowerCase().includes(lowerQ)) ||
        (v.platform && v.platform.toLowerCase().includes(lowerQ)) ||
        (v.notes && v.notes.toLowerCase().includes(lowerQ));
      if (match) localResults.push({ entityType: "VIDEO", data: v, id: v.id });
    });
  }

  if (entityFilter === "ALL" || entityFilter === "COMMENT") {
    state.comments.forEach((c) => {
      const match =
        (c.username && c.username.toLowerCase().includes(lowerQ)) ||
        (c.commentText && c.commentText.toLowerCase().includes(lowerQ)) ||
        (c.notes && c.notes.toLowerCase().includes(lowerQ));
      if (match) localResults.push({ entityType: "COMMENT", data: c, id: c.id });
    });
  }

  const loadedCount = state.products.size + state.videos.size + state.comments.size;
  return {
    results: localResults,
    tier: "TIER_3_LOCAL_WORKING_SET",
    scopeLabel: `Showing ${localResults.length} local matches from ${loadedCount} recently loaded records. (Partial Page View).`,
    isComplete: false,
    queryTerm: q
  };
}

// =============================================================================
// TIER 4: Remote Cloud Token Search
// Performs indexed array-contains-any on stored searchKeywords / searchTags.
// Max 30 tokens; Capped at top 25 matches. NOT general full-text search.
// =============================================================================
export async function executeCloudTokenSearch(searchQuery) {
  const tokens = searchQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 10);

  if (tokens.length === 0) {
    return {
      results: [],
      scopeLabel: "No valid search tokens found.",
      isComplete: true
    };
  }

  const pQuery = query(
    collection(db, "products"),
    where("searchKeywords", "array-contains-any", tokens),
    limit(25)
  );

  const snap = await getDocs(pQuery);
  const results = [];
  snap.forEach((d) => {
    results.push({ entityType: "PRODUCT", data: d.data(), id: d.id });
  });

  return {
    results,
    tier: "TIER_4_CLOUD_TOKENS",
    scopeLabel: `Cloud token search: Found ${results.length} matches for exact tokens [${tokens.join(", ")}] (Capped at top 25).`,
    isComplete: true
  };
}
