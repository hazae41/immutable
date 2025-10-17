# The Immutable Toolbox

Create immutable webapps that are secure and resilient

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

The most important thing about The Immutable Toolbox is that service-workers are immutably cached.

This is done by using `Cache-Control` headers and `{ updateViaCache: "all" }` options.

The service-worker is cached for one year, so it won't be auto-updated before one year has passed.

In order to update it before one year, we need to `register()` a new service-worker at a different URL.

The webapp runtime fetches `service_worker.js` and check its hash in order to detect updates.

If an update is detected, it can `register()` the new `service_worker.js?version=<version>` file.

Thus the developer or user is in control of when to update the webapp (e.g. a yes/no/always button).

-

The other great thing is that all other files are also immutably cached by the service-worker.

This is done just like `workbox` but with even more checks as the hashes are also verified.

All files are hashed and verified using native SHA-256 which is both strong and fast.

This makes your webapp immutable, as long as the service worker is not updated.

-

It is compatible with [HTTPSec](https://github.com/hazae41/httpsec), which means the HTML page can have its integrity enforced.

Unfortunately, HTTPSec can't enforce the service worker, but it can enforce pages, and pages can enforce in-page scripts and assets.

So you shouldn't use the service worker for anything important except caching your webapp or doing normal service worker stuff.

-

The webapp is only compromisable when you first download it, when you manually update it, or when it's auto-updated after one year.

## Subframeworks

- [Next.js as Immutable](https://github.com/hazae41/next-as-immutable)

## Examples

Here is a list of immutable webapps

- https://wallet.brume.money / https://github.com/brumeproject/wallet
