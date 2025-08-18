import { Request, Response, NextFunction } from 'express';

/**
 * Centralized error handling system to eliminate duplicate error handling patterns
 */
export class ErrorHandler {
  /**
   * Standard error response format
   */
  static createErrorResponse(error: any, context?: string): {
    success: false;
    error: string;
    message: string;
    timestamp: string;
    context?: string;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const contextInfo = context ? ` in ${context}` : '';
    
    return {
      success: false,
      error: `Operation failed${contextInfo}`,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      ...(context && { context })
    };
  }

  /**
   * Handle API errors with proper logging and response formatting
   */
  static handleApiError(error: any, req: Request, res: Response, context?: string): void {
    const errorResponse = this.createErrorResponse(error, context);
    
    // Log error with context
    console.error(`❌ API Error${context ? ` in ${context}` : ''}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: req.originalUrl,
      method: req.method,
      timestamp: errorResponse.timestamp
    });

    // Determine appropriate status code
    let statusCode = 500;
    if (error instanceof Error) {
      if (error.message.includes('not found')) statusCode = 404;
      else if (error.message.includes('validation') || error.message.includes('invalid')) statusCode = 400;
      else if (error.message.includes('unauthorized') || error.message.includes('forbidden')) statusCode = 403;
    }

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Handle async route errors with proper error handling
   */
  static asyncHandler(fn: Function, context?: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        this.handleApiError(error, req, res, context);
      }
    };
  }

  /**
   * Validate required fields and return appropriate error if missing
   */
  static validateRequiredFields(fields: Record<string, any>, requiredFields: string[]): string[] {
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!fields[field] || fields[field] === '') {
        missingFields.push(field);
      }
    }
    
    return missingFields;
  }

  /**
   * Create validation error response
   */
  static createValidationError(missingFields: string[], context?: string): {
    success: false;
    error: string;
    message: string;
    missingFields: string[];
    timestamp: string;
    context?: string;
  } {
    return {
      success: false,
      error: 'Validation failed',
      message: `Missing required fields: ${missingFields.join(', ')}`,
      missingFields,
      timestamp: new Date().toISOString(),
      ...(context && { context })
    };
  }

  /**
   * Handle database operation errors
   */
  static handleDatabaseError(error: any, operation: string): never {
    console.error(`❌ Database error during ${operation}:`, error);
    
    if (error.message?.includes('not found')) {
      throw new Error(`Database record not found during ${operation}`);
    }
    
    if (error.message?.includes('duplicate')) {
      throw new Error(`Duplicate record detected during ${operation}`);
    }
    
    throw new Error(`Database operation failed during ${operation}: ${error.message}`);
  }

  /**
   * Handle external API errors
   */
  static handleExternalApiError(error: any, apiName: string): never {
    console.error(`❌ External API error from ${apiName}:`, error);
    
    if (error.status === 401) {
      throw new Error(`Authentication failed with ${apiName}`);
    }
    
    if (error.status === 429) {
      throw new Error(`Rate limit exceeded with ${apiName}`);
    }
    
    throw new Error(`External API call to ${apiName} failed: ${error.message}`);
  }
}
