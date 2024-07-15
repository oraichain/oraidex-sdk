import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      reporter: ["cobertura", "html"],
      provider: "v8",
      reportsDirectory: "./coverage",
      exclude: [
        ...configDefaults.exclude,
        "**/packages/contracts-sdk/**",
        "**/packages/contracts-build/**",
        "**/packages/*/build/**", // ignore every build/ of every sub directory of packages
        "**/packages/oraidex-common/src/typechain-types/**",
        "**/packages/oraidex-common-ui/**"
      ]
    },
    exclude: [...configDefaults.exclude]
  }
});
