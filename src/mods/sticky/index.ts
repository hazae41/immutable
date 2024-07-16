import { Future } from "@hazae41/future"
import { Nullable } from "@hazae41/option"
import { Path } from "libs/path/index.js"
import { JsonLocalStorage } from "libs/storage/index.js"

export namespace StickyServiceWorker {

  /**
   * Register a sticky service-worker and return a function to update it
   * @param script 
   * @returns 
   */
  export async function register(script: string | URL): Promise<Nullable<() => Promise<void>>> {
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

      const currentHashRawHex = JsonLocalStorage.get("service_worker.current.hashRawHex")
      const pendingHashRawHex = JsonLocalStorage.get("service_worker.pending.hashRawHex")

      installing.addEventListener("statechange", async () => {
        if (installing.state !== "installed")
          return
        JsonLocalStorage.set("service_worker.pending.hashRawHex", undefined)
      })

      /**
       * An update was pending and solicited
       */
      if (pendingHashRawHex === currentHashRawHex)
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
    const latestScriptRes = await fetch(latestScriptUrl, { cache: "reload" })

    if (!latestScriptRes.ok)
      throw new Error(`Failed to fetch latest service worker`)

    const [basename, extension] = Path.filenames(latestScriptUrl.pathname)

    const latestHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await latestScriptRes.arrayBuffer()))
    const latestHashRawHex = Array.from(latestHashBytes).map(b => b.toString(16).padStart(2, "0")).join("")

    const currentHashRawHex = JsonLocalStorage.getOrSet("service_worker.current.hashRawHex", latestHashRawHex)

    const currentHashScriptPath = `${basename}.${currentHashRawHex}.h.${extension}`
    const currentHashScriptUrl = new URL(currentHashScriptPath, latestScriptUrl)

    await navigator.serviceWorker.register(currentHashScriptUrl, { updateViaCache: "all" })

    /**
     * No update found
     */
    if (currentHashRawHex === latestHashRawHex)
      return

    return async () => {
      const registration = await navigator.serviceWorker.getRegistration()

      if (registration == null)
        return

      const { active } = registration

      if (active == null)
        return

      const currentHashRawHex = JsonLocalStorage.get("service_worker.current.hashRawHex")

      /**
       * Recheck to avoid concurrent updates
       */
      if (currentHashRawHex === latestHashRawHex)
        return

      JsonLocalStorage.set("service_worker.current.hashRawHex", latestHashRawHex)
      JsonLocalStorage.set("service_worker.pending.hashRawHex", latestHashRawHex)

      const future = new Future<void>()

      const onStateChange = async () => {
        if (active.state !== "redundant")
          return
        future.resolve()
      }

      try {
        active.addEventListener("statechange", onStateChange, { passive: true })

        const latestHashScriptPath = `${basename}.${latestHashRawHex}.h.${extension}`
        const latestHashScriptUrl = new URL(latestHashScriptPath, latestScriptUrl)

        await navigator.serviceWorker.register(latestHashScriptUrl, { updateViaCache: "all" })

        /**
         * Wait for active
         */
        await future.promise
      } finally {
        active.removeEventListener("statechange", onStateChange)
      }
    }
  }

}