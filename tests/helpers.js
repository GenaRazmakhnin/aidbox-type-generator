const { suite } = require("uvu");
const assert = require("uvu/assert");
const helpers = require("../lib/helpers");

const helpersSuite = suite("helpers");

helpersSuite("[capitalize] input parameter no string", () => {
  assert.equal(helpers.capitalize(null), "");
  assert.equal(helpers.capitalize({}), "");
  assert.equal(helpers.capitalize([]), "");
  assert.equal(helpers.capitalize(undefined), "");
  assert.equal(helpers.capitalize(""), "");
});

helpersSuite("[capitalize] correct parameter", () => {
  assert.equal(helpers.capitalize("test"), "Test");
});

module.exports = { helpersSuite };
