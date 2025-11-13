export const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const clients = new Map();
    return (req, res, next) => {
        const clientIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || "unknown";
        const now = Date.now();
        const windowStart = now - windowMs;
        if (clients.has(clientIP)) {
            const clientRequests = clients.get(clientIP);
            const filteredRequests = clientRequests.filter((timestamp) => timestamp > windowStart);
            clients.set(clientIP, filteredRequests);
        }
        const currentRequests = clients.get(clientIP) || [];
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
        currentRequests.push(now);
        clients.set(clientIP, currentRequests);
        res.set({
            "X-RateLimit-Limit": maxRequests.toString(),
            "X-RateLimit-Remaining": (maxRequests - currentRequests.length).toString(),
            "X-RateLimit-Reset": new Date(now + windowMs).toISOString(),
        });
        next();
    };
};
export const bodySizeLimit = (maxSizeBytes = 1024 * 1024) => {
    return (req, res, next) => {
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
        let receivedBytes = 0;
        req.on("data", (chunk) => {
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
export const requestTimeout = (timeoutMs = 30000) => {
    return (req, res, next) => {
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({
                    success: false,
                    message: "Request timeout",
                    timeout: `${timeoutMs / 1000}s`,
                });
            }
        }, timeoutMs);
        res.on("finish", () => {
            clearTimeout(timeout);
        });
        res.on("close", () => {
            clearTimeout(timeout);
        });
        next();
    };
};
export const dosProtection = (options = {}) => {
    const { maxRequests = 100, windowMs = 15 * 60 * 1000, maxBodySize = 1024 * 1024, timeout = 30000, } = options;
    return [rateLimiter(maxRequests, windowMs), bodySizeLimit(maxBodySize), requestTimeout(timeout)];
};
export const ipBlocking = (blockedIPs = []) => {
    const blacklist = new Set(blockedIPs);
    return (req, res, next) => {
        const clientIP = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || "unknown";
        if (blacklist.has(clientIP)) {
            res.status(403).json({
                success: false,
                message: "IP address blocked",
                ip: clientIP,
            });
            return;
        }
        req.blockIP = (ip) => {
            blacklist.add(ip);
        };
        req.unblockIP = (ip) => {
            blacklist.delete(ip);
        };
        next();
    };
};
export const suspiciousActivityDetector = () => {
    const suspiciousPatterns = [
        /(<script|javascript:|vbscript:|onload=|onerror=)/i,
        /(union\s+select|drop\s+table|insert\s+into)/i,
        /(\.\.\/|\.\.\\|\/etc\/passwd|\/windows\/system32)/i,
        /(<\?php|<%|<\?=)/i,
    ];
    return (req, res, next) => {
        const requestData = JSON.stringify({
            url: req.url,
            query: req.query,
            body: req.body,
            headers: req.headers,
        });
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
export const securityStack = (options = {}) => {
    return [...dosProtection(options), ipBlocking(options.blockedIPs), suspiciousActivityDetector()];
};
