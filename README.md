# The Immutable Framework

Create immutable webapps that are secure and resilient.

```bash
npm i @hazae41/immutable
```

[**Node Package 📦**](https://www.npmjs.com/package/@hazae41/immutable)

## Philosophy

Our philosophy is to build webapps that are as immutable as native apps but benefit from the wide distribution of the web. Such webapps are built with strong client-side and offline capabilities. Once downloaded they should be immutably cached and only be updated when the user requests it or has opted-in automatic updates.

### Why?

Security and resilience. An immutable webapp is not prone to server-side attacks (e.g. DNS attack, BGP attack, TLS attack). An immutable webapp is always available to its users even if the server is compromised or censored. An immutable webapp can be distributed by other means than a centralized server (e.g. IPFS).

### How?

New and smart engineering techniques. The extensive use of service-workers and new web APIs allow us to build such webapps. We leverage `Cache-Control`, `Fetch API` and `Crypto API` to distribute and cache webapps immutably. We improve and merge already existing frameworks such as `Next.js` and `Workbox` to fit exactly our needs.

## Technology

The most important thing about The Immutable Framework is that service-workers are immutably cached.

This is done by using immutable `Cache-Control` headers and `{ updateViaCache: "all" }` options.

Once the service-worker is cached, the webapp cannot be automatically updated by the browser.

In order to update it, we need to `register()` a new service-worker at a different URL.

This is done by generating a `service_worker.<version>.js` for each version of your service-worker.

The webapp runtime fetches `service_worker.latest.js` and check its hash in order to detect updates.

If an update is detected, it can `register()` the new `service_worker.<version>.js` file.

Thus the developer or user is in control of when to update the webapp (e.g. a yes/no/always button).

If the service-worker is updated anyway by the browser (e.g. cache failure), the webapp errors.

-

The other great thing is that all other files are also immutably cached by the service-worker.

This is done just like `workbox` but with even more checks as the hashes are also verified.

All files are hashed and verified using SHA-256 which is both strong and fast.

-

The Immutable Framework also does things right to avoid server-side attacks at much as possible.

The bootpage is a special webpage that only contains glue code to register the service-worker.

You can manually hash the bootpage and the service-worker to verify they have not been tampered.

And since the service-worker verifies the hashes of other files (pages, scripts, assets).

That means you don't need to manually verify the hash of other files!

So the the only way to compromise the webapp is when you first download it.

Otherwise you can trust the whole webapp forever unless you update it!

-

For it to work fine each webpage is replaced by the bootpage.

Let's suppose you want to visit `/posts.html`.

You will be served with the bootpage.

The true webpage is buried in a path like `/_posts.html`.

The service-worker will just override all `/<name>.html` with the content of `/_<name>.html` in its cache.

The bootpage will then reload itself, hitting into the service-worker cache, and display the true webpage.

So it doesn't really matter which URL you visit the first time, as long as you're served with the bootpage!

-

Updates are tricky since you can't really verify them before applying them.

An update will be able to use the storage and cookies before the user can erase them.

One thing possible is to clear the storage just before a new service-worker is activated.

Or encrypt it with an user-password and prompting that password after the update.

So the user is able to manually verify the new service-worker before entering his password.

## Adapters

You can integrate the immutable framework to an existing client-side webapp.

- [Next.js as Immutable](https://github.com/hazae41/next-as-immutable)

Or you can start a new one from the starter example webapp (TODO).

## Setup

You just have to add this code to your service-worker.

### How it works?

The macro code is aimed at being run by `@hazae41/saumon` in order to postprocess the file.

This is done to generate the list of files to cache and compute their SHA-256 hash.

Their hash will be verified at runtime when fetching them and will error on mismatches.

- 

This code will cache the `./out` directory except files starting with `service_worker.`.

Feel free to modify the code to achieve your own caching policy.

Just avoid caching the service-worker itself (`service_worker.<version>.js`) as it will compute its own hash.

And since it's the hash before postprocessing, it will fail the runtime check.

```tsx
import { Immutable } from "@hazae41/immutable"

/**
 * Declare global macro
 */
declare function $raw$<T>(script: string): T

/**
 * Only cache on production
 */
if (process.env.NODE_ENV === "production") {
  /**
   * Use $raw$ to avoid minifiers from mangling the code
   */
  const files = $raw$<[string, string][]>(`$run$(async () => {
    const fs = await import("fs")
    const path = await import("path")
    const crypto = await import("crypto")
  
    function* walkSync(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name > b.name ? 1 : -1)
  
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
      const filename = path.basename(absolute)
  
      /**
       * Do not cache saumon files
       */
      if (filename.endsWith(".saumon.js"))
        continue
      
      /**
       * Do not cache service-workers
       */
      if (filename.startsWith("service_worker."))
        continue

      /**
       * Do not cache bootpages
       */
      if (filename.endsWith(".html") && !filename.startsWith("_"))
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