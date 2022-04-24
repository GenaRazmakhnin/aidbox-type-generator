const { suite } = require("uvu");
const assert = require("uvu/assert");
const MockAdapter = require("axios-mock-adapter");
const { createBox } = require("../lib/box");

const boxSuite = suite("Box");
const box = createBox({
  url: "http://localhost:8090",
  client: "root",
  secret: "secret",
});

const mock = new MockAdapter(box.instance);

boxSuite("init", async () => {
  mock.onGet("/__healthcheck").timeout();
  assert.is(await box.healthCheck(), false);

  mock.onGet("/__healthcheck").reply(200, "healthy");
  assert.is(await box.healthCheck(), true);

  assert.equal(box.instance.defaults.auth, {
    username: "root",
    password: "secret",
  });
  assert.is(box.instance.defaults.baseURL, "http://localhost:8090");
  mock.reset();
});

boxSuite.run();
