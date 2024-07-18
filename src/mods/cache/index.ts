import { InvalidSha256HashError } from "./errors.js"

export function $compute$(directory: string) {
  return `$run$(async () => {
    const fs = await import("fs")
    const path = await import("path")
    const crypto = await import("crypto")
  
    function* walkSync(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true })
  
      for (const file of files) {
        if (file.isDirectory()) {
          yield* walkSync(path.join(dir, file.name))
        } else {
          yield path.join(dir, file.name)
        }
      }
    }
  
    const filesAndHashes = new Array()
  
    for (const absolute of walkSync("${directory}")) {
      const text = fs.readFileSync(absolute)
      const hash = crypto.createHash("sha256").update(text).digest("hex")
  
      const relative = path.relative("${directory}", absolute)
  
      filesAndHashes.push([\`/\${relative}\`, hash])
    }
  
    return filesAndHashes
  }, { space: 0 })`
}

export class Cache {

  constructor(
    readonly files: Map<string, string>
  ) { }

  /**
   * Uncache all files
   */
  async uncache() {
    await caches.delete("meta")
  }

  /**
   * Fetch and cache all files
   * @returns 
   */
  async precache() {
    if (process.env.NODE_ENV === "development")
      return

    const promises = new Array<Promise<Response>>()

    for (const [file, hash] of this.files)
      promises.push(this.defetch(new Request(file), hash))

    await Promise.all(promises)
  }

  /**
   * Match or fetch and cache
   * @param request 
   * @param expected 
   * @returns 
   */
  async defetch(request: Request, expected: string) {
    const cache = await caches.open("meta")

    /**
     * Check cache if possible
     */
    if (request.cache !== "reload") {
      const cached = await cache.match(request)

      if (cached != null)
        /**
         * Found
         */
        return cached

      /**
       * Not found
       */
    }

    /**
     * Fetch but skip cache-control
     */
    const fetched = await fetch(request, { cache: "reload" })

    /**
     * Remove junk properties e.g. redirected
     */
    const cleaned = new Response(fetched.body, fetched)

    /**
     * Errors are not verified nor cached
     */
    if (!cleaned.ok)
      return cleaned

    const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await cleaned.clone().arrayBuffer()))
    const hashRawHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const received = hashRawHex

    if (received !== expected)
      throw new InvalidSha256HashError(request.url, expected, received)

    cache.put(request, cleaned.clone())

    return cleaned
  }

  /**
   * Handle fetch event
   * @param event 
   * @returns 
   */
  handle(event: FetchEvent) {
    if (process.env.NODE_ENV === "development")
      return

    /**
     * Match exact
     */
    const url = new URL(event.request.url)

    const hash = this.files.get(url.pathname)

    if (hash != null) {
      /**
       * Do magic
       */
      event.respondWith(this.defetch(event.request, hash))

      /**
       * Found
       */
      return
    }

    /**
     * Not a directory
     */
    if (url.pathname.split("/").at(-1)!.includes("."))
      /**
       * Not found
       */
      return

    /**
     * Match .html
     */
    {
      const url = new URL(event.request.url)

      url.pathname += ".html"

      const hash = this.files.get(url.pathname)

      if (hash != null) {
        /**
         * Modify mode
         */
        const request0 = new Request(event.request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url, request0)

        /**
         * Do magic
         */
        event.respondWith(this.defetch(request1, hash))

        /**
         * Found
         */
        return
      }
    }

    /**
     * Match /index.html
     */
    {
      const url = new URL(event.request.url)

      url.pathname += "/index.html"

      const hash = this.files.get(url.pathname)

      if (hash != null) {

        /**
         * Modify mode
         */
        const request0 = new Request(event.request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url, request0)

        /**
         * Do magic
         */
        event.respondWith(this.defetch(request1, hash))

        /**
         * Found
         */
        return
      }
    }

    /**
     * Not found
     */
    return
  }

}