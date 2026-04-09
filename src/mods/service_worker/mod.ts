import { getOrWaitActiveServiceWorkerOrThrow } from "@/libs/service_worker/mod.ts";
import { Result } from "@hazae41/result-and-option";

export class ServiceWorkerRegistrationWithUpdate {

  constructor(
    readonly registration: ServiceWorkerRegistration,
    readonly update?: () => Promise<ServiceWorkerRegistration>
  ) { }

}

export async function register(crudeScriptRawUrl: string | URL, options: RegistrationOptions = {}): Promise<ServiceWorkerRegistrationWithUpdate> {
  const { scope, type } = options

  /**
   * If development, return crude version without cache
   */
  if (process.env.NODE_ENV !== "production")
    return new ServiceWorkerRegistrationWithUpdate(await navigator.serviceWorker.register(crudeScriptRawUrl, { scope, type, updateViaCache: "none" }))

  /**
   * Get stale version or null
   */
  const stale = await navigator.serviceWorker.getRegistration(scope)

  /**
   * Try to fetch the crude version
   */
  const crudeScriptUrl = new URL(crudeScriptRawUrl, location.href)
  const crudeScriptResult = await Result.runAndWrap(() => fetch(crudeScriptUrl, { cache: "reload" }))

  /**
   * Upon failure, if stale version, return it as-is without update
   */
  if (crudeScriptResult.isErr() && stale != null)
    return new ServiceWorkerRegistrationWithUpdate(stale)

  /**
   * Upon failure, if no stale version, throw
   */
  const crudeScriptResponse = crudeScriptResult.getOrThrow()

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
   * Get fresh version by applying cache-busting to the crude version
   */
  const freshScriptUrl = new URL(crudeScriptRawUrl, location.href)
  freshScriptUrl.searchParams.set("integrity", crudeScriptIntegrity)

  /**
   * If no stale version, register the fresh version and return it as-is without update
   */
  if (stale == null)
    return new ServiceWorkerRegistrationWithUpdate(await navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" }))

  /**
   * Get stale version
   */
  const staleScriptWorker = await getOrWaitActiveServiceWorkerOrThrow(stale)
  const staleScriptUrl = new URL(staleScriptWorker.scriptURL, location.href)

  /**
   * If same, return stale version as-is without update
   */
  if (staleScriptUrl.href === freshScriptUrl.href)
    return new ServiceWorkerRegistrationWithUpdate(stale)

  /**
   * If different, return stale version with update to fresh version
   */
  return new ServiceWorkerRegistrationWithUpdate(stale, () => navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" }))
}