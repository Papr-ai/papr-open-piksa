/**
 * Performance Logging Utility for Memory Operations
 *
 * This utility helps track and log performance metrics for memory operations.
 */

// Simple performance logger with start/end time tracking
export const perfLogger = {
  /**
   * Start timing an operation
   * @param operation Name of the operation
   * @returns Start time in milliseconds
   */
  start: (operation: string): number => {
    console.log(`[Memory PERF] Starting operation: ${operation}`);
    return performance.now();
  },

  /**
   * End timing an operation and log the result
   * @param operation Name of the operation
   * @param startTime Start time in milliseconds from start()
   * @param additionalInfo Optional additional info to log
   */
  end: (
    operation: string,
    startTime: number,
    additionalInfo?: string,
  ): void => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(
      `[Memory PERF] ${operation} completed in ${duration.toFixed(2)}ms${additionalInfo ? ` (${additionalInfo})` : ''}`,
    );
  },

  /**
   * Log a specific performance measurement
   * @param operation Name of the operation
   * @param durationMs Duration in milliseconds
   * @param additionalInfo Optional additional info to log
   */
  log: (
    operation: string,
    durationMs: number,
    additionalInfo?: string,
  ): void => {
    console.log(
      `[Memory PERF] ${operation} took ${durationMs.toFixed(2)}ms${additionalInfo ? ` (${additionalInfo})` : ''}`,
    );
  },
};
