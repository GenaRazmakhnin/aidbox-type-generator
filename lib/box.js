const axios = require("axios");

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
