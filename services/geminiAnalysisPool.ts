import { GeminiApiError } from './geminiService';

// --- Primitives ---

class Semaphore {
  private count: number;
  private readonly max: number;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent: number) {
    this.count = 0;
    this.max = maxConcurrent;
  }

  async acquire(): Promise<void> {
    if (this.count < this.max) {
      this.count++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.count--;
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift();
      if (nextResolve) {
        this.count++;
        nextResolve();
      }
    }
  }
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  timeout: number; // Time in ms to stay open
  resetTimeout: number; // Time in ms in half-open state
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.state = 'HALF-OPEN';
      } else {
        return Promise.reject(new Error('CircuitBreaker is open. Call blocked.'));
      }
    }

    try {
      const result = await task();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === 'HALF-OPEN') {
      this.reset();
    }
    this.failureCount = 0;
  }

  private onFailure() {
    this.lastFailureTime = Date.now();
    if (this.state === 'HALF-OPEN') {
        this.trip();
    } else {
        this.failureCount++;
        if (this.failureCount >= this.config.failureThreshold) {
            this.trip();
        }
    }
  }

  private trip() {
    this.state = 'OPEN';
    console.warn(`CircuitBreaker tripped. Blocking calls for ${this.config.timeout}ms.`);
  }

  private reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    console.info('CircuitBreaker reset to CLOSED state.');
  }
}

interface RetryPolicyConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

class ExponentialBackoff {
  private readonly config: RetryPolicyConfig;

  constructor(config: RetryPolicyConfig) {
    this.config = config;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        return await task();
      } catch (error) {
        if (error instanceof GeminiApiError && error.isRetryable && attempt < this.config.maxAttempts - 1) {
          const delay = Math.min(this.config.maxDelay, this.config.baseDelay * Math.pow(2, attempt));
          const jitter = delay * 0.2 * Math.random();
          console.log(`Attempt ${attempt + 1} failed. Retrying in ${Math.round(delay + jitter)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay + jitter));
        } else {
          throw error; // Not retryable or max attempts reached
        }
      }
    }
    // This should not be reached due to the `throw` in the catch block, but it satisfies TypeScript's control flow analysis.
    throw new Error('Max retry attempts reached.');
  }
}

// --- Errors and Pool ---

export class AggregateAnalysisError extends Error {
  public readonly errors: Error[];
  constructor(errors: Error[], message?: string) {
    super(message || `Multiple analysis errors occurred: ${errors.length} total.`);
    this.name = 'AggregateAnalysisError';
    this.errors = errors;
  }
}

export interface PoolConfig {
  maxConcurrent?: number;
  failureThreshold?: number;
  timeout?: number;
  resetTimeout?: number;
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export class GeminiAnalysisPool {
  private semaphore: Semaphore;
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: ExponentialBackoff;

  constructor(config: PoolConfig = {}) {
    this.semaphore = new Semaphore(config.maxConcurrent || 5);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config.failureThreshold || 3,
      timeout: config.timeout || 30000,
      resetTimeout: config.resetTimeout || 10000,
    });
    this.retryPolicy = new ExponentialBackoff({
      maxAttempts: config.maxAttempts || 3,
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 10000,
    });
  }

  async executeWithBackpressure<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const promises = tasks.map(task =>
      this.semaphore.acquire().then(() =>
        this.circuitBreaker.execute(() => this.retryPolicy.execute(task))
          .finally(() => this.semaphore.release())
      )
    );

    const results = await Promise.allSettled(promises);

    const successfulResults: T[] = [];
    const errors: Error[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        errors.push(result.reason);
      }
    });

    if (errors.length > 0) {
      throw new AggregateAnalysisError(errors);
    }

    return successfulResults;
  }
}