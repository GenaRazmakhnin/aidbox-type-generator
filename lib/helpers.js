/**
 * Capitalize first letter
 * @param {string} input string
 * @returns {string}
 */
const capitalize = (str) =>
  typeof str === "string"
    ? `${str.charAt(0).toUpperCase()}${str.slice(1)}`
    : "";

/**
 * Wrap type key with single quotes if source key have dash symbol
 * @param {string} key
 * @returns {string}
 */
const wrapKey = (key) =>
  typeof key !== "string" ? "" : key.includes("-") ? `'${key}'` : key;

/**
 *
 * @param {Array<string> | null} confirms
 * @param {string} name
 * @returns {Object}
 */
const normalizeConfirms = (confirms, name) => {
  if (!Array.isArray(confirms) || !name) {
    return {};
  } else if (confirms.length === 0) {
    return {};
  } else if (confirms.length === 1 && confirms[0] === name) {
    return {};
  } else {
    const cleared = confirms.filter((c) => c !== name);
    return confirms.length === 0 ? {} : { extends: cleared };
  }
};

/**
 * Return string with space count configured by input parameter
 * @param {number} count
 * @returns {string}
 */
const fillIdent = (count) =>
  typeof count !== "number" ? "" : Array(count).fill(" ").join("");

/**
 * Return zen to ts type
 * @param {string} source string
 * @returns {string}
 */
const getPrimitiveTypes = (type) => {
  switch (type) {
    case "zen/string":
      return "string";
    case "zen/boolean":
      return "boolean";
    case "zen/date":
      return "string";
    case "zen/datetime":
      return "string";
    case "zen/number":
      return "number";
    case "zen/integer":
      return "number";
    default:
      console.error("Unknown primitive type", type);
      return `'unknown-primitive(${type})'`;
  }
};

module.exports = {
  capitalize,
  wrapKey,
  normalizeConfirms,
  fillIdent,
  getPrimitiveTypes,
};
