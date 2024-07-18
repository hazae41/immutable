# The Immutable Framework

Create immutable webapps that are secure and resilient.

```bash
npm i @hazae41/immutable
```

[**Node Package 📦**](https://www.npmjs.com/package/@hazae41/immutable)

## Philosophy

Our philosophy is to build webapps that are as immutable as native apps but benefit from the wide distribution of the web. Such apps are built with strong client-side and offline capabilities. Once downloaded they should be immutably cached and only be updated when the user requests it or has opted-in automatic updates.

### Why?

Security and resilience. An immutable webapp is not prone to server-side attacks (e.g. DNS attack, BGP attack, TLS attack). An immutable webapp is always available to its users even if the server is compromised or censored. An immutable webapp can be distributed by other means than a centralized server (e.g. IPFS).

### How?

New and smart engineering techniques. The extensive use of service-workers and new web APIs allow us to build such apps. We leverage `Cache-Control`, `Fetch API` and `Crypto API` to distribute and cache webapps immutably. We improve and merge already existing frameworks such as `Next.js` and `Workbox` to fit exactly our needs.

## Technology

The most important thing about The Immutable Framework is that service-workers are immutably cached.

This is done by using immutable `Cache-Control` headers and `{ updateViaCache: "all" }`.

Once the service-worker is cached, the app cannot be automatically updated by the browser.

In order to update it, we just `register()` a new cache-busted service-worker.

This is done by generating a `service_worker.<hash>.h.js` for each version of your service-worker.

The app runtime fetches `service_worker.js` and check its hash in order to detect updates.

If an update is detected, it can `register()` the new `service_worker.<hash>.h.js` file.

Thus the developer or user is in control of when to update the app (e.g. yes/no/always button).

-

The other great thing is that all other files are also immutably cached, by the service-worker.

This is done just like `workbox` but with even more checks as the hashes are also verified.

-

Your files are immutable and your service-worker verifies the hashes.

This means you only have to trust the service-worker when you first download it.

Users can manually hash the service-worker to verify it has no been compromised.

(This can't be done automatically since there is no way of hashing a service-worker at runtime).

If the service-worker hasn't been compromised the first time you downloaded it, you can trust the whole app, forever!

## Adapters

You can integrate the immutable framework to an existing client-side webapp.

- [Next.js as Immutable](https://github.com/hazae41/next-as-immutable)

Or you can start a new one from the starter example webapp (TODO).

## Setup

You just have to add this code in your service-worker.

### How it works?

The macro code is aimed at being run by `@hazae41/saumon` in order to postprocess the file.

This is done to generate the list of files to cache and compute their SHA-256 hash.

Their hash will be verified at runtime when fetching them and will error on mismatches.

- 

This code will cache the `./out` directory except files starting with `service_worker.`.

Feel free to modify the code to achieve your own caching policy.

Just avoid caching the service-worker itself (`service_worker.<version>.h.js`) as it will compute its own hash.

And since it's the hash before postprocessing, it will fail the runtime check.

```tsx
import { Immutable } from "@hazae41/immutable"

/**
 * Only cache on production
 */
if (process.env.NODE_ENV === "production") {
  /**
   * Use $raw$ to avoid minifiers from touching the code
   */
  const files = $raw$<[string, string][]>(`$run$(async () => {
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
  
    const files = new Array()
  
    for (const absolute of walkSync("./out")) {
      const name = path.basename(absolute)
  
      if (name.startsWith("service_worker."))
        continue
  
      const text = fs.readFileSync(absolute)
      const hash = crypto.createHash("sha256").update(text).digest("hex")
  
      const relative = path.relative("./out", absolute)
  
      files.push([\`/\${relative}\`, hash])
    }
  
    return files
  }, { space: 0 })`)

  const cache = new Immutable.Cache(new Map(files))

  self.addEventListener("activate", (event) => {
    /**
     * Uncache previous version
     */
    event.waitUntil(cache.uncache())

    /**
     * Precache current version
     */
    event.waitUntil(cache.precache())
  })

  /**
   * Respond with cache
   */
  self.addEventListener("fetch", (event) => cache.handle(event))
}
```