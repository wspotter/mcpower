import { execa, ExecaError } from 'execa';
import { resolve } from 'path';
import { PythonBridgeRequest } from '../types/searchQuery.js';
import { PythonBridgeResponse } from '../types/searchResult.js';
import { logger } from '../logger.js';

/**
 * PythonBridge - Manages Python subprocess execution for FAISS operations
 * 
 * Spawns Python processes to perform vector search operations using FAISS,
 * handles JSON communication over stdio, implements timeout protection,
 * and provides comprehensive error handling.
 * 
 * Implements connection pooling and subprocess management per Constitution III.
 * 
 * @example
 * ```typescript
 * const bridge = new PythonBridge('python3', 10000);
 * const response = await bridge.search({
 *   command: 'search',
 *   indexPath: '/path/to/index',
 *   query: 'my query',
 *   topK: 5
 * });
 * ```
 */
export class PythonBridge {
  private pythonPath: string;
  private bridgeScriptPath: string;
  private timeout: number;

  /**
   * Creates a new PythonBridge instance
   * 
   * @param pythonPath - Path to Python executable (default: 'python3')
   * @param timeout - Command timeout in milliseconds (default: 10000)
   */
  constructor(pythonPath: string = 'python3', timeout: number = 10000) {
    this.pythonPath = pythonPath;
    this.bridgeScriptPath = resolve('./python/bridge.py');
    this.timeout = timeout;
  }

  /**
   * Executes a search command via Python bridge
   * 
   * Spawns a Python subprocess to perform FAISS vector search,
   * parses JSON response, and handles errors/timeouts.
   * 
   * @param request - Search request with command, index path, query, and topK
   * @returns Python bridge response with search results and metadata
   * @throws Error if Python command fails or times out
   * 
   * @example
   * ```typescript
   * const response = await bridge.search({
   *   command: 'search',
   *   indexPath: '/datasets/docs/index',
   *   query: 'installation guide',
   *   topK: 5
   * });
   * ```
   */
  async search(request: PythonBridgeRequest): Promise<PythonBridgeResponse> {
    const startTime = Date.now();

    try {
      const args = [
        this.bridgeScriptPath,
        request.command,
        '--index', request.indexPath
      ];

      if (request.metadataPath) {
        args.push('--metadata', request.metadataPath);
      }

      if (request.query) {
        args.push('--query', request.query);
      }

      if (request.topK !== undefined) {
        args.push('--k', request.topK.toString());
      }

      logger.debug(
        {
          command: request.command,
          indexPath: request.indexPath,
          query: request.query?.substring(0, 100), // Truncate for logging
          topK: request.topK
        },
        'Executing Python bridge command'
      );

      const result = await execa(this.pythonPath, args, {
        timeout: this.timeout,
        reject: false,
        encoding: 'utf8'
      });

      const duration = Date.now() - startTime;

      if (result.exitCode !== 0) {
        const errorMessage = result.stderr || result.stdout || 'Unknown Python bridge error';
        logger.error(
          {
            exitCode: result.exitCode,
            stderr: result.stderr,
            stdout: result.stdout,
            duration
          },
          'Python bridge command failed'
        );
        throw new Error(`Python bridge failed: ${errorMessage}`);
      }

      // Parse JSON response from stdout
      const response = JSON.parse(result.stdout) as PythonBridgeResponse;

      logger.debug(
        {
          resultCount: response.results.length,
          duration,
          pythonDuration: response.duration_ms
        },
        'Python bridge command succeeded'
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.isExecaError(error) && error.timedOut) {
        logger.error(
          { timeout: this.timeout, duration },
          'Python bridge command timed out'
        );
        throw new Error(`Python bridge timed out after ${this.timeout}ms`);
      }

      if (error instanceof SyntaxError) {
        logger.error(
          { error: error.message, duration },
          'Failed to parse Python bridge JSON response'
        );
        throw new Error(`Invalid JSON response from Python bridge: ${error.message}`);
      }

      logger.error(
        { error, duration },
        'Python bridge execution failed'
      );

      throw error;
    }
  }

  /**
   * Validates that a FAISS index exists and is readable
   * 
   * Calls Python bridge validate-index command to check index files
   * and optionally inspect FAISS properties (is_trained, ntotal, d).
   * 
   * @param indexPath - Path to FAISS index directory
   * @returns Validation result with status and optional error message
   * 
   * @example
   * ```typescript
   * const result = await bridge.validateIndex('/datasets/docs/index');
   * if (result.status === 'error') {
   *   console.error('Invalid index:', result.error);
   * }
   * ```
   */
  async validateIndex(indexPath: string): Promise<{ status: string; error?: string }> {
    try {
      const result = await execa(this.pythonPath, [
        this.bridgeScriptPath,
        'validate-index',
        '--index', indexPath
      ], {
        timeout: 5000,
        reject: false,
        encoding: 'utf8'
      });

      return JSON.parse(result.stdout);
    } catch (error) {
      logger.error({ error, indexPath }, 'Index validation failed');
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Performs a health check on the Python bridge
   * 
   * Verifies Python environment is available, dependencies are installed,
   * and returns Python version information.
   * 
   * @returns Health check result with status and Python version
   * 
   * @example
   * ```typescript
   * const health = await bridge.healthCheck();
   * console.log(`Python ${health.python_version}: ${health.status}`);
   * ```
   */
  async healthCheck(): Promise<{ status: string; python_version?: string; error?: string }> {
    try {
      const result = await execa(this.pythonPath, [
        this.bridgeScriptPath,
        'health-check'
      ], {
        timeout: 5000,
        reject: false,
        encoding: 'utf8'
      });

      return JSON.parse(result.stdout);
    } catch (error) {
      logger.error({ error }, 'Python bridge health check failed');
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Type guard to check if error is an ExecaError
   * 
   * @param error - Unknown error object
   * @returns true if error is an ExecaError with exitCode and timedOut properties
   */
  private isExecaError(error: unknown): error is ExecaError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'exitCode' in error &&
      'timedOut' in error
    );
  }
}

/**
 * Singleton PythonBridge instance for connection pooling
 * 
 * Reuse this instance throughout the application to avoid
 * creating multiple Python subprocess managers.
 * 
 * @example
 * ```typescript
 * import { pythonBridge } from './bridge/pythonBridge.js';
 * const results = await pythonBridge.search({ ... });
 * ```
 */
export const pythonBridge = new PythonBridge();
