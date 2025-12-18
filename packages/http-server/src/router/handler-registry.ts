import type { Handler } from './types';

/**
 * Registry to map unique string identifiers to handler functions.
 * Essential for Snapshot/SharedMemory scenarios where function references cannot be serialized.
 */
export class HandlerRegistry<R = any> {
  /**
   * Internal map to store handlers.
   * Using private field (#) for engine optimization and encapsulation.
   */
  /**
   * Internal map to store handlers.
   * Using private keyword for encapsulation.
   */
  private handlers: Map<string, Handler<R>>;

  constructor() {
    this.handlers = new Map();
  }

  /**
   * Registers a handler function with a unique ID.
   * @param id Unique identifier string
   * @param handler The handler function
   */
  register(id: string, handler: Handler<R>): void {
    if (this.handlers.has(id)) {
      throw new Error(`Handler ID '${id}' is already registered.`);
    }
    this.handlers.set(id, handler);
  }

  /**
   * Retrieves a handler by its ID.
   * @param id Unique identifier string
   */
  get(id: string): Handler<R> | undefined {
    return this.handlers.get(id);
  }

  /**
   * Checks if an ID exists.
   */
  has(id: string): boolean {
    return this.handlers.has(id);
  }

  /**
   * Clears all registered handlers.
   */
  clear(): void {
    this.handlers.clear();
  }
}
