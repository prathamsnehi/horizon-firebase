#!/usr/bin/env node
/**
 * Dump `debug_logs` trace documents as clean JSON for the Horizon Trace Viewer.
 * (TEST BRANCH tooling — reads the debug_logs collection written by the tracer.)
 *
 * Auth: uses Application Default Credentials. Run once:
 *     gcloud auth application-default login
 *     export GOOGLE_CLOUD_PROJECT=horizon-sidequests
 *
 * Usage:
 *     node scripts/get-trace.js                 # the most recent trace
 *     node scripts/get-trace.js <documentId>    # a specific doc (id from the console URL)
 *     node scripts/get-trace.js --last 5        # the last 5 traces, as a JSON array
 *     node scripts/get-trace.js --type described # most recent trace of that type
 *
 * Pipe to the clipboard, then paste into the viewer:
 *     node scripts/get-trace.js | pbcopy
 */
const admin = require("firebase-admin");

admin.initializeApp(); // resolves project + credentials from ADC / GOOGLE_CLOUD_PROJECT
const db = admin.firestore();
const COLLECTION = "debug_logs";

function parseArgs(argv) {
  const args = { id: null, last: 1, type: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--last") args.last = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === "--type") args.type = argv[++i];
    else if (!a.startsWith("--")) args.id = a;
  }
  return args;
}

async function main() {
  const { id, last, type } = parseArgs(process.argv.slice(2));

  if (id) {
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) {
      console.error(`No document "${id}" in ${COLLECTION}.`);
      process.exit(1);
    }
    console.log(JSON.stringify(snap.data(), null, 2));
    return;
  }

  let q = db.collection(COLLECTION);
  if (type) q = q.where("type", "==", type);
  const snap = await q.orderBy("startedAt", "desc").limit(last).get();

  if (snap.empty) {
    console.error(`No traces found in ${COLLECTION}${type ? ` (type="${type}")` : ""}.`);
    process.exit(1);
  }

  const docs = snap.docs.map((d) => d.data());
  // Single trace → a bare object (drops straight into the viewer). Many → an array.
  console.log(JSON.stringify(docs.length === 1 ? docs[0] : docs, null, 2));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("[get-trace] failed:", err.message || err);
    process.exit(1);
  }
);
