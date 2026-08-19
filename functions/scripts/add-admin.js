#!/usr/bin/env node
/**
 * Grant, revoke, or list dashboard admins.
 *
 * Membership is simply the existence of a document at `admins/{uid}` — the
 * Firestore rules check for it before returning any generation sample. This
 * script writes that document with the Admin SDK, which bypasses the rules
 * (the rules deny client writes to `admins` on purpose).
 *
 * Auth: uses Application Default Credentials. Run once:
 *     gcloud auth application-default login
 *     export GOOGLE_CLOUD_PROJECT=horizon-sidequests
 *
 * Usage:
 *     node scripts/add-admin.js <uid> [note]   # grant access
 *     node scripts/add-admin.js --list         # who has access
 *     node scripts/add-admin.js --remove <uid> # revoke access
 *
 * Find a uid by signing in at /admin — the not-authorized screen shows it —
 * or in the Firebase console under Authentication -> Users.
 */
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const COLLECTION = "admins";

async function list() {
  const snap = await db.collection(COLLECTION).get();
  if (snap.empty) {
    console.log("No admins yet. Nobody can read the dashboard.");
    return;
  }
  console.log(`${snap.size} admin(s):`);
  for (const doc of snap.docs) {
    const { note, addedAt } = doc.data();
    const when = addedAt ? new Date(addedAt).toISOString().slice(0, 10) : "unknown";
    console.log(`  ${doc.id}${note ? `  (${note})` : ""}  added ${when}`);
  }
}

async function grant(uid, note) {
  await db
    .collection(COLLECTION)
    .doc(uid)
    .set({ addedAt: Date.now(), ...(note ? { note } : {}) }, { merge: true });
  console.log(`Granted dashboard access to ${uid}.`);
  console.log("Takes effect immediately — reload /admin.");
}

async function revoke(uid) {
  const ref = db.collection(COLLECTION).doc(uid);
  if (!(await ref.get()).exists) {
    console.error(`${uid} is not an admin — nothing to remove.`);
    process.exit(1);
  }
  await ref.delete();
  console.log(`Revoked dashboard access for ${uid}.`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) return list();

  const removeAt = args.indexOf("--remove");
  if (removeAt !== -1) {
    const uid = args[removeAt + 1];
    if (!uid) {
      console.error("Usage: node scripts/add-admin.js --remove <uid>");
      process.exit(1);
    }
    return revoke(uid);
  }

  const [uid, ...rest] = args.filter((a) => !a.startsWith("--"));
  if (!uid) {
    console.error("Usage: node scripts/add-admin.js <uid> [note]");
    console.error("       node scripts/add-admin.js --list");
    console.error("       node scripts/add-admin.js --remove <uid>");
    process.exit(1);
  }
  return grant(uid, rest.join(" ") || undefined);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("[add-admin] failed:", err.message || err);
    process.exit(1);
  }
);
