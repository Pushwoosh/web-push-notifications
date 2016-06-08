class PushwooshError extends Error {
  constructor(text, code) {
    super(text);
    this.code = code;
  }
}

PushwooshError.codes = {
  userDenied: 'user_denied'
};

export default PushwooshError;
