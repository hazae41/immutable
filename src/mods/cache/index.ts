import { Path } from "libs/path/index.js"
import { InvalidSha256HashError } from "./errors.js"

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

    const url = new URL(event.request.url)

    if (url.pathname.endsWith("/"))
      url.pathname = url.pathname.slice(0, -1)

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

    const [dirname, filename] = Path.dirname(url.pathname)

    /**
     * Probably not a directory
     */
    if (filename.includes("."))
      /**
       * Not found
       */
      return

    /**
     * Match /index.html
     */
    if (url.pathname === "/") {
      const url2 = new URL(event.request.url)

      url2.pathname = "/index.html"

      const hash = this.files.get(url2.pathname)

      if (hash != null) {

        /**
         * Modify mode
         */
        const request0 = new Request(event.request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url2, request0)

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
     * Match <pathname>/index.html
     */
    if (url.pathname !== "/") {
      const url2 = new URL(event.request.url)

      url2.pathname += "/index.html"

      const hash = this.files.get(url2.pathname)

      if (hash != null) {

        /**
         * Modify mode
         */
        const request0 = new Request(event.request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url2, request0)

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
     * Match <pathname>/_index.html
     */
    if (url.pathname !== "/") {
      const url2 = new URL(event.request.url)

      url2.pathname += "/_index.html"

      const hash = this.files.get(url2.pathname)

      if (hash != null) {

        /**
         * Modify mode
         */
        const request0 = new Request(event.request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url2, request0)

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
     * Match <pathname>.html
     */
    if (url.pathname !== "/") {
      const url2 = new URL(event.request.url)

      url2.pathname += ".html"

      const hash = this.files.get(url2.pathname)

      if (hash != null) {
        /**
         * Modify mode
         */
        const request0 = new Request(event.request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url2, request0)

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
     * Match <dirname>/_<filename>.html
     */
    {
      const url2 = new URL(event.request.url)

      url2.pathname = `${dirname}/_${filename}.html`

      const hash = this.files.get(url2.pathname)

      if (hash != null) {

        /**
         * Modify mode
         */
        const request0 = new Request(event.request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url2, request0)

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