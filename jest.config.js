// jest.config.js
module.exports = {
  transform: {
    "^.+packages/universal-swap/src/helper\\.ts$": "ts-jest", // use ts-jest for tests that have spyOn mocking
    "^.+\\.ts?$": ["@swc/jest"]
  },
  testEnvironment: "node",
  modulePathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/packages/ibc-routing"],
  collectCoverage: true,
  coverageReporters: ["cobertura", "html"],
  coveragePathIgnorePatterns: [
    "<rootDir>/packages/contracts-sdk",
    "<rootDir>/packages/contracts-build",
    "<rootDir>/packages/.+/build", // ignore every build/ of every sub directory of packages
    "<rootDir>/packages/.+/dist",
    "<rootDir>/node_modules/",
    "<rootDir>/packages/.+/node_modules/",
    "<rootDir>/packages/.+/tests/"
  ]
};
