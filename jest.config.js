/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  transform: {
    "^.+\\.ts?$": ["ts-jest", { isolatedModules: true }]
  },
  testEnvironment: "node",
  modulePathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/packages/ibc-routing"],
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    "<rootDir>/packages/contracts-sdk",
    "<rootDir>/packages/contracts-build",
    "<rootDir>/packages/.+/build", // ignore every build/ of every sub directory of packages
    "<rootDir>/packages/.+/dist",
    "<rootDir>/node_modules/",
    "<rootDir>/packages/.+/node_modules/"
  ]
};
