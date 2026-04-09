import { Result } from "@hazae41/result-and-option";

export interface ServiceWorkerRegistrationWithUpdate {

  readonly registration: ServiceWorkerRegistration

  update?(): Promise<ServiceWorkerRegistration>

}

/**
 * Register a service worker with cache-busting and update mechanism
 * @param scriptURL
 * @param options 
 * @returns service worker registration with update mechanism
 */
export async function register(crudeScriptRawUrl: string | URL, options: RegistrationOptions = {}): Promise<ServiceWorkerRegistrationWithUpdate> {
  const { scope, type } = options

  /**
   * If development, return crude version without cache
   */
  if (process.env.NODE_ENV !== "production")
    return { registration: await navigator.serviceWorker.register(crudeScriptRawUrl, { scope, type, updateViaCache: "none" }) }

  /**
   * If Apple, return crude version without cache, as Safari does not support cache-busting, especially in PWAs
   */
  if (/Apple/.test(navigator.vendor))
    return { registration: await navigator.serviceWorker.register(crudeScriptRawUrl, { scope, type, updateViaCache: "none" }) }

  /**
   * Get stale version or null
   */
  const staleScriptReg = await navigator.serviceWorker.getRegistration(scope)

  /**
   * Compute crude version URL
   */
  const crudeScriptUrl = new URL(crudeScriptRawUrl, location.href)

  /**
   * Try to fetch the crude version
   */
  const crudeScriptResult = await Result.runAndWrap(() => fetch(crudeScriptUrl, { cache: "reload" }))

  /**
   * Upon failure, if stale version, return it as-is without update
   */
  if (crudeScriptResult.isErr() && staleScriptReg != null)
    return { registration: staleScriptReg }

  /**
   * Upon failure, if no stale version, throw
   */
  if (crudeScriptResult.isErr())
    throw new Error(`Could not fetch service worker`, { cause: crudeScriptResult.getErr() })

  const crudeScriptResponse = crudeScriptResult.get()

  /**
   * Upon inner failure, if stale version, return it as-is without update
   */
  if (!crudeScriptResponse.ok && staleScriptReg != null)
    return { registration: staleScriptReg }

  /**
   * Upon inner failure, if no stale version, throw
   */
  if (!crudeScriptResponse.ok)
    throw new Error(`Could not fetch service worker`, { cause: crudeScriptResponse })

  const ccl = crudeScriptResponse.headers.get("cache-control")

  /**
   * Check "immutable" header and warn if wrong
   */
  if (!ccl?.includes("immutable"))
    console.warn(`Service worker is not distributed as immutable. Use it at your own risk.`)

  const ttl = ccl?.split(",").map(s => s.trim()).find(s => s.startsWith("max-age="))?.split("=").at(-1)

  /**
   * Check "time-to-live" header and warn if less than 1 year
   */
  if (ttl !== "31536000")
    console.warn(`Service worker is distributed with a time-to-live of less than 1 year. Use it at your own risk.`)

  /**
   * Compute integrity of crude version
   */
  const crudeScriptDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", await crudeScriptResponse.bytes()))
  const crudeScriptIntegrity = `sha256-${crudeScriptDigest.toBase64()}`

  /**
   * Compute fresh version URL by applying cache-busting to the crude version URL
   */
  const freshScriptUrl = new URL(crudeScriptRawUrl, location.href)
  freshScriptUrl.searchParams.set("integrity", crudeScriptIntegrity)

  /**
   * If no active stale version, register the fresh version and return it as-is without update
   */
  if (staleScriptReg?.active == null)
    return { registration: await navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" }) }

  /**
   * Compute stale version URL
   */
  const staleScriptUrl = new URL(staleScriptReg.active.scriptURL, location.href)

  /**
   * If same, return stale version as-is without update
   */
  if (staleScriptUrl.href === freshScriptUrl.href)
    return { registration: staleScriptReg }

  /**
   * If different, return stale version with update to fresh version
   */
  return { registration: staleScriptReg, update: () => navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" }) }
}