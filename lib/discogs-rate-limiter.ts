interface RateLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  resetTime: number;
}

class DiscogsRateLimiter {
  private static instance: DiscogsRateLimiter;
  private currentLimits: RateLimitInfo = {
    limit: 60, // Default for authenticated requests
    used: 0,
    remaining: 60,
    resetTime: Date.now() + 60000
  };
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;

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

  // Calculate delay needed before next request
  private calculateDelay(): number {
    if (this.currentLimits.remaining <= 0) {
      // No requests remaining, wait until reset
      return Math.max(0, this.currentLimits.resetTime - Date.now());
    }
    
    if (this.currentLimits.remaining <= 5) {
      // Very few remaining, add extra delay
      return 2000;
    }
    
    if (this.currentLimits.remaining <= 10) {
      // Few remaining, add moderate delay
      return 1000;
    }
    
    // Normal operation, minimal delay
    return 100;
  }

  // Execute a request with rate limiting
  async executeRequest<T>(requestFn: () => Promise<Response>): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const delay = this.calculateDelay();
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
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
    return { ...this.currentLimits };
  }
}

export const rateLimiter = DiscogsRateLimiter.getInstance();

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