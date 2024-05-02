const fs = require("fs");

const fix = (dirPath) => {
  if (!fs.existsSync(dirPath)) return;
  for (const dir of fs.readdirSync(dirPath)) {
    const jsonFile = dirPath + dir + "/package.json";
    const packageJson = JSON.parse(fs.readFileSync(jsonFile).toString());
    packageJson.module = "dist/cjs/index.js";
    fs.writeFileSync(jsonFile, JSON.stringify(packageJson, null, 2));
    fix(dirPath + dir + "/" + dirPath);
  }
};

fix("node_modules/@injectivelabs/");
