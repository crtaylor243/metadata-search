interface RateLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  resetTime: number;
}

// Configuration for rate limiting
const RATE_LIMIT_CONFIG = {
  // Stay at or below 95% of the rate limit
  maxUsagePercent: 0.95,
  // Default limits (will be updated from API headers)
  defaultLimit: 60, // Discogs authenticated limit
  // Minimum delay between requests (milliseconds)
  minDelayMs: 200,
  // Safety buffer for timing calculations
  timingBufferMs: 500
};

class DiscogsRateLimiter {
  private static instance: DiscogsRateLimiter;
  private currentLimits: RateLimitInfo = {
    limit: RATE_LIMIT_CONFIG.defaultLimit,
    used: 0,
    remaining: RATE_LIMIT_CONFIG.defaultLimit,
    resetTime: Date.now() + 60000
  };
  
  private lastRequestTime: number = 0;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private forcedTimeoutEnd: number = 0;

  private constructor() {}

  static getInstance(): DiscogsRateLimiter {
    if (!this.instance) {
      this.instance = new DiscogsRateLimiter();
    }
    return this.instance;
  }

  // Update rate limit info from response headers
  updateLimitsFromHeaders(headers: Headers) {
    const limit = parseInt(headers.get('X-Discogs-Ratelimit') || '60');
    const used = parseInt(headers.get('X-Discogs-Ratelimit-Used') || '0');
    const remaining = parseInt(headers.get('X-Discogs-Ratelimit-Remaining') || '60');
    
    this.currentLimits = {
      limit,
      used,
      remaining,
      resetTime: Date.now() + 60000 // Reset in 60 seconds
    };
  }

  // Apply a forced 60-second timeout
  applyForcedTimeout() {
    this.forcedTimeoutEnd = Date.now() + 60000; // 60 seconds from now
    console.log('Forced 60-second timeout applied - cooling off');
  }

  // Check if currently in forced timeout
  isInForcedTimeout(): boolean {
    return Date.now() < this.forcedTimeoutEnd;
  }

  // Get time remaining in forced timeout (in milliseconds)
  getForcedTimeoutRemaining(): number {
    if (!this.isInForcedTimeout()) return 0;
    return Math.max(0, this.forcedTimeoutEnd - Date.now());
  }


  // Calculate delay needed to stay at 95% of rate limit
  private calculateDelay(): number {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Check for forced timeout first
    if (this.isInForcedTimeout()) {
      const timeoutRemaining = this.getForcedTimeoutRemaining();
      console.log(`In forced timeout, waiting ${timeoutRemaining}ms`);
      return timeoutRemaining;
    }
    
    // If we don't have current rate limit info, use conservative defaults
    if (this.currentLimits.remaining <= 0) {
      // No requests remaining - trigger forced timeout if not already active
      if (!this.isInForcedTimeout()) {
        console.log('Rate limit exhausted - applying forced 60-second timeout');
        this.applyForcedTimeout();
        return this.getForcedTimeoutRemaining();
      }
      const timeUntilReset = Math.max(0, this.currentLimits.resetTime - now);
      console.log(`Rate limit exhausted, waiting ${timeUntilReset}ms until reset`);
      return timeUntilReset + RATE_LIMIT_CONFIG.timingBufferMs;
    }
    
    // Calculate current usage percentage
    const currentUsagePercent = this.currentLimits.used / this.currentLimits.limit;
    const maxAllowedUsage = Math.floor(this.currentLimits.limit * RATE_LIMIT_CONFIG.maxUsagePercent);
    
    console.log(`Rate limit status: ${this.currentLimits.used}/${this.currentLimits.limit} (${Math.round(currentUsagePercent * 100)}%), target max: ${maxAllowedUsage} (95%)`);
    
    // Only apply throttling if we're at or above 95% usage
    if (currentUsagePercent >= RATE_LIMIT_CONFIG.maxUsagePercent) {
      // We're at or above 95%, need to be conservative
      const timeUntilReset = Math.max(0, this.currentLimits.resetTime - now);
      const delayForSafeReset = Math.max(timeUntilReset * 0.15, RATE_LIMIT_CONFIG.minDelayMs * 5);
      
      console.log(`At/above 95% limit (${Math.round(currentUsagePercent * 100)}%), using conservative delay: ${delayForSafeReset}ms`);
      return delayForSafeReset;
    }
    
    // Below 95% - use minimal delay for speed
    const minimumDelay = Math.max(0, RATE_LIMIT_CONFIG.minDelayMs - timeSinceLastRequest);
    
    if (minimumDelay > 0) {
      console.log(`Below 95% threshold (${Math.round(currentUsagePercent * 100)}%), using minimal delay: ${minimumDelay}ms`);
    } else {
      console.log(`Below 95% threshold (${Math.round(currentUsagePercent * 100)}%), no delay needed`);
    }
    
    return minimumDelay;
  }

  // Execute a request with rate limiting
  async executeRequest<T>(requestFn: () => Promise<Response>): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const delay = this.calculateDelay();
          if (delay > 0) {
            console.log(`Applying delay of ${delay}ms before request`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          // Record request time
          this.lastRequestTime = Date.now();
          
          const response = await requestFn();
          
          // Update rate limits from response headers
          this.updateLimitsFromHeaders(response.headers);
          
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
      }
    }

    this.isProcessing = false;
  }

  // Get current rate limit status
  getRateLimitStatus() {
    const currentUsagePercent = this.currentLimits.used / this.currentLimits.limit;
    const maxAllowedUsage = Math.floor(this.currentLimits.limit * RATE_LIMIT_CONFIG.maxUsagePercent);
    
    return { 
      ...this.currentLimits,
      usagePercent: currentUsagePercent,
      maxAllowedUsage,
      isNearLimit: this.currentLimits.used >= maxAllowedUsage,
      requestsUntil100Percent: Math.max(0, maxAllowedUsage - this.currentLimits.used),
      isInForcedTimeout: this.isInForcedTimeout(),
      forcedTimeoutRemaining: this.getForcedTimeoutRemaining()
    };
  }
}

export const rateLimiter = DiscogsRateLimiter.getInstance();

// Export function to trigger timeout (for testing or manual cooldown)
export function triggerRateLimitTimeout() {
  rateLimiter.applyForcedTimeout();
}

// Wrapper for fetch with rate limiting and retry logic
export async function fetchWithRateLimit(
  url: string, 
  options: RequestInit = {}, 
  maxRetries = 5
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await rateLimiter.executeRequest(() => fetch(url, {
        ...options,
        // Add timeout and keep-alive headers to prevent connection drops
        signal: AbortSignal.timeout(30000), // 30 second timeout per request
        headers: {
          ...options.headers,
          'Connection': 'keep-alive',
        }
      }));
      
      // If it's a 500 error, retry
      if (response.status === 500 && attempt < maxRetries) {
        console.warn(`API request failed with 500 (attempt ${attempt + 1}/${maxRetries + 1}): ${url}`);
        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const isNetworkError = error instanceof Error && (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('fetch failed') ||
        error.name === 'AbortError'
      );
      
      if (attempt < maxRetries && isNetworkError) {
        const backoffTime = Math.min(Math.pow(2, attempt) * 1000, 10000); // Max 10 seconds
        console.warn(`Network error (attempt ${attempt + 1}/${maxRetries + 1}): ${url} - ${error.message}. Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else if (attempt < maxRetries) {
        console.warn(`API request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${url}`, error);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError || new Error('Maximum retries exceeded');
}