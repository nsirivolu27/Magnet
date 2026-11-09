import { cp } from "node:fs/promises";

await cp("src/magnet/store/migrations", ".testbuild/src/magnet/store/migrations", { recursive: true });
// Preserve the mobile package's CommonJS boundary for its compiled API tests.
await cp("apps/mobile/package.json", ".testbuild/apps/mobile/package.json");
