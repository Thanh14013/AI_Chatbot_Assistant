import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * General Security Middleware
 * Protection against DOS attacks with rate limiting, body size limit, and request timeout
 */

// Extend Express Request type to include custom methods
declare global {
  namespace Express {
    interface Request {
      blockIP?: (ip: string) => void;
      unblockIP?: (ip: string) => void;
    }
  }
}

interface RateLimitInfo {
  timestamps: number[];
}

interface SecurityOptions {
  maxRequests?: number;
  windowMs?: number;
  maxBodySize?: number;
  timeout?: number;
  blockedIPs?: string[];
}

/**
 * Rate limiting middleware to prevent DOS attacks
 * Tracks requests per IP address in a time window
 */
export const rateLimiter = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000
): RequestHandler => {
  const clients = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP =
      req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries for this client
    if (clients.has(clientIP)) {
      const clientRequests = clients.get(clientIP)!;
      const filteredRequests = clientRequests.filter((timestamp) => timestamp > windowStart);
      clients.set(clientIP, filteredRequests);
    }

    // Get current client requests
    const currentRequests = clients.get(clientIP) || [];

    // Check if limit exceeded
    if (currentRequests.length >= maxRequests) {
      res.status(429).json({
        success: false,
        message: "Too many requests from this IP",
        retryAfter: Math.ceil(windowMs / 1000),
        limit: maxRequests,
        windowMs: windowMs,
      });
      return;
    }

    // Add current request timestamp
    currentRequests.push(now);
    clients.set(clientIP, currentRequests);

    // Add rate limit headers
    res.set({
      "X-RateLimit-Limit": maxRequests.toString(),
      "X-RateLimit-Remaining": (maxRequests - currentRequests.length).toString(),
      "X-RateLimit-Reset": new Date(now + windowMs).toISOString(),
    });

    next();
  };
};

/**
 * Body size limit middleware to prevent large payload attacks
 * Checks Content-Length header before processing request
 */
export const bodySizeLimit = (maxSizeBytes: number = 1024 * 1024): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers["content-length"];

    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      res.status(413).json({
        success: false,
        message: "Request body too large",
        maxSize: `${Math.round(maxSizeBytes / 1024)}KB`,
        receivedSize: `${Math.round(parseInt(contentLength) / 1024)}KB`,
      });
      return;
    }

    // Set up streaming body size check for requests without content-length
    let receivedBytes = 0;

    req.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxSizeBytes) {
        req.destroy();
        if (!res.headersSent) {
          res.status(413).json({
            success: false,
            message: "Request body too large",
            maxSize: `${Math.round(maxSizeBytes / 1024)}KB`,
          });
        }
      }
    });

    next();
  };
};

/**
 * Request timeout middleware to prevent slow loris attacks
 * Sets timeout for request processing
 */
export const requestTimeout = (timeoutMs: number = 30000): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: "Request timeout",
          timeout: `${timeoutMs / 1000}s`,
        });
      }
    }, timeoutMs);

    // Clear timeout when response is finished
    res.on("finish", () => {
      clearTimeout(timeout);
    });

    // Clear timeout when response is closed
    res.on("close", () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Combined DOS protection middleware
 * Applies all protection measures with default settings
 */
export const dosProtection = (options: SecurityOptions = {}): RequestHandler[] => {
  const {
    maxRequests = 100,
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxBodySize = 1024 * 1024, // 1MB
    timeout = 30000, // 30 seconds
  } = options;

  return [rateLimiter(maxRequests, windowMs), bodySizeLimit(maxBodySize), requestTimeout(timeout)];
};

/**
 * IP blocking middleware for known malicious IPs
 * Maintains a blacklist of blocked IP addresses
 */
export const ipBlocking = (blockedIPs: string[] = []): RequestHandler => {
  const blacklist = new Set<string>(blockedIPs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP =
      req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || "unknown";

    if (blacklist.has(clientIP)) {
      res.status(403).json({
        success: false,
        message: "IP address blocked",
        ip: clientIP,
      });
      return;
    }

    // Add method to block IP during runtime
    req.blockIP = (ip: string): void => {
      blacklist.add(ip);
    };

    // Add method to unblock IP during runtime
    req.unblockIP = (ip: string): void => {
      blacklist.delete(ip);
    };

    next();
  };
};

/**
 * Suspicious activity detection
 * Monitors for potential attack patterns
 */
export const suspiciousActivityDetector = (): RequestHandler => {
  const suspiciousPatterns: RegExp[] = [
    /(<script|javascript:|vbscript:|onload=|onerror=)/i, // XSS patterns
    /(union\s+select|drop\s+table|insert\s+into)/i, // SQL injection
    /(\.\.\/|\.\.\\|\/etc\/passwd|\/windows\/system32)/i, // Path traversal
    /(<\?php|<%|<\?=)/i, // Code injection
  ];

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestData = JSON.stringify({
      url: req.url,
      query: req.query,
      body: req.body,
      headers: req.headers,
    });

    // Check for suspicious patterns
    const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(requestData));

    if (isSuspicious) {
      res.status(400).json({
        success: false,
        message: "Suspicious activity detected",
        code: "SUSPICIOUS_REQUEST",
      });
      return;
    }

    next();
  };
};

/**
 * Complete security middleware stack
 * Combines all security measures for maximum protection
 */
export const securityStack = (options: SecurityOptions = {}): RequestHandler[] => {
  return [...dosProtection(options), ipBlocking(options.blockedIPs), suspiciousActivityDetector()];
};
