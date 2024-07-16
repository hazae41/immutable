import { Nullable } from "@hazae41/option"
import crypto from "crypto"
import fs from "fs"
import { walkSync } from "libs/fs/index.js"
import { NextConfig } from "next"
import Log from "next/dist/build/output/log.js"
import path from "path"
import { Stats, webpack } from "webpack"

export async function compile(wpconfig: any) {
  Log.wait(`compiling ${wpconfig.name}...`)

  const start = Date.now()

  const status = await new Promise<Nullable<Stats>>(ok => webpack(wpconfig).run((_, status) => ok(status)))

  if (status?.hasErrors()) {
    Log.error(`failed to compile ${wpconfig.name}`)
    Log.error(status.toString({ colors: true }))
    throw new Error(`Compilation failed`)
  }

  Log.ready(`compiled ${wpconfig.name} in ${Date.now() - start} ms`)

  fs.mkdirSync(`./public/${path.dirname(wpconfig.output.filename)}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${wpconfig.output.filename}`, `./public/${wpconfig.output.filename}`)
}

export async function compileAndHash(wpconfig: any) {
  Log.wait(`compiling ${wpconfig.name}...`)

  const start = Date.now()

  const status = await new Promise<Nullable<Stats>>(ok => webpack(wpconfig).run((_, status) => ok(status)))

  if (status?.hasErrors()) {
    Log.error(`failed to compile ${wpconfig.name}`)
    Log.error(status.toString({ colors: true }))
    throw new Error(`Compilation failed`)
  }

  Log.ready(`compiled ${wpconfig.name} in ${Date.now() - start} ms`)

  fs.mkdirSync(`./public/${path.dirname(wpconfig.output.filename)}`, { recursive: true })

  fs.copyFileSync(`./.webpack/${wpconfig.output.filename}`, `./public/${wpconfig.output.filename}`)

  const content = fs.readFileSync(`./.webpack/${wpconfig.output.filename}`)
  const hash = crypto.createHash("sha256").update(content).digest("hex")

  fs.copyFileSync(`./.webpack/${wpconfig.output.filename}`, `./public/${path.dirname(wpconfig.output.filename)}/${path.basename(wpconfig.output.filename, ".js")}.${hash}.h.js`)
}

export interface ImmutableConfig {
  compiles(): Generator<Promise<void>>
}

export function withImmutable(config: NextConfig & ImmutableConfig) {
  let promise: Promise<void>

  return {
    ...config,
    webpack(wpconfig, wpoptions) {
      if (wpoptions.isServer)
        return wpconfig

      fs.rmSync("./.webpack", { force: true, recursive: true })

      for (const file of walkSync("./public"))
        if (file.endsWith(".h.js"))
          fs.rmSync(file, { force: true })

      promise = Promise.all(config.compiles()).then(() => { })

      return wpconfig
    },
    exportPathMap: async (map) => {
      await promise
      return map
    },
    async headers() {
      if (process.env.NODE_ENV !== "production")
        return []

      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
      ]
    },
  } satisfies NextConfig
}