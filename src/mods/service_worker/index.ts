import { Path } from "libs/path/index.js"
import { getOrWaitActiveServiceWorkerOrThrow } from "libs/service_worker/index.js"

export class ServiceWorkerRegistrationWithUpdate {

  constructor(
    readonly registration: ServiceWorkerRegistration,
    readonly update?: () => Promise<ServiceWorkerRegistration>
  ) { }

}

export async function register(crudeScriptRawUrl: string | URL, options: RegistrationOptions = {}): Promise<ServiceWorkerRegistrationWithUpdate> {
  const { scope, type } = options

  if (process.env.NODE_ENV !== "production") {
    const fresh = await navigator.serviceWorker.register(crudeScriptRawUrl, { scope, type, updateViaCache: "none" })

    // NOOP

    return new ServiceWorkerRegistrationWithUpdate(fresh)
  }

  const crudeScriptUrl = new URL(crudeScriptRawUrl, location.href)
  const crudeScriptBasename = Path.filename(crudeScriptUrl.pathname).split(".")[0]
  const crudeScriptResponse = await fetch(crudeScriptUrl, { cache: "reload" })

  if (!crudeScriptResponse.ok)
    throw new Error(`Could not fetch service worker`)

  const ccl = crudeScriptResponse.headers.get("cache-control")

  if (!ccl?.includes("immutable"))
    console.warn(`Service worker is not distributed as immutable. Use it at your own risk.`)

  const ttl = ccl?.split(",").map(s => s.trim()).find(s => s.startsWith("max-age="))?.split("=").at(-1)

  if (ttl !== "31536000")
    console.warn(`Service worker is distributed with a time-to-live of less than 1 year. Use it at your own risk.`)

  const crudeHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await crudeScriptResponse.arrayBuffer()))
  const crudeHashRawHex = Array.from(crudeHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")
  const crudeVersion = crudeHashRawHex.slice(0, 6)

  const freshScriptPath = `${crudeScriptBasename}.${crudeVersion}.js`
  const freshScriptUrl = new URL(freshScriptPath, crudeScriptUrl)

  const stale = await navigator.serviceWorker.getRegistration(scope)

  if (stale == null) {
    const fresh = await navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" })

    await getOrWaitActiveServiceWorkerOrThrow(fresh)

    return new ServiceWorkerRegistrationWithUpdate(fresh)
  }

  const staleScript = await getOrWaitActiveServiceWorkerOrThrow(stale)
  const staleScriptUrl = new URL(staleScript.scriptURL, location.href)
  const staleScriptBasename = Path.filename(staleScriptUrl.pathname).split(".")[0]

  if (crudeScriptBasename !== staleScriptBasename) {
    const fresh = await navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" })

    await getOrWaitActiveServiceWorkerOrThrow(fresh)

    return new ServiceWorkerRegistrationWithUpdate(fresh)
  }

  if (staleScriptUrl.href === freshScriptUrl.href)
    return new ServiceWorkerRegistrationWithUpdate(stale)

  const update = async () => {
    const fresh = await navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" })

    await getOrWaitActiveServiceWorkerOrThrow(fresh)

    return fresh
  }

  return new ServiceWorkerRegistrationWithUpdate(stale, update)
}