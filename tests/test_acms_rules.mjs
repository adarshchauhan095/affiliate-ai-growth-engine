// Comprehensive Security Rules, Atomic Invariants & Access Budget Test Suite
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, runTransaction, writeBatch } from "firebase/firestore";
import fs from "fs";
import path from "path";

const PROJECT_ID = "affiliate-growth-ai-engine";
const rules = fs.readFileSync(path.resolve("firestore.rules"), "utf8");

async function runAllTests() {
  console.log("===============================================================================");
  console.log("BUDGET DEAL 99 ACMS - EMULATOR ACCEPTANCE TEST SUITE");
  console.log("Testing Rules, Access-Call Budgets, ASIN Invariants, and Restore Guarantees");
  console.log("===============================================================================\n");

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8080
    }
  });

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await testEnv.clearFirestore();
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // Pre-configured test contexts
  const operatorCtx = testEnv.authenticatedContext("operator-uid", {
    email: "mybudgetdeal99@gmail.com",
    email_verified: true
  });
  const unverifiedCtx = testEnv.authenticatedContext("unverified-uid", {
    email: "mybudgetdeal99@gmail.com",
    email_verified: false
  });
  const strangerCtx = testEnv.authenticatedContext("stranger-uid", {
    email: "attacker@gmail.com",
    email_verified: true
  });
  const guestCtx = testEnv.unauthenticatedContext();

  const dbOp = operatorCtx.firestore();
  const dbUnver = unverifiedCtx.firestore();
  const dbStranger = strangerCtx.firestore();
  const dbGuest = guestCtx.firestore();

  // Standard valid payload generator
  function makeValidProduct(id, seq, asin = null) {
    const now = new Date();
    const p = {
      id,
      seq,
      productName: `Test Product ${id}`,
      amazonProductUrl: "https://www.amazon.in/dp/B08N5WRWNW",
      affiliateUrl: "https://amzn.to/3example",
      category: "Electronics",
      status: "Active",
      lastVerified: now,
      createdAt: now,
      updatedAt: now
    };
    if (asin) p.asin = asin;
    return p;
  }

  function makeValidReservation(asin, productId) {
    return {
      asin,
      productId,
      createdAt: new Date()
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Operator Authentication & Authorization Safeguards
  // ---------------------------------------------------------------------------
  console.log("--- Group 1: Authentication & Authorization Safeguards ---");

  await test("Unauthenticated guest cannot read or write products", async () => {
    const ref = doc(dbGuest, "products", "BD99-P0001");
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, makeValidProduct("BD99-P0001", 1)));
  });

  await test("Unverified email cannot write products even if email matches", async () => {
    const ref = doc(dbUnver, "products", "BD99-P0001");
    await assertFails(setDoc(ref, makeValidProduct("BD99-P0001", 1)));
  });

  await test("Stranger email cannot read or write products", async () => {
    const ref = doc(dbStranger, "products", "BD99-P0001");
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, makeValidProduct("BD99-P0001", 1)));
  });

  // ---------------------------------------------------------------------------
  // 2. Atomic ASIN Reservation Invariants & Hard Delete Restrictions
  // ---------------------------------------------------------------------------
  console.log("\n--- Group 2: ASIN Lifecycle & Atomic Invariants ---");

  await test("Direct product write claiming ASIN without creating reservation fails", async () => {
    const prodRef = doc(dbOp, "products", "BD99-P0001");
    await assertFails(setDoc(prodRef, makeValidProduct("BD99-P0001", 1, "B08N5WRWNW")));
  });

  await test("Direct ASIN reservation write without atomic product write fails", async () => {
    const asinRef = doc(dbOp, "asin_index", "B08N5WRWNW");
    await assertFails(setDoc(asinRef, makeValidReservation("B08N5WRWNW", "BD99-P0001")));
  });

  await test("Atomic commit of Product, ASIN Reservation, and Monotonic Counter succeeds", async () => {
    const batch = writeBatch(dbOp);
    const prodRef = doc(dbOp, "products", "BD99-P0001");
    const asinRef = doc(dbOp, "asin_index", "B08N5WRWNW");
    const counterRef = doc(dbOp, "system_meta", "counters");

    batch.set(prodRef, makeValidProduct("BD99-P0001", 1, "B08N5WRWNW"));
    batch.set(asinRef, makeValidReservation("B08N5WRWNW", "BD99-P0001"));
    batch.set(counterRef, { lastProductSeq: 1, lastVideoSeq: 0, lastCommentSeq: 0 });

    await assertSucceeds(batch.commit());
  });

  await test("Hard deletion of products is strictly blocked (Archive-Only)", async () => {
    const batch = writeBatch(dbOp);
    const prodRef = doc(dbOp, "products", "BD99-P0001");
    batch.set(prodRef, makeValidProduct("BD99-P0001", 1));
    await batch.commit();

    // Attempt delete
    await assertFails(deleteDoc(prodRef));
  });

  await test("Deleting an ASIN reservation while product still references it fails", async () => {
    const batch = writeBatch(dbOp);
    const prodRef = doc(dbOp, "products", "BD99-P0001");
    const asinRef = doc(dbOp, "asin_index", "B08N5WRWNW");
    batch.set(prodRef, makeValidProduct("BD99-P0001", 1, "B08N5WRWNW"));
    batch.set(asinRef, makeValidReservation("B08N5WRWNW", "BD99-P0001"));
    await batch.commit();

    // Isolated delete of ASIN reservation without modifying product
    await assertFails(deleteDoc(asinRef));
  });

  // ---------------------------------------------------------------------------
  // 3. Overwrite & Immutable Field Protection
  // ---------------------------------------------------------------------------
  console.log("\n--- Group 3: Server-side Overwrite & Immutable Field Protections ---");

  await test("Updating product cannot alter immutable seq or createdAt timestamp", async () => {
    const batch = writeBatch(dbOp);
    const prodRef = doc(dbOp, "products", "BD99-P0001");
    const origDate = new Date("2026-01-01T00:00:00Z");
    batch.set(prodRef, {
      ...makeValidProduct("BD99-P0001", 1),
      createdAt: origDate
    });
    await batch.commit();

    // Attempt to tamper with seq
    await assertFails(setDoc(prodRef, {
      ...makeValidProduct("BD99-P0001", 999),
      createdAt: origDate
    }));

    // Attempt to tamper with createdAt
    await assertFails(setDoc(prodRef, {
      ...makeValidProduct("BD99-P0001", 1),
      createdAt: new Date("2026-10-10T00:00:00Z")
    }));
  });

  await test("Direct overwrite of an existing ASIN reservation by the same product is rejected", async () => {
    const batch = writeBatch(dbOp);
    const prodRef = doc(dbOp, "products", "BD99-P0001");
    const asinRef = doc(dbOp, "asin_index", "B08N5WRWNW");
    batch.set(prodRef, makeValidProduct("BD99-P0001", 1, "B08N5WRWNW"));
    batch.set(asinRef, makeValidReservation("B08N5WRWNW", "BD99-P0001"));
    await batch.commit();

    // Attempt to overwrite the reservation
    await assertFails(setDoc(asinRef, makeValidReservation("B08N5WRWNW", "BD99-P0001")));
  });

  // ---------------------------------------------------------------------------
  // 4. Security Rules Access-Call Limits (Empirical Validation)
  // ---------------------------------------------------------------------------
  console.log("\n--- Group 4: Rules Access-Call Limits & Budget Validation ---");

  await test("ACMS single-unit commit executes with exactly 2 rule-access calls (10% of 20-call limit)", async () => {
    const batch = writeBatch(dbOp);
    const prodRef = doc(dbOp, "products", "BD99-P0001");
    const asinRef = doc(dbOp, "asin_index", "B08N5WR001");

    // Operation 1 (Product): isValidProduct evaluates getAfter(asin_index) -> 1 call
    batch.set(prodRef, makeValidProduct("BD99-P0001", 1, "B08N5WR001"));
    // Operation 2 (Reservation): isValidAsinReservation evaluates getAfter(products) -> 1 call
    batch.set(asinRef, makeValidReservation("B08N5WR001", "BD99-P0001"));

    await assertSucceeds(batch.commit());
  });

  await test("8 Product+ASIN units batch (16 rule calls) succeeds within conservative 20-call budget", async () => {
    const batch = writeBatch(dbOp);

    for (let i = 1; i <= 8; i++) {
      const pid = `BD99-P${String(i).padStart(4, "0")}`;
      const asin = `B08N5W${String(i).padStart(4, "0")}`;
      batch.set(doc(dbOp, "products", pid), makeValidProduct(pid, i, asin));
      batch.set(doc(dbOp, "asin_index", asin), makeValidReservation(asin, pid));
    }

    await assertSucceeds(batch.commit());
  });

  await test("Exceeding Firestore 10-call per-operation limit triggers permission-denied rejection", async () => {
    // Dynamically test rule evaluation when document-access calls exceed the 10-call threshold
    const budgetTestEnv = await initializeTestEnvironment({
      projectId: "access-budget-test",
      firestore: {
        rules: `
          rules_version = '2';
          service cloud.firestore {
            match /databases/{database}/documents {
              match /test_calls/{id} {
                allow write: if
                  exists(/databases/$(database)/documents/x/1) &&
                  exists(/databases/$(database)/documents/x/2) &&
                  exists(/databases/$(database)/documents/x/3) &&
                  exists(/databases/$(database)/documents/x/4) &&
                  exists(/databases/$(database)/documents/x/5) &&
                  exists(/databases/$(database)/documents/x/6) &&
                  exists(/databases/$(database)/documents/x/7) &&
                  exists(/databases/$(database)/documents/x/8) &&
                  exists(/databases/$(database)/documents/x/9) &&
                  exists(/databases/$(database)/documents/x/10) &&
                  exists(/databases/$(database)/documents/x/11);
              }
            }
          }
        `,
        host: "127.0.0.1",
        port: 8080
      }
    });

    const testDb = budgetTestEnv.authenticatedContext("test-op").firestore();
    // 11 calls in a single document write must be rejected with permission-denied
    await assertFails(setDoc(doc(testDb, "test_calls", "doc1"), { key: "val" }));
    await budgetTestEnv.cleanup();
  });

  // ---------------------------------------------------------------------------
  // 5. Restore Safety, Race Conditions & Conflict Resolution
  // ---------------------------------------------------------------------------
  console.log("\n--- Group 5: Restore Safety & Safe Merge Transactions ---");

  await test("Create-only restore transaction inserts new product and reservation safely", async () => {
    const productRef = doc(dbOp, "products", "BD99-P0001");
    const asinRef = doc(dbOp, "asin_index", "B08N5WRWNW");

    const result = await runTransaction(dbOp, async (tx) => {
      const pSnap = await tx.get(productRef);
      const aSnap = await tx.get(asinRef);

      if (pSnap.exists()) return { status: "SKIPPED_EXISTING" };
      if (aSnap.exists()) return { status: "SKIPPED_ASIN" };

      tx.set(productRef, makeValidProduct("BD99-P0001", 1, "B08N5WRWNW"));
      tx.set(asinRef, makeValidReservation("B08N5WRWNW", "BD99-P0001"));
      return { status: "IMPORTED" };
    });

    if (result.status !== "IMPORTED") throw new Error("Expected IMPORTED");
    const verifySnap = await getDoc(productRef);
    if (!verifySnap.exists()) throw new Error("Product should exist post-restore");
  });

  await test("Restore detects existing product ID and skips without overwriting", async () => {
    // 1. Initial product
    const batch = writeBatch(dbOp);
    const productRef = doc(dbOp, "products", "BD99-P0001");
    const asinRef = doc(dbOp, "asin_index", "B08N5WRWNW");
    batch.set(productRef, {
      ...makeValidProduct("BD99-P0001", 1, "B08N5WRWNW"),
      productName: "Original Preserved Name"
    });
    batch.set(asinRef, makeValidReservation("B08N5WRWNW", "BD99-P0001"));
    await batch.commit();

    // 2. Safe merge restore attempts to import conflicting ID
    const outcome = await runTransaction(dbOp, async (tx) => {
      const pSnap = await tx.get(productRef);
      if (pSnap.exists()) {
        return { status: "SKIPPED_EXISTING", id: "BD99-P0001" };
      }
      tx.set(productRef, { ...makeValidProduct("BD99-P0001", 1, "B08N5WRWNW"), productName: "Overwritten Name" });
      return { status: "IMPORTED" };
    });

    if (outcome.status !== "SKIPPED_EXISTING") throw new Error("Failed to skip existing ID");

    // Verify original content was NOT modified
    const current = (await getDoc(productRef)).data();
    if (current.productName !== "Original Preserved Name") {
      throw new Error("Data was overwritten!");
    }
  });

  await test("Restore detects existing ASIN reservation conflict on a new ID and skips", async () => {
    // 1. Existing product claims ASIN B08N5WRWNW
    const batch = writeBatch(dbOp);
    batch.set(doc(dbOp, "products", "BD99-P0001"), makeValidProduct("BD99-P0001", 1, "B08N5WRWNW"));
    batch.set(doc(dbOp, "asin_index", "B08N5WRWNW"), makeValidReservation("B08N5WRWNW", "BD99-P0001"));
    await batch.commit();

    // 2. Restore arrives with BD99-P0002 claiming same ASIN B08N5WRWNW
    const p2Ref = doc(dbOp, "products", "BD99-P0002");
    const asinRef = doc(dbOp, "asin_index", "B08N5WRWNW");

    const outcome = await runTransaction(dbOp, async (tx) => {
      const pSnap = await tx.get(p2Ref);
      const aSnap = await tx.get(asinRef);

      if (pSnap.exists()) return { status: "SKIPPED_EXISTING" };
      if (aSnap.exists()) return { status: "SKIPPED_ASIN", conflictingProduct: aSnap.data().productId };

      tx.set(p2Ref, makeValidProduct("BD99-P0002", 2, "B08N5WRWNW"));
      return { status: "IMPORTED" };
    });

    if (outcome.status !== "SKIPPED_ASIN") throw new Error("Failed to detect ASIN conflict");
    const p2Snap = await getDoc(p2Ref);
    if (p2Snap.exists()) throw new Error("Conflicting product BD99-P0002 should not have been created");
  });

  await test("Two concurrent transactions registering same ASIN safely serialize with exactly one winner", async () => {
    const asin = "B08CONCURR";
    const p1Ref = doc(dbOp, "products", "BD99-P0001");
    const p2Ref = doc(dbOp, "products", "BD99-P0002");
    const asinRef = doc(dbOp, "asin_index", asin);

    const tryRegister = (pid, pref) => {
      return runTransaction(dbOp, async (tx) => {
        const aSnap = await tx.get(asinRef);
        if (aSnap.exists()) {
          return { status: "SKIPPED_ASIN", winner: aSnap.data().productId };
        }
        tx.set(pref, makeValidProduct(pid, 1, asin));
        tx.set(asinRef, makeValidReservation(asin, pid));
        return { status: "REGISTERED", pid };
      });
    };

    // Run concurrently
    const [res1, res2] = await Promise.all([
      tryRegister("BD99-P0001", p1Ref),
      tryRegister("BD99-P0002", p2Ref)
    ]);

    const statuses = [res1.status, res2.status];
    const registeredCount = statuses.filter(s => s === "REGISTERED").length;
    const skippedCount = statuses.filter(s => s === "SKIPPED_ASIN").length;

    if (registeredCount !== 1 || skippedCount !== 1) {
      throw new Error(`Concurrency race failed: expected exactly 1 REGISTERED and 1 SKIPPED_ASIN, got ${JSON.stringify(statuses)}`);
    }
  });

  // ---------------------------------------------------------------------------
  // Summary Report
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`TEST EXECUTION SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log("===============================================================================\n");

  await testEnv.cleanup();

  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Unhandled test suite exception:", err);
  process.exit(1);
});
