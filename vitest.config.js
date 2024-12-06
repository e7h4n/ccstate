import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "json-summary", "json", "cobertura"],
      provider: "v8",
      exclude: [
        ...coverageConfigDefaults.exclude,
        "**/dist/**",
        "**/types/**",
        "**/*.config.*",
      ],
    },
  },
});
