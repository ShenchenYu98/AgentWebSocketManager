import { EventHandler, SDKEvent } from "../protocol/types"

export class EventBus {
  private events: Map<string, EventHandler[]> = new Map()

  on(event: SDKEvent | string, handler: EventHandler): void {
    const handlers = this.events.get(event) || []
    handlers.push(handler)
    this.events.set(event, handlers)
  }

  off(event: SDKEvent | string, handler?: EventHandler): void {
    if (!handler) {
      this.events.delete(event)
      return
    }
    const handlers = this.events.get(event)
    if (!handlers) return
    this.events.set(
      event,
      handlers.filter((h) => h !== handler)
    )
  }

  emit(event: SDKEvent | string, data?: any): void {
    const handlers = this.events.get(event)
    if (!handlers) return
    handlers.forEach((h) => {
      try {
        h(data)
      } catch (err) {
        console.error(`[EventBus] Error in handler for event "${event}":`, err)
      }
    })
  }

  once(event: SDKEvent | string, handler: EventHandler): void {
    const onceHandler: EventHandler = (data) => {
      handler(data)
      this.off(event, onceHandler)
    }
    this.on(event, onceHandler)
  }

  removeAllListeners(event?: SDKEvent | string): void {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
  }

  listenerCount(event: SDKEvent | string): number {
    return this.events.get(event)?.length || 0
  }
}