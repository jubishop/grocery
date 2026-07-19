import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(script, arguments_ = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(root, "scripts", script), ...arguments_],
      {
        cwd: root,
        stdio: "inherit",
      },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(
        `${script} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`,
      ));
    });
  });
}

// Every downstream matcher reads the canonical Instacart alias map. Once that
// shared prerequisite is refreshed, each source writes a distinct output file
// and can be recomputed safely in parallel.
await run("match-instacart-aliases.mjs");
await Promise.all([
  run("match-whole-foods.mjs"),
  run("match-direct-store.mjs", ["safeway"]),
  run("match-direct-store.mjs", ["qfc"]),
  run("match-trader-joes.mjs"),
]);
