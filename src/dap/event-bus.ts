/**
 * Event bus for awaitable DAP events
 */

import { logger } from '../utils/logger.js';
import { TimeoutError } from '../utils/error-handler.js';

interface EventWaiter {
  eventType: string;
  resolve: (event: unknown) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

/**
 * Event bus for waiting on specific events with timeout support
 */
export class EventBus {
  private waiters: EventWaiter[] = [];

  /**
   * Wait for a specific event type
   */
  waitFor(eventType: string, options: { timeout?: number } = {}): Promise<unknown> {
    const timeoutMs = options.timeout || 5000; // 5 seconds default

    return new Promise((resolve, reject) => {
      const waiter: EventWaiter = {
        eventType,
        resolve,
        reject,
      };

      // Set timeout
      waiter.timeout = setTimeout(() => {
        this.removeWaiter(waiter);
        reject(
          new TimeoutError(
            `Timeout waiting for event: ${eventType}`,
            { eventType, timeoutMs }
          )
        );
      }, timeoutMs);

      this.waiters.push(waiter);
      logger.debug('Waiting for event', { eventType, timeoutMs });
    });
  }

  /**
   * Emit an event to all waiting handlers
   */
  emit(eventType: string, event: unknown): void {
    logger.debug('Event emitted', { eventType });

    const matchingWaiters = this.waiters.filter(
      (w) => w.eventType === eventType
    );

    for (const waiter of matchingWaiters) {
      this.removeWaiter(waiter);
      waiter.resolve(event);
    }
  }

  /**
   * Remove a waiter
   */
  private removeWaiter(waiter: EventWaiter): void {
    if (waiter.timeout) {
      clearTimeout(waiter.timeout);
    }
    const index = this.waiters.indexOf(waiter);
    if (index !== -1) {
      this.waiters.splice(index, 1);
    }
  }

  /**
   * Clear all waiters
   */
  clear(): void {
    for (const waiter of this.waiters) {
      if (waiter.timeout) {
        clearTimeout(waiter.timeout);
      }
      waiter.reject(new Error('Event bus cleared'));
    }
    this.waiters = [];
  }
}
