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

  // @ts-ignore: process
  // deno-lint-ignore no-process-global
  if (process.env.NODE_ENV !== "production")
    return new ServiceWorkerRegistrationWithUpdate(await navigator.serviceWorker.register(crudeScriptRawUrl, { scope, type, updateViaCache: "none" }))

  const stale = await navigator.serviceWorker.getRegistration(scope)

  const crudeScriptUrl = new URL(crudeScriptRawUrl, location.href)
  const crudeScriptResult = await Result.runAndWrap(() => fetch(crudeScriptUrl, { cache: "reload" }))

  if (crudeScriptResult.isErr() && stale != null)
    return new ServiceWorkerRegistrationWithUpdate(stale)

  const crudeScriptResponse = crudeScriptResult.getOrThrow()

  if (!crudeScriptResponse.ok)
    throw new Error(`Could not fetch service worker`, { cause: crudeScriptResponse })

  const ccl = crudeScriptResponse.headers.get("cache-control")

  if (!ccl?.includes("immutable"))
    console.warn(`Service worker is not distributed as immutable. Use it at your own risk.`)

  const ttl = ccl?.split(",").map(s => s.trim()).find(s => s.startsWith("max-age="))?.split("=").at(-1)

  if (ttl !== "31536000")
    console.warn(`Service worker is distributed with a time-to-live of less than 1 year. Use it at your own risk.`)

  const crudeScriptDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", await crudeScriptResponse.bytes()))
  const crudeScriptVersion = crudeScriptDigest.toHex().slice(0, 6)

  const freshScriptUrl = new URL(crudeScriptRawUrl, location.href)
  freshScriptUrl.searchParams.set("version", crudeScriptVersion)

  if (stale == null)
    return new ServiceWorkerRegistrationWithUpdate(await navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" }))

  const staleScriptWorker = await getOrWaitActiveServiceWorkerOrThrow(stale)
  const staleScriptUrl = new URL(staleScriptWorker.scriptURL, location.href)

  if (staleScriptUrl.href === freshScriptUrl.href)
    return new ServiceWorkerRegistrationWithUpdate(stale)

  return new ServiceWorkerRegistrationWithUpdate(stale, () => navigator.serviceWorker.register(freshScriptUrl, { scope, type, updateViaCache: "all" }))
}