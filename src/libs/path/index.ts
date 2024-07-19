export namespace Path {

  /**
   * Path name split into dirname and filename
   * @param path 
   * @returns 
   */
  export function pathnames(path: string) {
    const slashes = path.split("/")

    const dirname = slashes.slice(0, -1).join("/") || "."
    const filename = slashes.at(-1) || dirname

    return [dirname, filename]
  }

  /**
   * Directory name
   * @param path 
   * @returns 
   */
  export function dirname(path: string) {
    return pathnames(path)[0]
  }

  /**
   * File name
   * @param path 
   * @returns 
   */
  export function filename(path: string) {
    return pathnames(path)[1]
  }

  /**
   * File name split into basename and extension
   * @param path 
   * @returns 
   */
  export function filenames(path: string) {
    const dots = filename(path).split(".")

    const basename = dots.slice(0, 1).join(".") || ""
    const extension = dots.at(1) || ""

    return [basename, extension]
  }

  /**
   * File name without extension
   * @param path 
   */
  export function basename(path: string) {
    return filenames(path)[0]
  }

  /**
   * File extension
   * @param path 
   */
  export function extension(path: string) {
    return filenames(path)[1]
  }

}