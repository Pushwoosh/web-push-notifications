
const levels = {
  error: 1,
  info: 2,
  debug: 3
};

export default class Logger {
  constructor(level) {
    this.setLevel(level);

    Object.keys(levels).forEach(k => {
      const n = levels[k];
      this[k] = (...args) => {
        if (n <= this.n) {
          console.trace(k, ...args); // eslint-disable-line no-console
        }
      };
    });
  }

  setLevel(level) {
    if (!levels[level]) {
      level = 'info'; // eslint-disable-line no-param-reassign
    }
    this.n = levels[level];
  }
}
