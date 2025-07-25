import { Future } from "@hazae41/future"
import { Path } from "libs/path/index.js"

export async function getOrWaitActiveServiceWorkerOrThrow(registration: ServiceWorkerRegistration) {
  const { active } = registration

  if (active != null)
    return active

  const { installing, waiting } = registration

  if (installing != null)
    return await getOrWaitServiceWorkerOrThrow(installing)
  if (waiting != null)
    return await getOrWaitServiceWorkerOrThrow(waiting)

  throw new Error(`Could not find service worker`)
}

export async function getOrWaitServiceWorkerOrThrow(worker: ServiceWorker) {
  if (worker.state === "activated")
    return worker

  const future = new Future<void>()

  const onStateChange = (event: Event) => {
    if (worker.state === "redundant")
      return void future.reject(new Error(`Service worker is redundant`))
    if (worker.state === "activated")
      return void future.resolve()
    return
  }

  const onError = (event: ErrorEvent) => {
    future.reject(event.error)
  }

  try {
    worker.addEventListener("statechange", onStateChange, { passive: true })
    worker.addEventListener("error", onError, { passive: true })

    await future.promise

    return worker
  } finally {
    worker.removeEventListener("statechange", onStateChange)
    worker.removeEventListener("error", onError)
  }
}

export class ServiceWorkerRegistrationWithUpdate {

  constructor(
    readonly registration: ServiceWorkerRegistration,
    readonly update?: () => Promise<ServiceWorkerRegistration>
  ) { }

}

export async function register(crudeScriptRawUrl: string | URL, options: RegistrationOptions = {}): Promise<ServiceWorkerRegistrationWithUpdate> {
  const { scope, type } = options

  const onupdatefound = () => alert(`An update of this website (${location.origin}) is being installed. If you are not expecting this, it may indicate an ongoing attack, so please use this website (${location.origin}) with caution and contact administrators.`)

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

    fresh.addEventListener("updatefound", onupdatefound, {})

    return new ServiceWorkerRegistrationWithUpdate(fresh)
  }

  const staleScript = await getOrWaitActiveServiceWorkerOrThrow(stale)
  const staleScriptUrl = new URL(staleScript.scriptURL, location.href)
  const staleScriptBasename = Path.filename(staleScriptUrl.pathname).split(".")[0]

  if (crudeScriptBasename !== staleScriptBasename) {
    const fresh = await navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" })

    fresh.addEventListener("updatefound", onupdatefound, {})

    return new ServiceWorkerRegistrationWithUpdate(fresh)
  }

  stale.addEventListener("updatefound", onupdatefound, {})

  if (staleScriptUrl.href !== freshScriptUrl.href)
    return new ServiceWorkerRegistrationWithUpdate(stale)

  const update = async () => {
    stale.removeEventListener("updatefound", onupdatefound, {})

    const fresh = await navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" })

    fresh.addEventListener("updatefound", onupdatefound, {})

    return fresh
  }

  return new ServiceWorkerRegistrationWithUpdate(stale, update)
}