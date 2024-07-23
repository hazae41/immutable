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
    await caches.delete("#files")
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
    const cache = await caches.open("#files")

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

    let response = cleaned

    /**
     * Try to fetch similar URLs
     */
    if (!response.ok) {
      const url = new URL(request.url)

      /**
       * Match <pathname>/index.html
       */
      if (url.pathname.endsWith("/index.html")) {
        const url2 = new URL(url)

        /**
         * Remove /index.html
         */
        url2.pathname = Path.dirname(url.pathname)

        const request2 = new Request(url2, request)

        const fetched2 = await fetch(request2, { cache: "reload" })

        const cleaned2 = new Response(fetched2.body, fetched2)

        if (!cleaned2.ok)
          /**
           * Return original error
           */
          return response

        response = cleaned2

        /**
         * Continue
         */
      }

      /**
       * Match <pathname>.html
       */
      else if (url.pathname.endsWith(".html")) {
        const url2 = new URL(url)

        /**
         * Remove .html
         */
        url2.pathname = url.pathname.slice(0, -5)

        const request2 = new Request(url2, request)

        const fetched2 = await fetch(request2, { cache: "reload" })

        const cleaned2 = new Response(fetched2.body, fetched2)

        if (!cleaned2.ok)
          /**
           * Return original error
           */
          return response

        response = cleaned2

        /**
         * Continue
         */
      }

      else {
        /**
         * Not found
         */
        return response
      }

      /**
       * Continue
       */
    }

    const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer()))
    const hashRawHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const received = hashRawHex

    if (received !== expected)
      throw new InvalidSha256HashError(request.url, expected, received)

    cache.put(request, response.clone())

    return response
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

    const [dirname, filename] = Path.pathnames(url.pathname)

    /**
     * Match /index.html
     */
    if (url.pathname === "/") {
      const url2 = new URL(url)

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
     * Match <pathname>.html
     */
    if (url.pathname !== "/") {
      const url2 = new URL(url)

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
     * Match <pathname>/index.html
     */
    if (url.pathname !== "/") {
      const url2 = new URL(url)

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
      const url2 = new URL(url)

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
     * Match <pathname>/_index/index.html
     */
    if (url.pathname !== "/") {
      const url2 = new URL(url)

      url2.pathname += "/_index/index.html"

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
    if (url.pathname !== "/") {
      const url2 = new URL(url)

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
     * Match <dirname>/_<filename>/index.html
     */
    if (url.pathname !== "/") {
      const url2 = new URL(url)

      url2.pathname = `${dirname}/_${filename}/index.html`

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