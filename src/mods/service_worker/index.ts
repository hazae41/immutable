import { Future } from "@hazae41/future"
import { Nullable } from "@hazae41/option"
import { Path } from "libs/path/index.js"
import { JsonLocalStorage } from "libs/storage/index.js"

export interface RegisterParams {
  readonly shouldCheckUpdates?: boolean
}

/**
 * Register a sticky service-worker and return a function to update it
 * @param script 
 * @returns 
 */
export async function register(script: string | URL, params: RegisterParams = {}): Promise<Nullable<() => Promise<void>>> {
  const { shouldCheckUpdates = true } = params

  const bricked = JsonLocalStorage.get("service_worker.bricked")

  if (bricked)
    throw new Error(`This website is bricked`)

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

    const currentVersion = JsonLocalStorage.get("service_worker.current.version")
    const pendingVersion = JsonLocalStorage.get("service_worker.pending.version")

    installing.addEventListener("statechange", async () => {
      if (installing.state !== "installed")
        return
      JsonLocalStorage.set("service_worker.pending.version", undefined)
    })

    /**
     * An update was pending and solicited
     */
    if (pendingVersion === currentVersion)
      return

    console.warn(`Unsolicited service worker update detected`)

    /**
     * Only clear synchronous storage as we must be faster than the service worker
     */
    localStorage.clear()
    sessionStorage.clear()

    console.warn(`Successfully cleared storage`)

    /**
     * Unregister service worker to prevent further attacks
     */
    registration.unregister()

    console.warn(`Successfully unregistered service worker`)

    /**
     * Enter brick mode
     */
    JsonLocalStorage.set("service_worker.bricked", true)

    console.warn(`Successfully entered brick mode`)

    while (true)
      alert(`An unsolicited update attack was detected. Your storage has been safely erased. Please report this incident urgently. Please do not use this website (${location.origin}) anymore. Please close this page.`)

    /**
     * Page should be closed by now
     */
    return
  })

  const latestScriptUrl = new URL(script, location.href)

  const [basename] = Path.filename(latestScriptUrl.pathname).split(".")

  const currentVersion = JsonLocalStorage.get("service_worker.current.version")
  const currentVersionScriptPath = `${basename}.${currentVersion}.js`
  const currentVersionScriptUrl = new URL(currentVersionScriptPath, latestScriptUrl)

  await navigator.serviceWorker.register(currentVersionScriptUrl, { updateViaCache: "all" })

  if (!shouldCheckUpdates)
    return

  try {
    const latestScriptRes = await fetch(latestScriptUrl, { cache: "reload" })

    if (!latestScriptRes.ok)
      throw new Error(`Failed to fetch latest service-worker`)
    if (latestScriptRes.headers.get("cache-control") !== "public, max-age=31536000, immutable")
      throw new Error(`Wrong Cache-Control header for latest service-worker`)

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

      const currentVersion = JsonLocalStorage.get("service_worker.current.version")

      /**
       * Recheck to avoid concurrent updates
       */
      if (currentVersion === latestVersion)
        return

      JsonLocalStorage.set("service_worker.current.version", latestVersion)
      JsonLocalStorage.set("service_worker.pending.version", latestVersion)

      const future = new Future<void>()

      const onStateChange = async () => {
        if (active.state !== "redundant")
          return
        future.resolve()
      }

      try {
        active.addEventListener("statechange", onStateChange, { passive: true })

        const latestVersionScriptPath = `${basename}.${latestVersion}.js`
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