/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  transform: {
    "^.+\\.ts?$": ["ts-jest", { isolatedModules: true }]
  },
  testEnvironment: "node",
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
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
