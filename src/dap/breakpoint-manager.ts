/**
 * Breakpoint management system
 */

import { v4 as uuidv4 } from 'uuid';
import type { BreakpointInfo } from '../core/types.js';
import { logger } from '../utils/logger.js';

/**
 * Breakpoint manager for tracking and syncing breakpoints
 */
export class BreakpointManager {
  private breakpoints = new Map<string, BreakpointInfo>();
  private breakpointsByFile = new Map<string, Set<string>>();

  /**
   * Add a breakpoint
   */
  add(file: string, line: number, options?: {
    condition?: string;
    hitCondition?: string;
    logMessage?: string;
    enabled?: boolean;
  }): BreakpointInfo {
    const breakpoint: BreakpointInfo = {
      id: uuidv4(),
      file,
      line,
      verified: false,
      enabled: options?.enabled ?? true,
      condition: options?.condition,
      hitCondition: options?.hitCondition,
      logMessage: options?.logMessage,
    };

    this.breakpoints.set(breakpoint.id, breakpoint);

    // Track by file
    let fileBreakpoints = this.breakpointsByFile.get(file);
    if (!fileBreakpoints) {
      fileBreakpoints = new Set();
      this.breakpointsByFile.set(file, fileBreakpoints);
    }
    fileBreakpoints.add(breakpoint.id);

    logger.info('Breakpoint added', { breakpoint });
    return breakpoint;
  }

  /**
   * Remove a breakpoint
   */
  remove(breakpointId: string): boolean {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (!breakpoint) {
      return false;
    }

    this.breakpoints.delete(breakpointId);

    // Remove from file tracking
    const fileBreakpoints = this.breakpointsByFile.get(breakpoint.file);
    if (fileBreakpoints) {
      fileBreakpoints.delete(breakpointId);
      if (fileBreakpoints.size === 0) {
        this.breakpointsByFile.delete(breakpoint.file);
      }
    }

    logger.info('Breakpoint removed', { breakpointId });
    return true;
  }

  /**
   * Remove all breakpoints for a file
   */
  removeByFile(file: string): number {
    const breakpointIds = this.breakpointsByFile.get(file);
    if (!breakpointIds) {
      return 0;
    }

    const count = breakpointIds.size;
    for (const id of breakpointIds) {
      this.breakpoints.delete(id);
    }
    this.breakpointsByFile.delete(file);

    logger.info('Breakpoints removed by file', { file, count });
    return count;
  }

  /**
   * Get a breakpoint by ID
   */
  get(breakpointId: string): BreakpointInfo | undefined {
    return this.breakpoints.get(breakpointId);
  }

  /**
   * Get all breakpoints for a file
   */
  getByFile(file: string): BreakpointInfo[] {
    const breakpointIds = this.breakpointsByFile.get(file);
    if (!breakpointIds) {
      return [];
    }

    return Array.from(breakpointIds)
      .map((id) => this.breakpoints.get(id))
      .filter((bp): bp is BreakpointInfo => bp !== undefined);
  }

  /**
   * Get all breakpoints
   */
  getAll(): BreakpointInfo[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Update breakpoint verification status
   */
  updateVerification(breakpointId: string, verified: boolean): void {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (breakpoint) {
      breakpoint.verified = verified;
      logger.debug('Breakpoint verification updated', {
        breakpointId,
        verified,
      });
    }
  }

  /**
   * Enable a breakpoint
   */
  enable(breakpointId: string): boolean {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (breakpoint) {
      breakpoint.enabled = true;
      logger.debug('Breakpoint enabled', { breakpointId });
      return true;
    }
    return false;
  }

  /**
   * Disable a breakpoint
   */
  disable(breakpointId: string): boolean {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (breakpoint) {
      breakpoint.enabled = false;
      logger.debug('Breakpoint disabled', { breakpointId });
      return true;
    }
    return false;
  }

  /**
   * Enable all breakpoints
   */
  enableAll(): void {
    for (const breakpoint of this.breakpoints.values()) {
      breakpoint.enabled = true;
    }
    logger.info('All breakpoints enabled', { count: this.breakpoints.size });
  }

  /**
   * Disable all breakpoints
   */
  disableAll(): void {
    for (const breakpoint of this.breakpoints.values()) {
      breakpoint.enabled = false;
    }
    logger.info('All breakpoints disabled', { count: this.breakpoints.size });
  }

  /**
   * Get breakpoints grouped by file for DAP setBreakpoints request
   * Only includes enabled breakpoints
   */
  getBreakpointsForDap(): Map<string, Array<{
    line: number;
    condition?: string;
    hitCondition?: string;
    logMessage?: string;
  }>> {
    const result = new Map<string, Array<{
      line: number;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }>>();

    for (const [file, breakpointIds] of this.breakpointsByFile.entries()) {
      const fileBreakpoints = Array.from(breakpointIds)
        .map((id) => this.breakpoints.get(id))
        .filter((bp): bp is BreakpointInfo => bp !== undefined && bp.enabled)
        .map((bp) => ({
          line: bp.line,
          condition: bp.condition,
          hitCondition: bp.hitCondition,
          logMessage: bp.logMessage,
        }));

      if (fileBreakpoints.length > 0) {
        result.set(file, fileBreakpoints);
      }
    }

    return result;
  }

  /**
   * Clear all breakpoints
   */
  clear(): void {
    this.breakpoints.clear();
    this.breakpointsByFile.clear();
    logger.info('All breakpoints cleared');
  }

  /**
   * Get count of breakpoints
   */
  count(): number {
    return this.breakpoints.size;
  }

  /**
   * Get count of enabled breakpoints
   */
  countEnabled(): number {
    return Array.from(this.breakpoints.values()).filter(bp => bp.enabled).length;
  }

  /**
   * Serialize breakpoints for persistence
   */
  serialize(): BreakpointInfo[] {
    return this.getAll();
  }

  /**
   * Restore breakpoints from serialized data
   */
  restore(breakpoints: BreakpointInfo[]): void {
    this.clear();
    for (const bp of breakpoints) {
      this.breakpoints.set(bp.id, bp);
      
      let fileBreakpoints = this.breakpointsByFile.get(bp.file);
      if (!fileBreakpoints) {
        fileBreakpoints = new Set();
        this.breakpointsByFile.set(bp.file, fileBreakpoints);
      }
      fileBreakpoints.add(bp.id);
    }
    logger.info('Breakpoints restored', { count: breakpoints.length });
  }
}

