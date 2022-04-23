const { mergeSuite } = require("./merge");
const { boxSuite } = require("./box");
const { helpersSuite } = require("./helpers");

mergeSuite.run();
boxSuite.run();
helpersSuite.run();
