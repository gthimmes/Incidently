import { execSync } from "child_process";
import path from "path";

// Reseed so every E2E run starts from the same demo state
// (INC-1006 live on Payments, 6 services, 3 runbooks, 4 alerts).
export default function globalSetup() {
  execSync("npx tsx prisma/seed.ts", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
  });
}
