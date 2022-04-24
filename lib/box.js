const axios = require("axios");
const fs = require("fs");

module.exports = {
  createBox: ({ url, client, secret }) => {
    const box = axios.create({
      baseURL: url,
      auth: {
        username: client,
        password: secret,
      },
    });

    return {
      instance: box,
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
          if (fs.existsSync("./aidbox-symbols.json")) {
            return JSON.parse(
              fs.readFileSync("./aidbox-symbols.json").toString()
            );
          } else {
            console.log("Cached symbols not found. We will load them");
          }
        }

        const {
          data: { result: ns },
        } = await box.post("/rpc", {
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

        fs.writeFileSync("./symbols.json", JSON.stringify(finalResult));

        return finalResult;
      },
      getSymbol: () => {},
      getNamespaces: () => {},
      getNamespace: () => {},
      getConcept: () => {},
      findConfirms: async (confirms) => {
        const result = new Set();
        for (const confirm of confirms) {
          if (confirm !== "zenbox/Resource") {
            let el = schema[confirm];
            if (!el) {
              const {
                data: {
                  result: { model: definition },
                },
              } = await box.post(
                "/rpc",
                `{
                  :method aidbox.zen/symbol
                  :params { :name ${confirm}}
              }`,
                { headers: { "Content-Type": "application/edn" } }
              );

              schema[confirm] = definition;
              el = definition;
            }
            if (el["fhir/polymorphic"]) {
              continue;
            } else if (zenConfirms[confirm]) {
              result.add(zenConfirms[confirm]);
            } else {
              const name =
                el["zen.fhir/type"] ||
                el["resourceType"] ||
                el["zen/name"].split("/")[1] ||
                `any-${confirm}`;
              const newName = name.includes("-")
                ? name.split("-").map(capitalize).join("")
                : name;
              zenConfirms[confirm] = newName;
              result.add(newName);
            }
          }
        }

        return [...result].map((r) =>
          r === "Resource" ? `Resource<'${resourceName}'>` : r
        );
      },
      healthCheck: async () => {
        try {
          const { data } = await box.get("/__healthcheck");
          return data === "healthy";
        } catch {
          return false;
        }
      },
    };
  },
};
