import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const source = resolve(
  repositoryRoot,
  "../tokipona-asset/exports/runtime/forest-chapter/waterwheel-benchmark/v0.6/traveler-atlas.v0.6.png",
);
const destination = resolve(
  repositoryRoot,
  "src/local-art-cache/traveler-atlas.v0.6.png",
);
const expectedSha256 = "6f1ab3cff9313ca2d69a684f632766c11ba23e4bb676b6448a5517b47a7a69ba";
const bytes = readFileSync(source);
const actualSha256 = createHash("sha256").update(bytes).digest("hex");
if (actualSha256 !== expectedSha256) {
  throw new Error("local traveler atlas digest does not match the reviewed v0.6 candidate");
}
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log("local_traveler_atlas_ready:v0.6");

const forestSource = resolve(repositoryRoot,
  "../tokipona-asset/exports/runtime/forest-chapter/waterwheel-benchmark/v0.3/background-far.v0.3.png");
const forestBytes = readFileSync(forestSource);
if (createHash("sha256").update(forestBytes).digest("hex") !==
    "0998ab9342060b8bfabbd16aa5d23543dc664bf6957aa0aa0257ae59e7911609") {
  throw new Error("local forest backdrop digest does not match the existing v0.3 candidate");
}
copyFileSync(forestSource, resolve(repositoryRoot, "src/local-art-cache/background-far.v0.3.png"));
console.log("local_forest_backdrop_ready:v0.3");
