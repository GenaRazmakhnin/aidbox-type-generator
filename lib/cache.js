const fs = require("fs");

const prepareItem = (enable, path, item) => {
  if (enable && fs.existsSync(path + "/" + item + ".json")) {
    const data = JSON.parse(fs.readFileSync(path + "/" + item + ".json"));
    return new Map(Object.entries(data));
  } else {
    return new Map();
  }
};

module.exports = {
  /**
   *
   * @param {boolean} read/write all cached info into file
   * @param {string} cache path
   * @returns
   */
  createCache: (
    storeInFiles = false,
    cachePath = `${process.cwd()}/.cache`
  ) => {
    const confirms = prepareItem(storeInFiles, cachePath, "confirms");
    const schema = prepareItem(storeInFiles, cachePath, "schema");
    const primitiveTypes = prepareItem(
      storeInFiles,
      cachePath,
      "primitiveTypes"
    );
    const valueSets = prepareItem(storeInFiles, cachePath, "valueSets");

    if (storeInFiles && !fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath);
    }

    return {
      confirms,
      schema,
      primitiveTypes,
      valueSets,
      cachePath,
      clearFolder: () =>
        fs.existsSync(cachePath) && fs.rmSync(cachePath, { recursive: true }),
      save: () => {
        console.log("here", storeInFiles);
        console.log("Start save cache...");
        if (storeInFiles) {
          console.log("Save in files");

          fs.writeFileSync(
            cachePath + "/confirms.json",
            JSON.stringify(confirms)
          );

          fs.writeFileSync(cachePath + "/schema.json", JSON.stringify(schema));

          fs.writeFileSync(
            cachePath + "/valuesets.json",
            JSON.stringify(valueSets)
          );

          fs.writeFileSync(
            cachePath + "/primitiveTypes.json",
            JSON.stringify(primitiveTypes)
          );
          console.log("Save cache finished");
        } else {
          console.log("Save cache in files disabled");
        }
        return true;
      },
    };
  },
};
