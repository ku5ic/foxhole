import fs from "node:fs";
import path from "node:path";
import url from "node:url";

function readPackageJsonVersion(packageJsonPath: string): string {
  try {
    const raw = fs.readFileSync(packageJsonPath, "utf8");
    const v = (JSON.parse(raw) as Record<string, unknown>)["version"];
    return typeof v === "string" ? v : "unknown";
  } catch {
    return "unknown";
  }
}

function readFoxholeVersion(): string {
  const dir = path.dirname(url.fileURLToPath(import.meta.url));
  return readPackageJsonVersion(path.resolve(dir, "..", "package.json"));
}

function readDependencyVersion(name: string): string {
  const dir = path.dirname(url.fileURLToPath(import.meta.url));
  return readPackageJsonVersion(path.resolve(dir, "..", "node_modules", name, "package.json"));
}

export { readPackageJsonVersion, readFoxholeVersion, readDependencyVersion };
