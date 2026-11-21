// A route throws HttpError for an expected failure. Only publicMessage reaches the browser.
// Any other thrown error becomes a generic 500 and is written to the server log only.
export class HttpError extends Error {
  status: number;
  publicMessage: string;
  code?: string;
  constructor(status: number, publicMessage: string, code?: string) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
    this.code = code;
  }
}

export class TimeoutError extends Error {
  constructor() { super('timeout'); }
}
