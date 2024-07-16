import { Nullable } from "@hazae41/option"

export namespace JsonLocalStorage {

  export function set<T>(key: string, value: Nullable<T>) {
    if (value != null)
      localStorage.setItem(key, JSON.stringify(value))
    else
      localStorage.removeItem(key)
  }

  export function get<T>(key: string): Nullable<T> {
    const value = localStorage.getItem(key)

    if (value == null)
      return value

    return JSON.parse(value) as T
  }

  export function getAndSet<T>(key: string, newValue: T) {
    const currentValue = get<T>(key)

    set(key, newValue)

    return currentValue
  }

  export function getOrSet<T>(key: string, defaultValue: Nullable<T>) {
    const currentValue = get<T>(key)

    if (currentValue != null)
      return currentValue

    set(key, defaultValue)

    return defaultValue
  }

}