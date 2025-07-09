function mapValues(obj, mapFn) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      return [key, mapFn(value, key)];
    }),
  );
}

module.exports.mapValues = mapValues;

function stringifyObjectValues(obj) {
  return mapValues(obj, (value) => {
    return JSON.stringify(value);
  });
}

module.exports.stringifyObjectValues = stringifyObjectValues;
