import { defineConfig } from "vite";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      reporter: ["cobertura", "html"],
      provider: "v8",
      reportsDirectory: "./coverage"
    }
  }
});
