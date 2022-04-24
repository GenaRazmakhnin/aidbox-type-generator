const { suite } = require("uvu");
const assert = require("uvu/assert");
const helpers = require("../lib/helpers");

const helpersSuite = suite("Helpers");

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

helpersSuite("[wrapKey] input parameter no string", () => {
  assert.equal(helpers.wrapKey(null), "");
  assert.equal(helpers.wrapKey({}), "");
  assert.equal(helpers.wrapKey([]), "");
  assert.equal(helpers.wrapKey(undefined), "");
  assert.equal(helpers.wrapKey(""), "");
});

helpersSuite("[wrapKey] correct parameter", () => {
  assert.equal(helpers.wrapKey("test-test"), "'test-test'");
  assert.equal(helpers.wrapKey("test"), "test");
});

helpersSuite("[normalizeConfirms] incorrect input", () => {
  assert.equal(helpers.normalizeConfirms(null), {});
  assert.equal(helpers.normalizeConfirms(undefined), {});
  assert.equal(helpers.normalizeConfirms(""), {});
  assert.equal(helpers.normalizeConfirms({}), {});
  assert.equal(helpers.normalizeConfirms([]), {});
});

helpersSuite("[normalizeConfirms] with empty array", () => {
  assert.equal(helpers.normalizeConfirms([], "Test"), {});
});

helpersSuite("[normalizeConfirms] name equal first element in array", () => {
  assert.equal(
    helpers.normalizeConfirms(["DeviceRequest"], "DeviceRequest"),
    {}
  );
});

helpersSuite("[normalizeConfirms] name don't exist in input array", () => {
  assert.equal(
    helpers.normalizeConfirms(
      ["DeviceRequest", "Encounter", "Appointment"],
      "Patient"
    ),
    { extends: ["DeviceRequest", "Encounter", "Appointment"] }
  );
});

helpersSuite("[normalizeConfirms] name exist in input array", () => {
  assert.equal(
    helpers.normalizeConfirms(
      ["DeviceRequest", "Encounter", "Appointment"],
      "Encounter"
    ),
    { extends: ["DeviceRequest", "Appointment"] }
  );
});

helpersSuite("[fillIdent] input parameter no number", () => {
  assert.equal(helpers.fillIdent(null), "");
  assert.equal(helpers.fillIdent({}), "");
  assert.equal(helpers.fillIdent([]), "");
  assert.equal(helpers.fillIdent(undefined), "");
  assert.equal(helpers.fillIdent(""), "");
});

helpersSuite("[fillIdent] correct parameter", () => {
  assert.is(helpers.fillIdent(1), " ");
  assert.is(helpers.fillIdent(2), "  ");
});

helpersSuite("[getPrimitiveTypes] general", () => {
  assert.is(helpers.getPrimitiveTypes("zen/string"), "string", "zen/string");
  assert.is(helpers.getPrimitiveTypes("zen/boolean"), "boolean");
  assert.is(helpers.getPrimitiveTypes("zen/date"), "string");
  assert.is(helpers.getPrimitiveTypes("zen/datetime"), "string");
  assert.is(helpers.getPrimitiveTypes("zen/number"), "number");
  assert.is(helpers.getPrimitiveTypes("zen/integer"), "number");
  assert.is(
    helpers.getPrimitiveTypes("zen/coll"),
    "'unknown-primitive(zen/coll)'"
  );
});

helpersSuite.run();
