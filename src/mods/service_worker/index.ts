import { Future } from "@hazae41/future"
import { Nullable } from "@hazae41/option"
import { Path } from "libs/path/index.js"
import { JsonLocalStorage } from "libs/storage/index.js"

export interface ImmutableRegistrationOptions {
  readonly localStoragePrefix?: string
  readonly shouldCheckUpdates?: boolean
}

/**
 * Register a sticky service-worker and return a function to update it
 * @param latestScriptRawUrl 
 * @returns 
 */
export async function register(latestScriptRawUrl: string | URL, options: ImmutableRegistrationOptions = {}): Promise<Nullable<() => Promise<void>>> {
  const { shouldCheckUpdates = true, localStoragePrefix = `` } = options

  if (process.env.NODE_ENV !== "production") {
    await navigator.serviceWorker.register(latestScriptRawUrl, { updateViaCache: "none" })
    return
  }

  /**
   * Get previous registration
   */
  const registration = await navigator.serviceWorker.getRegistration()

  /**
   * Update detection is not foolproof but acts as a canary for administrators and other users
   */
  registration?.addEventListener("updatefound", async () => {
    const { installing } = registration

    if (installing == null)
      return

    const currentVersion = JsonLocalStorage.get(`${localStoragePrefix}service_worker.current.version`)
    const pendingVersion = JsonLocalStorage.get(`${localStoragePrefix}service_worker.pending.version`)

    installing.addEventListener("statechange", async () => {
      if (installing.state !== "installed")
        return
      JsonLocalStorage.set(`${localStoragePrefix}service_worker.pending.version`, undefined)
    })

    if (pendingVersion === currentVersion)
      return

    alert(`An unsolicited update was detected and this may indicate an ongoing attack. Please use this website (${location.origin}) with caution and contact administrators if you think this is not normal.`)
  })

  const currentVersion = JsonLocalStorage.get(`${localStoragePrefix}service_worker.current.version`)

  if (currentVersion == null) {
    const latestScriptUrl = new URL(latestScriptRawUrl, location.href)
    const latestScriptBasename = Path.filename(latestScriptUrl.pathname).split(".")[0]

    const latestScriptRes = await fetch(latestScriptUrl, { cache: "reload" })

    if (!latestScriptRes.ok)
      throw new Error(`Failed to fetch latest service-worker`)

    const cache = latestScriptRes.headers.get("cache-control")

    if (!cache?.includes("immutable"))
      alert(`This website is not distributed as immutable. Use it at your own risk.`)

    const ttl = cache?.split(",").map(s => s.trim()).find(s => s.startsWith("max-age="))?.split("=").at(-1)

    if (ttl !== "31536000")
      alert(`This website is distributed with a time-to-live of less than 1 year. Use it at your own risk.`)

    const latestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await latestScriptRes.arrayBuffer()))
    const latestHashRawHex = Array.from(latestHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")
    const latestVersion = latestHashRawHex.slice(0, 6)

    const latestVersionScriptPath = `${latestScriptBasename}.${latestVersion}.js`
    const latestVersionScriptUrl = new URL(latestVersionScriptPath, latestScriptUrl)

    JsonLocalStorage.set(`${localStoragePrefix}service_worker.current.version`, latestVersion)
    JsonLocalStorage.set(`${localStoragePrefix}service_worker.pending.version`, latestVersion)

    await navigator.serviceWorker.register(latestVersionScriptUrl, { updateViaCache: "all" })

    return
  }

  const latestScriptUrl = new URL(latestScriptRawUrl, location.href)
  const latestScriptBasename = Path.filename(latestScriptUrl.pathname).split(".")[0]

  const currentVersionScriptPath = `${latestScriptBasename}.${currentVersion}.js`
  const currentVersionScriptUrl = new URL(currentVersionScriptPath, latestScriptUrl)

  await navigator.serviceWorker.register(currentVersionScriptUrl, { updateViaCache: "all" })

  if (!shouldCheckUpdates)
    return

  try {
    const latestScriptRes = await fetch(latestScriptUrl, { cache: "reload" })

    if (!latestScriptRes.ok)
      throw new Error(`Failed to fetch latest service-worker`)

    const cache = latestScriptRes.headers.get("cache-control")

    if (!cache?.includes("immutable"))
      alert(`This website is not distributed as immutable. Use it at your own risk.`)

    const ttl = cache?.split(",").map(s => s.trim()).find(s => s.startsWith("max-age="))?.split("=").at(-1)

    if (ttl !== "31536000")
      alert(`This website is distributed with a time-to-live of less than 1 year. Use it at your own risk.`)

    const latestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await latestScriptRes.arrayBuffer()))
    const latestHashRawHex = Array.from(latestHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")
    const latestVersion = latestHashRawHex.slice(0, 6)

    if (latestVersion === currentVersion)
      return

    return async () => {
      const registration = await navigator.serviceWorker.getRegistration()

      if (registration == null)
        return

      const { active } = registration

      if (active == null)
        return

      const currentVersion = JsonLocalStorage.get(`${localStoragePrefix}service_worker.current.version`)

      /**
       * Recheck to avoid concurrent updates
       */
      if (currentVersion === latestVersion)
        return

      JsonLocalStorage.set(`${localStoragePrefix}service_worker.current.version`, latestVersion)
      JsonLocalStorage.set(`${localStoragePrefix}service_worker.pending.version`, latestVersion)

      const future = new Future<void>()

      const onStateChange = async () => {
        if (active.state !== "redundant")
          return
        future.resolve()
      }

      try {
        active.addEventListener("statechange", onStateChange, { passive: true })

        const latestVersionScriptPath = `${latestScriptBasename}.${latestVersion}.js`
        const latestVersionScriptUrl = new URL(latestVersionScriptPath, latestScriptUrl)

        await navigator.serviceWorker.register(latestVersionScriptUrl, { updateViaCache: "all" })

        /**
         * Wait for activation
         */
        await future.promise
      } finally {
        active.removeEventListener("statechange", onStateChange)
      }
    }
  } catch (e: unknown) {
    console.warn(e)
    return
  }
}