// istanbul ignore next
const isObject = (obj) => {
  if (typeof obj === "object" && obj !== null) {
    if (typeof Object.getPrototypeOf === "function") {
      const prototype = Object.getPrototypeOf(obj);
      return prototype === Object.prototype || prototype === null;
    }

    return Object.prototype.toString.call(obj) === "[object Object]";
  }

  return false;
};

const merge = (...objects) =>
  objects.reduce((result, current) => {
    Object.keys(current).forEach((key) => {
      if (Array.isArray(result[key]) && Array.isArray(current[key])) {
        result[key] = merge.options.mergeArrays
          ? Array.from(new Set(result[key].concat(current[key])))
          : current[key];
      } else if (isObject(result[key]) && isObject(current[key])) {
        result[key] = merge(result[key], current[key]);
      } else {
        result[key] = current[key];
      }
    });

    return result;
  }, {});

const defaultOptions = {
  mergeArrays: true,
};

merge.options = defaultOptions;

merge.withOptions = (options, ...objects) => {
  merge.options = {
    mergeArrays: true,
    ...options,
  };

  const result = merge(...objects);

  merge.options = defaultOptions;

  return result;
};

module.exports = { merge };
