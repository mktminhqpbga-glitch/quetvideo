/** Build tools, nodes and extensions deterministically for macOS/Linux/Windows.
 * Avoid Bun workspace-filter glob regressions that left Infinite Canvas with an empty node menu.
 */
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
let built = 0;
for (const group of ["tools", "nodes", "ext"] as const) {
  const directory = resolve(root, "packages", group);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const cwd = resolve(directory, entry.name);
    if (!existsSync(resolve(cwd, "package.json"))) continue;
    const packageJson = JSON.parse(await Bun.file(resolve(cwd, "package.json")).text()) as { scripts?: { build?: string } };
    if (!packageJson.scripts?.build) continue;
    console.log("Building", group + "/" + entry.name);
    const child = Bun.spawn([process.execPath, "run", "build"], {
      cwd,
      env: { ...Bun.env, NODE_ENV: "dev" },
      stdout: "inherit", stderr: "inherit", stdin: "ignore",
    });
    if (await child.exited !== 0) throw new Error("Could not build " + group + "/" + entry.name);
    built++;
  }
}
if (built === 0) throw new Error("No ToonFlow plugins were discovered");
console.log("Completed ToonFlow plugin builds:", built);
