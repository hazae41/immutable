import type { Nullable } from "../../libs/nullable/mod.ts";

export class Cacher {

  constructor(
    readonly cache: string,
    readonly files: Map<string, string>
  ) { }

  /**
   * Delete previous cache
   */
  async uncache(): Promise<void> {
    for (const name of await caches.keys()) {
      if (!name.startsWith("#"))
        continue
      if (name === this.cache)
        continue
      await caches.delete(name)
    }
  }

  /**
   * Fetch and cache all files
   * @returns 
   */
  async precache(): Promise<void> {
    const promises = new Array<Promise<unknown>>()

    for (const [file, integrity] of this.files)
      promises.push(this.defetch(new Request(file), integrity).catch(console.error))

    await Promise.all(promises)
  }

  /**
   * Match or fetch and cache
   * @param request 
   * @param integrity 
   * @returns 
   */
  async defetch(request: Request, integrity: string): Promise<Response> {
    const cache = await caches.open(this.cache)

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

    if (!fetched.ok) {
      /**
       * Avoid caching bad responses (404, 500, etc.)
       */
      throw new Error(`Failed to fetch ${request.url}`, { cause: fetched })
    }

    /**
     * Remove junk properties e.g. redirected
     */
    const cleaned = new Response(fetched.body, fetched)

    /**
     * Cache the response
     */
    cache.put(request, cleaned.clone())

    /**
     * Found
     */
    return cleaned
  }

  /**
   * Handle fetch event
   * @param event 
   * @returns 
   */
  handle(request: Request): Nullable<Promise<Response>> {
    const url = new URL(request.url)

    if (url.pathname.endsWith("/"))
      url.pathname = url.pathname.slice(0, -1)

    const integrity = this.files.get(url.pathname)

    if (integrity != null) {
      /**
       * Do magic
       */
      return this.defetch(request, integrity)
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
        return this.defetch(request1, integrity)
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
        return this.defetch(request1, integrity)
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
        return this.defetch(request1, integrity)
      }
    }

    /**
     * Not found
     */
    return
  }

}