#!/usr/bin/env node
/**
 * Build script that ensures VITE_* env vars are available during build
 * This is necessary for Railway deployments where env vars are injected at runtime
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// List of required VITE_* environment variables
const VITE_ENV_VARS = [
  "VITE_APP_ID",
  "VITE_OAUTH_PORTAL_URL",
  "VITE_FRONTEND_FORGE_API_URL",
  "VITE_FRONTEND_FORGE_API_KEY",
  "VITE_APP_TITLE",
  "VITE_APP_LOGO",
  "VITE_ANALYTICS_ENDPOINT",
  "VITE_ANALYTICS_WEBSITE_ID",
];

// Create .env.production file with VITE_* variables
const envContent = VITE_ENV_VARS.map((key) => {
  const value = process.env[key] || "";
  console.log(`  ${key}=${value ? "***" : "(empty)"}`);
  return `${key}=${value}`;
}).join("\n");

const envPath = path.join(__dirname, ".env.production");
fs.writeFileSync(envPath, envContent, "utf-8");

console.log("✅ Created .env.production with VITE_* variables");
console.log("\n📝 Environment variables:");

// Run the actual build with env vars
console.log("\n🔨 Building with Vite and esbuild...");
try {
  // Pass all env vars to the build process
  const buildEnv = { ...process.env };
  execSync("vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist", {
    cwd: __dirname,
    stdio: "inherit",
    env: buildEnv,
  });
  console.log("✅ Build completed successfully");
} catch (error) {
  console.error("❌ Build failed:", error.message);
  process.exit(1);
}
