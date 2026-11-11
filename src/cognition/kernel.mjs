// Fun Industrial — FI_COGNITIVE_KERNEL_V1
// Deterministic, dependency-free, side-effect-free cognitive primitives.
// No tool calls, LLM calls, network, files, REA execution, or claims of consciousness.

const QUESTIONS = new Set(["who", "what", "why", "how", "where", "when"]);
const TRANSITIVE = new Set(["is_a", "part_of", "before"]);
const safeString = (x, max = 160) =>
  typeof x === "string" && x.length > 0 && x.length <= max &&
  x.trim() === x && !/[\u0000-\u001F\u007F]/.test(x);
const bounded = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const same = (a, b) => a === b;
const clone = x => JSON.parse(JSON.stringify(x));
const fail = code => { throw Error(code); };

export class CognitiveKernel {
  #claims = new Map();
  #checks = [];
  #predictions = new Map();
  #events = [];
  #nextId = 1;
  #max;

  constructor({ maxClaims = 2000, maxPredictions = 500, maxEvents = 5000 } = {}) {
    if (![maxClaims, maxPredictions, maxEvents].every(n => bounded(n, 1, 100000)))
      fail("COGNITION_LIMIT_INVALID");
    this.#max = { maxClaims, maxPredictions, maxEvents };
  }

  #id(prefix) { return prefix + "-" + String(this.#nextId++).padStart(6, "0"); }
  #event(type, id) {
    // Bounded operational event history; no timestamps to maintain determinism.
    this.#events.push({ type, id });
    if (this.#events.length > this.#max.maxEvents) this.#events.shift();
  }

