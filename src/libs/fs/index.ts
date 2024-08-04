import fs from "fs"
import path from "path"

export function* walkSync(dir: string): Iterable<string> {
  const files = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name > b.name ? 1 : -1)

  for (const file of files) {
    if (file.isDirectory()) {
      yield* walkSync(path.join(dir, file.name))
    } else {
      yield path.join(dir, file.name)
    }
  }
}
