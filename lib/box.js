const axios = require("axios");
const fs = require("fs/promises");

module.exports = {
  createBox: ({ url, client, secret }) => {
    const instance = axios.create({
      baseURL: url,
      auth: {
        username: client,
        password: secret,
      },
    });

    return {
      instance,
      /**
       * Load all symbols from aidbox and filter them by input parameters
       * @param {Array<RegExp>} list of excluded namespaces
       * @param {Array<string>} list of excluded symbols
       * @param {boolean} use saved symbols file for prevent load list again
       * @returns {Array<string>}
       */
      loadAllSymbols: async (
        excludeNamespaces,
        excludedTags,
        useCache = false
      ) => {
        if (useCache) {
          if (await fs.stat("./aidbox-symbols.json").catch(() => false)) {
            return JSON.parse(
              (await fs.readFile("./aidbox-symbols.json")).toString()
            );
          } else {
            console.log("Cached symbols not found. We will load them");
          }
        }
        const {
          data: { result: ns },
        } = await instance.post("/rpc", {
          method: "aidbox.zen/namespaces",
          params: {},
        });
        const namespaces = ns.filter(
          (namespace) =>
            !excludeNamespaces.some((symbol) => symbol.test(namespace))
        );

        const symbols = [];
        for (const namespace of namespaces) {
          const {
            data: { result },
          } = await box.post(
            "/rpc",
            `{
                  :method aidbox.zen/symbols
                  :params { :ns ${namespace}}
              }`,
            { headers: { "Content-Type": "application/edn" } }
          );
          result.map((r) => symbols.push(`${namespace}/${r.name}`));
        }
        const finalResult = symbols.filter(
          (s) => !excludedTags.some((exc) => s.startsWith(exc))
        );
        await fs.writeFile("./symbols.json", JSON.stringify(finalResult));

        return finalResult;
      },
      getSymbol: () => {},
      getNamespaces: () => {},
      getNamespace: () => {},
      getConcept: () => {},
      healthCheck: async () => {
        try {
          const { data } = await instance.get("/__healthcheck");
          return data === "healthy";
        } catch {
          return false;
        }
      },
    };
  },
};
