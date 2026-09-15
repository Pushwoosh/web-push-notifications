export function mapValues(obj, mapFn) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      return [key, mapFn(value, key)];
    }),
  );
}

export function stringifyObjectValues(obj) {
  return mapValues(obj, (value) => {
    return JSON.stringify(value);
  });
}
