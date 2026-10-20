// Advisory Compliance Heuristic Validator
// Notice: Automated compliance checks are advisory heuristics only.
// They do not guarantee legal compliance or adherence to platform terms of service.

export const FORBIDDEN_PHRASES = [
  /\bguaranteed to cure\b/i,
  /\bfree money\b/i,
  /\bget rich quick\b/i,
  /\bamazon glitch\b/i,
  /\bsecret amazon hack\b/i,
  /\bofficial partner of apple\b/i,
  /\bofficial partner of amazon\b/i,
  /\bofficial amazon representative\b/i
];

export const FTC_PATTERNS = [
  /#ad\b/i,
  /#affiliate\b/i,
  /#sponsored\b/i,
  /#commissionsearned\b/i,
  /as an amazon associate\b/i,
  /affiliate link\b/i,
  /\(paid link\)\b/i
];

export const AMAZON_DISCLOSURE_CLAUSE = "as an amazon associate i earn from qualifying purchases";

export function validateContentCopy(text = "", platform = "Instagram") {
  const notes = [];
  let isBlocked = false;
  let isWarn = false;

  const content = String(text || "").trim();
  const lower = content.toLowerCase();

  // Stage 1: FTC Disclosure Check
  const hasFtc = FTC_PATTERNS.some((pat) => pat.test(content));
  if (!hasFtc) {
    notes.push("Missing conspicuous affiliate disclosure (#ad, #affiliate, or (Paid Link)).");
    isBlocked = true;
  }

  // Stage 2: Amazon Operating Agreement Clause
  if (!lower.includes(AMAZON_DISCLOSURE_CLAUSE)) {
    notes.push("Official Amazon clause recommended: 'As an Amazon Associate I earn from qualifying purchases.'");
    isWarn = true;
  }

  // Stage 3: Misleading / Deceptive Claims
  for (const pat of FORBIDDEN_PHRASES) {
    if (pat.test(content)) {
      notes.push(`Prohibited claim detected matching pattern: ${pat.source}`);
      isBlocked = true;
    }
  }

  // Stage 4: Trademark Safety
  if (lower.includes("exclusive official distributor") || lower.includes("endorsed by amazon")) {
    notes.push("Unauthorized trademark claim or endorsement representation detected.");
    isBlocked = true;
  }

  // Stage 5: Platform Constraints
  if (platform === "Instagram" && content.length > 2200) {
    notes.push("Caption exceeds Instagram limit of 2,200 characters.");
    isWarn = true;
  }
  if (platform === "YouTube" && content.length > 5000) {
    notes.push("Description exceeds YouTube limit of 5,000 characters.");
    isWarn = true;
  }

  // Stage 6: Price Volatility Disclaimer
  const mentionsPrice = /(?:₹|inr|rs\.?|\$)\s*\d+/i.test(content);
  if (mentionsPrice && !lower.includes("subject to change") && !lower.includes("time of publication")) {
    notes.push("Static price mentioned without 'Prices subject to change' disclaimer.");
    isWarn = true;
  }

  // Stage 7: Overall Status
  let status = "PASSED";
  if (isBlocked) status = "BLOCKED";
  else if (isWarn) status = "WARNINGS";

  return {
    status,
    notes,
    charCount: content.length,
    disclaimer: "Advisory heuristic check only. Does not guarantee legal compliance."
  };
}
