const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function copyFile(relativePath) {
  fs.copyFileSync(path.join(root, relativePath), path.join(dist, relativePath));
}

function copyDir(relativePath) {
  fs.cpSync(path.join(root, relativePath), path.join(dist, relativePath), { recursive: true });
}

fs.rmSync(dist, { force: true, recursive: true });
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(path.join(dist, "public"), { recursive: true });

["index.html", "styles.css", "app.js", "apps-script.gs", "manifest.webmanifest"].forEach(copyFile);
copyDir("public");

const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || "";
fs.writeFileSync(
  path.join(dist, "config.js"),
  `window.IDOL_LAB_CONFIG = {\n  GOOGLE_APPS_SCRIPT_URL: ${JSON.stringify(appsScriptUrl)},\n};\n`,
);
fs.writeFileSync(path.join(dist, ".nojekyll"), "");

console.log("Build complete: dist/");
