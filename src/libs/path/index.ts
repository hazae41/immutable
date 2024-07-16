export namespace Path {

  /**
   * Path name split into dirname and filename
   * @param path 
   * @returns 
   */
  export function pathnames(path: string) {
    const splitted = path.split("/")

    const dirname = splitted.slice(0, -1).join("/")
    const filename = splitted.at(-1)!

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
    const splitted = filename(path).split(".")

    const basename = splitted.slice(0, 1).join(".")
    const extension = splitted.at(-1)!

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