import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Relative-time rendering (TimeAgo, Duration, shift windows) reads the
      // clock during render on purpose; every page is force-dynamic and the
      // elements carry suppressHydrationWarning.
      "react-hooks/purity": "off",
      // Palette open/close resets state in an effect deliberately.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
