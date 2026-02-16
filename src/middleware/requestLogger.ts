import { Request, Response, NextFunction } from 'express';

/**
 * Request Logger Middleware
 * Logs detailed information about each HTTP request and response
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log incoming request
  console.log('\n' + '='.repeat(80));
  console.log(`📥 INCOMING REQUEST`);
  console.log('='.repeat(80));
  console.log(`⏰ Time: ${timestamp}`);
  console.log(`🔗 Method: ${req.method}`);
  console.log(`🌐 URL: ${req.originalUrl}`);
  console.log(`📍 Path: ${req.path}`);
  console.log(`🔑 Headers:`, JSON.stringify({
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'Bearer [REDACTED]' : 'None',
    'user-agent': req.headers['user-agent'],
  }, null, 2));
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Body:`, JSON.stringify(req.body, null, 2));
  }
  
  if (req.query && Object.keys(req.query).length > 0) {
    console.log(`🔍 Query:`, JSON.stringify(req.query, null, 2));
  }
  
  if (req.params && Object.keys(req.params).length > 0) {
    console.log(`📌 Params:`, JSON.stringify(req.params, null, 2));
  }

  // Capture the original res.json to log response
  const originalJson = res.json.bind(res);
  
  res.json = function (body: any): Response {
    const duration = Date.now() - startTime;
    const responseTimestamp = new Date().toISOString();
    
    // Log outgoing response
    console.log('\n' + '-'.repeat(80));
    console.log(`📤 OUTGOING RESPONSE`);
    console.log('-'.repeat(80));
    console.log(`⏰ Time: ${responseTimestamp}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🔗 Method: ${req.method}`);
    console.log(`🌐 URL: ${req.originalUrl}`);
    console.log(`📊 Status: ${res.statusCode}`);
    console.log(`✅ Success: ${body?.success !== false}`);
    
    if (body) {
      // Redact sensitive information
      const sanitizedBody = JSON.parse(JSON.stringify(body));
      if (sanitizedBody.data?.token) {
        sanitizedBody.data.token = '[REDACTED]';
      }
      if (sanitizedBody.data?.user?.password) {
        delete sanitizedBody.data.user.password;
      }
      
      console.log(`📦 Response Body:`, JSON.stringify(sanitizedBody, null, 2));
    }
    
    console.log('='.repeat(80) + '\n');
    
    return originalJson(body);
  };

  next();
};
