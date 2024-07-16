export class InvalidSha256HashError extends Error {
  readonly #class = InvalidSha256HashError
  readonly name = this.#class.name

  constructor(
    /**
     * Resource
     */
    readonly resource: string,

    /**
     * Expected hash
     */
    readonly expected: string,

    /**
     * Received hash
     */
    readonly received: string
  ) {
    super(`Invalid SHA-256 hash for ${resource}. Expected ${expected} but received ${received}.`)
  }

}