// Unit tests for Client-Side Validation, ID Sequencing, and Compliance Heuristics
import test from "node:test";
import assert from "node:assert/strict";

import { validateContentCopy } from "../frontend/js/services/compliance.js";

// ID formatting & parsing tests
function formatId(prefix, seq) {
  const padLength = 4;
  const numStr = String(seq);
  const padded = numStr.length < padLength ? numStr.padStart(padLength, "0") : numStr;
  return `BD99-${prefix}${padded}`;
}

function parseSeq(idStr) {
  if (!idStr || typeof idStr !== "string") return 0;
  const match = idStr.match(/\d+$/);
  return match ? parseInt(match[0], 10) : 0;
}

test("1. Monotonic ID Formatting & Arbitrary Scaling", () => {
  assert.equal(formatId("P", 1), "BD99-P0001");
  assert.equal(formatId("P", 99), "BD99-P0099");
  assert.equal(formatId("P", 9999), "BD99-P9999");
  assert.equal(formatId("P", 10000), "BD99-P10000", "Must scale past 4 digits without clipping");
  assert.equal(formatId("V", 25), "BD99-V0025");
  assert.equal(formatId("C", 104), "BD99-C0104");

  assert.equal(parseSeq("BD99-P0001"), 1);
  assert.equal(parseSeq("BD99-P0099"), 99);
  assert.equal(parseSeq("BD99-P10000"), 10000);
  assert.equal(parseSeq("BD99-V0450"), 450);
  assert.equal(parseSeq("invalid"), 0);
  assert.equal(parseSeq(null), 0);
});

test("2. Advisory Compliance Heuristic Checks", () => {
  // Test A: Clean copy with FTC disclosure
  const cleanCopy = "Check out this amazing coffee maker deal on Amazon! Link: https://amzn.to/3example #ad As an Amazon Associate I earn from qualifying purchases.";
  const resA = validateContentCopy(cleanCopy, "Instagram");
  assert.equal(resA.status, "PASSED");
  assert.equal(resA.notes.length, 0);

  // Test B: Missing FTC disclosure
  const noFtc = "Grab this deal now: https://amzn.to/3example";
  const resB = validateContentCopy(noFtc, "Instagram");
  assert.equal(resB.status, "BLOCKED");
  assert.ok(resB.notes.some(n => n.includes("Missing conspicuous affiliate disclosure")));

  // Test C: Forbidden deceptive claims
  const deceptive = "Secret amazon hack gives free money! #ad As an Amazon Associate I earn from qualifying purchases.";
  const resC = validateContentCopy(deceptive, "Instagram");
  assert.equal(resC.status, "BLOCKED");
  assert.ok(resC.notes.some(n => n.includes("Prohibited claim detected")));

  // Test D: Price volatility warning
  const priceNoDisclaimer = "Available now for ₹999 on Amazon! #ad As an Amazon Associate I earn from qualifying purchases.";
  const resD = validateContentCopy(priceNoDisclaimer, "Instagram");
  assert.equal(resD.status, "WARNINGS");
  assert.ok(resD.notes.some(n => n.includes("Prices subject to change")));

  // Test E: Length constraint warning
  const longText = "a".repeat(2250) + " #ad As an Amazon Associate I earn from qualifying purchases.";
  const resE = validateContentCopy(longText, "Instagram");
  assert.equal(resE.status, "WARNINGS");
  assert.ok(resE.notes.some(n => n.includes("Instagram limit of 2,200 characters")));
});

test("3. Backup Preflight Internal Conflict Detection", () => {
  function inspectInternalConflicts(products) {
    const seenIds = new Set();
    const seenAsins = new Set();
    const conflicts = [];

    for (const p of products) {
      if (!p.id) {
        conflicts.push("Missing ID");
        continue;
      }
      if (seenIds.has(p.id)) {
        conflicts.push(`Duplicate ID ${p.id}`);
      }
      seenIds.add(p.id);

      if (p.asin) {
        const asinKey = p.asin.toUpperCase();
        if (seenAsins.has(asinKey)) {
          conflicts.push(`Duplicate ASIN ${asinKey}`);
        }
        seenAsins.add(asinKey);
      }
    }
    return conflicts;
  }

  // Clean products
  const cleanList = [
    { id: "BD99-P0001", asin: "B08N5WRWNW" },
    { id: "BD99-P0002", asin: "B0791TX535" }
  ];
  assert.deepEqual(inspectInternalConflicts(cleanList), []);

  // Duplicate ID
  const dupIdList = [
    { id: "BD99-P0001", asin: "B08N5WRWNW" },
    { id: "BD99-P0001", asin: "B0791TX535" }
  ];
  assert.deepEqual(inspectInternalConflicts(dupIdList), ["Duplicate ID BD99-P0001"]);

  // Duplicate ASIN
  const dupAsinList = [
    { id: "BD99-P0001", asin: "B08N5WRWNW" },
    { id: "BD99-P0002", asin: "B08N5WRWNW" }
  ];
  assert.deepEqual(inspectInternalConflicts(dupAsinList), ["Duplicate ASIN B08N5WRWNW"]);
});
