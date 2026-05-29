/**
 * Sync en.json leaf strings into en-to-th.json from paired th.json values.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const locales = path.join(__dirname, "../src/locales");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(locales, name), "utf-8"));
}

function walk(enNode, thNode, fn) {
  if (typeof enNode === "string") {
    fn(enNode, thNode);
    return;
  }
  if (enNode && typeof enNode === "object" && !Array.isArray(enNode)) {
    for (const k of Object.keys(enNode)) {
      if (thNode?.[k] === undefined) continue;
      walk(enNode[k], thNode[k], fn);
    }
  }
}

const en = readJson("en.json");
const th = readJson("th.json");
const enToTh = readJson("en-to-th.json");

let synced = 0;
walk(en, th, (enStr, thStr) => {
  enToTh[enStr] = thStr;
  synced += 1;
});

fs.writeFileSync(
  path.join(locales, "en-to-th.json"),
  JSON.stringify(enToTh, null, 2) + "\n",
  "utf-8",
);

console.log(`sync-locale-keys: synced ${synced} en→th leaves`);


