import { Errors } from "libs/errors/index.js"
import { Path } from "libs/path/index.js"

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

    for (const [file, integrity] of this.files)
      promises.push(this.defetch(new Request(file), integrity))

    await Promise.all(promises)
  }

  /**
   * Match or fetch and cache
   * @param request 
   * @param integrity 
   * @returns 
   */
  async defetch(request: Request, integrity: string) {
    try {
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
       * Fetch but skip cache
       */
      const fetched = await fetch(request, { cache: "reload", redirect: "follow", integrity })

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

          const fetched2 = await fetch(request2, { cache: "reload", redirect: "follow", integrity })

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

          const fetched2 = await fetch(request2, { cache: "reload", redirect: "follow", integrity })

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

      cache.put(request, response.clone())

      return response
    } catch (e: unknown) {
      return new Response(Errors.toString(e), { status: 500 })
    }
  }

  /**
   * Handle fetch event
   * @param event 
   * @returns 
   */
  handle(event: FetchEvent, request: Request = event.request) {
    if (process.env.NODE_ENV === "development")
      return

    const url = new URL(request.url)

    if (url.pathname.endsWith("/"))
      url.pathname = url.pathname.slice(0, -1)

    const integrity = this.files.get(url.pathname)

    if (integrity != null) {
      /**
       * Do magic
       */
      event.respondWith(this.defetch(request, integrity))

      /**
       * Found
       */
      return
    }

    /**
     * Match /index.html
     */
    if (url.pathname === "/") {
      const url2 = new URL(url)

      url2.pathname = "/index.html"

      const integrity = this.files.get(url2.pathname)

      if (integrity != null) {
        /**
         * Modify mode
         */
        const request0 = new Request(request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url2, request0)

        /**
         * Do magic
         */
        event.respondWith(this.defetch(request1, integrity))

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

      const integrity = this.files.get(url2.pathname)

      if (integrity != null) {
        /**
         * Modify mode
         */
        const request0 = new Request(request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url2, request0)

        /**
         * Do magic
         */
        event.respondWith(this.defetch(request1, integrity))

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

      const integrity = this.files.get(url2.pathname)

      if (integrity != null) {

        /**
         * Modify mode
         */
        const request0 = new Request(request, { mode: "same-origin" })

        /**
         * Modify url
         */
        const request1 = new Request(url2, request0)

        /**
         * Do magic
         */
        event.respondWith(this.defetch(request1, integrity))

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