  // Store candidate knowledge. A source string is provenance, NOT evidence of truth.
  propose({ subject, predicate, object, question = "what", source, confidence = null }) {
    if (![subject, predicate, object, source].every(v => safeString(v)) ||
        !QUESTIONS.has(question) ||
        (confidence !== null && (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)))
      fail("COGNITION_CLAIM_INVALID");
    if (this.#claims.size >= this.#max.maxClaims) fail("COGNITION_CLAIM_LIMIT");
    const id = this.#id("f");
    const claim = { id, subject, predicate, object, question, source,
      confidence, status: "proposed", checks: [] };
    this.#claims.set(id, claim);
    this.#event("claim_proposed", id);
    return clone(claim);
  }

  // Compare a candidate against an externally supplied observation.
  // A 'supported' status means the CHECK agrees, not independently verified truth.
  check({ claimId, observed, evidenceRef, method }) {
    if (!safeString(claimId, 40) || !safeString(observed) ||
        !safeString(evidenceRef) || !["measurement", "operator_attestation", "test_result"].includes(method))
      fail("COGNITION_CHECK_INVALID");
    const claim = this.#claims.get(claimId);
    if (!claim) fail("COGNITION_CLAIM_UNKNOWN");
    const check = { claimId, observed, evidenceRef, method,
      matched: same(claim.object, observed) };
    if (this.#checks.length >= this.#max.maxEvents) fail("COGNITION_CHECK_LIMIT");
    this.#checks.push(check);
    claim.checks.push(this.#checks.length - 1);
    // Conflicting checks leave the claim unresolved; never pick a winner silently.
    const all = claim.checks.map(i => this.#checks[i]);
    claim.status = all.some(c => c.matched) && all.some(c => !c.matched)
      ? "proposed" : all.every(c => c.matched) ? "supported" : "refuted";
    this.#event("claim_checked", claimId);
    return { claim: clone(claim), check: clone(check), conflictingEvidence: claim.status === "proposed" && all.length > 1 };
  }

  // Return only supported statements by default; never silently promote proposals.
  query({ subject, predicate, object, question, includeUnverified = false } = {}) {
    for (const value of [subject, predicate, object])
      if (value !== undefined && !safeString(value)) fail("COGNITION_QUERY_INVALID");
    if (question !== undefined && !QUESTIONS.has(question)) fail("COGNITION_QUERY_INVALID");
    if (typeof includeUnverified !== "boolean") fail("COGNITION_QUERY_INVALID");
    return [...this.#claims.values()].filter(c =>
      (includeUnverified || c.status === "supported") &&
      (subject === undefined || c.subject === subject) &&
      (predicate === undefined || c.predicate === predicate) &&
      (object === undefined || c.object === object) &&
      (question === undefined || c.question === question)).map(clone);
  }

  // Only explicitly declared transitive predicates can produce logical inferences.
  // A causal 'why' claim is NEVER assumed transitive.
  infer({ subject, predicate, object, maxDepth = 4 }) {
    if (![subject, predicate, object].every(v => safeString(v)) ||
        !bounded(maxDepth, 1, 8)) fail("COGNITION_INFER_INVALID");
    if (!TRANSITIVE.has(predicate)) return { supported: false, reason: "NOT_TRANSITIVE", evidence: [] };
    const edges = this.query({ predicate });
    const adjacency = new Map();
    for (const c of edges) {
      if (!adjacency.has(c.subject)) adjacency.set(c.subject, []);
      adjacency.get(c.subject).push(c);
    }
    const queue = [{ node: subject, path: [] }];
    const seen = new Set([subject]);
    while (queue.length) {
      const next = queue.shift();
      if (next.path.length >= maxDepth) continue;
      for (const edge of adjacency.get(next.node) ?? []) {
        const path = [...next.path, edge.id];
        if (edge.object === object) return { supported: true, reason: "TRANSITIVE_PATH", evidence: path };
        if (!seen.has(edge.object)) { seen.add(edge.object); queue.push({ node: edge.object, path }); }
      }
    }
    return { supported: false, reason: "NO_SUPPORTED_PATH", evidence: [] };
  }

  predict({ subject, predicate, expected, basedOn = [], confidence = null }) {
    if (![subject, predicate, expected].every(v => safeString(v)) ||
        !Array.isArray(basedOn) || basedOn.length > 20 ||
        new Set(basedOn).size !== basedOn.length ||
        basedOn.some(id => !safeString(id, 40) || this.#claims.get(id)?.status !== "supported") ||
        (confidence !== null && (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)))
      fail("COGNITION_PREDICTION_INVALID");
    if (this.#predictions.size >= this.#max.maxPredictions) fail("COGNITION_PREDICTION_LIMIT");
    const id = this.#id("p");
    const prediction = { id, subject, predicate, expected,
      basedOn: [...basedOn], confidence, state: "pending", observed: null, evidenceRef: null,
      correct: null, correctionId: null };
    this.#predictions.set(id, prediction);
    this.#event("prediction_made", id);
    return clone(prediction);
  }

  resolvePrediction({ predictionId, observed, evidenceRef }) {
    if (!safeString(predictionId, 40) || !safeString(observed) || !safeString(evidenceRef))
      fail("COGNITION_OUTCOME_INVALID");
    const prediction = this.#predictions.get(predictionId);
    if (!prediction) fail("COGNITION_PREDICTION_UNKNOWN");
    if (prediction.state !== "pending") fail("COGNITION_PREDICTION_ALREADY_RESOLVED");
    prediction.state = "resolved";
    prediction.observed = observed;
    prediction.evidenceRef = evidenceRef;
    prediction.correct = prediction.expected === observed;
    this.#event(prediction.correct ? "prediction_correct" : "prediction_failed", predictionId);
    return clone(prediction);
  }

  // Generate a *proposed* correction from a failed prediction. Never auto-verify it.
  // Separate measurements are required before downstream queries treat it as supported.
  proposeCorrection({ predictionId, question = "how" }) {
    if (!safeString(predictionId, 40) || !QUESTIONS.has(question))
      fail("COGNITION_CORRECTION_INVALID");
    const prediction = this.#predictions.get(predictionId);
    if (!prediction) fail("COGNITION_PREDICTION_UNKNOWN");
    if (prediction.state !== "resolved" || prediction.correct)
      fail("COGNITION_NO_FAILED_OUTCOME");
    if (prediction.correctionId) fail("COGNITION_CORRECTION_ALREADY_PROPOSED");
    const claim = this.propose({ subject: prediction.subject, predicate: prediction.predicate,
      object: prediction.observed, question, source: "outcome:" + predictionId });
    prediction.correctionId = claim.id;
    this.#event("correction_proposed", claim.id);
    return { proposal: claim, outcomeEvidenceRef: prediction.evidenceRef,
      verified: false, note: "Correction requires independent checking" };
  }

  // Actual accuracy and unresolved gaps, not LLM self-described certainty.
  assess() {
    const claims = [...this.#claims.values()];
    const predictions = [...this.#predictions.values()];
    const resolved = predictions.filter(p => p.state === "resolved");
    const correct = resolved.filter(p => p.correct).length;
    const conflicts = claims.filter(c => c.status === "proposed" && c.checks.length > 1).map(c => c.id);
    return { version: "fi-cognitive-kernel-v1", authority: "none", externalActions: 0,
      claims: { total: claims.length, proposed: claims.filter(c => c.status === "proposed").length,
        supported: claims.filter(c => c.status === "supported").length,
        refuted: claims.filter(c => c.status === "refuted").length },
      questionsCovered: [...QUESTIONS].filter(q => claims.some(c => c.question === q && c.status === "supported")),
      conflictingClaims: conflicts,
      predictions: { total: predictions.length, resolved: resolved.length, correct,
        accuracy: resolved.length ? correct / resolved.length : null,
        failures: resolved.filter(p => !p.correct).map(p => ({ id: p.id,
          subject: p.subject, expected: p.expected, observed: p.observed,
          evidenceRef: p.evidenceRef })) },
      historyEvents: this.#events.length };
  }

  // Data-only export for future controlled persistence. No secrets or external writes.
  exportSnapshot() {
    return clone({ version: "fi-cognitive-kernel-v1", claims: [...this.#claims.values()],
      checks: this.#checks, predictions: [...this.#predictions.values()], events: this.#events });
  }
}

export const cognitiveQuestions = Object.freeze([...QUESTIONS]);
