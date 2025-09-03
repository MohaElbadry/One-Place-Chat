import { Request, Response, NextFunction } from 'express';

// API version status types
type ApiStatus = 'stable' | 'beta' | 'deprecated' | 'sunset';

// API version configuration
export const API_VERSIONS: Record<string, {
  version: string;
  status: ApiStatus;
  releaseDate: string;
  deprecationDate: string | null;
  sunsetDate: string | null;
}> = {
  v1: {
    version: '1.0.0',
    status: 'stable',
    releaseDate: '2024-12-01',
    deprecationDate: null,
    sunsetDate: null,
  },
  v2: {
    version: '2.0.0',
    status: 'beta',
    releaseDate: '2024-12-15',
    deprecationDate: null,
    sunsetDate: null,
  },
};

export type ApiVersion = keyof typeof API_VERSIONS;

// Version header middleware
export function versionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestedVersion = req.headers['api-version'] as string || req.query.version as string;
  
  if (requestedVersion) {
    // Validate version
    if (!(requestedVersion in API_VERSIONS)) {
      res.status(400).json({
        success: false,
        error: 'Invalid API version',
        message: `Version '${requestedVersion}' is not supported`,
        supportedVersions: Object.keys(API_VERSIONS),
        currentVersion: 'v1',
      });
      return;
    }
    
    // Check if version is deprecated
    const versionInfo = API_VERSIONS[requestedVersion as ApiVersion];
    if (versionInfo.status === 'deprecated') {
      res.setHeader('X-API-Deprecation-Warning', `Version ${requestedVersion} is deprecated`);
      res.setHeader('X-API-Deprecation-Date', versionInfo.deprecationDate || '');
    }
    
    // Check if version is sunset
    if (versionInfo.status === 'sunset') {
      res.status(410).json({
        success: false,
        error: 'API version sunset',
        message: `Version '${requestedVersion}' has been sunset`,
        sunsetDate: versionInfo.sunsetDate,
        supportedVersions: Object.keys(API_VERSIONS).filter(v => API_VERSIONS[v as ApiVersion].status !== 'sunset'),
      });
      return;
    }
    
    // Add version info to request
    (req as any).apiVersion = requestedVersion;
    (req as any).versionInfo = versionInfo;
  } else {
    // Default to v1
    (req as any).apiVersion = 'v1';
    (req as any).versionInfo = API_VERSIONS.v1;
  }
  
  // Add version headers to response
  res.setHeader('X-API-Version', (req as any).apiVersion);
  res.setHeader('X-API-Version-Status', (req as any).versionInfo.status);
  
  next();
}

// Version-specific route handler
export function versionedRoute(version: ApiVersion, handler: (req: Request, res: Response, next: NextFunction) => void) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestedVersion = (req as any).apiVersion;
    
    if (requestedVersion === version) {
      return handler(req, res, next);
    }
    
    // If not the requested version, continue to next middleware
    next();
  };
}

// Version info endpoint
export function getVersionInfo(req: Request, res: Response): void {
  const requestedVersion = (req as any).apiVersion;
  const versionInfo = (req as any).versionInfo;
  
  res.json({
    success: true,
    data: {
      currentVersion: requestedVersion,
      versionInfo,
      allVersions: API_VERSIONS,
      supportedVersions: Object.keys(API_VERSIONS),
    },
  });
}

// Version deprecation warning middleware
export function deprecationWarningMiddleware(req: Request, res: Response, next: NextFunction): void {
  const versionInfo = (req as any).versionInfo;
  
  if (versionInfo && versionInfo.status === 'deprecated') {
    res.setHeader('X-API-Deprecation-Warning', `Version ${(req as any).apiVersion} is deprecated`);
    res.setHeader('X-API-Deprecation-Date', versionInfo.deprecationDate || '');
    res.setHeader('X-API-Sunset-Date', versionInfo.sunsetDate || '');
  }
  
  next();
}

// Version compatibility middleware
export function compatibilityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestedVersion = (req as any).apiVersion;
  const versionInfo = (req as any).versionInfo;
  
  // Add compatibility headers
  res.setHeader('X-API-Version', requestedVersion);
  res.setHeader('X-API-Version-Status', versionInfo.status);
  res.setHeader('X-API-Release-Date', versionInfo.releaseDate);
  
  if (versionInfo.deprecationDate) {
    res.setHeader('X-API-Deprecation-Date', versionInfo.deprecationDate);
  }
  
  if (versionInfo.sunsetDate) {
    res.setHeader('X-API-Sunset-Date', versionInfo.sunsetDate);
  }
  
  next();
}

// Version migration helper
export function migrateResponse(data: any, fromVersion: ApiVersion, toVersion: ApiVersion): any {
  // Implement version-specific data migration logic here
  // This is a placeholder for future version migration needs
  
  if (fromVersion === 'v1' && toVersion === 'v2') {
    // Example: Add new fields for v2
    return {
      ...data,
      version: 'v2',
      migrated: true,
    };
  }
  
  return data;
}

// Version-specific error responses
export function versionedErrorResponse(req: Request, res: Response, error: any, statusCode: number = 500): void {
  const requestedVersion = (req as any).apiVersion;
  const versionInfo = (req as any).versionInfo;
  
  const errorResponse: any = {
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    version: requestedVersion,
  };
  
  // Add version-specific error details
  if (versionInfo.status === 'beta') {
    errorResponse.betaWarning = 'This is a beta version. Features may change without notice.';
  }
  
  res.status(statusCode).json(errorResponse);
}

// Version validation helper
export function validateVersion(version: string): version is ApiVersion {
  return version in API_VERSIONS;
}

// Get supported versions
export function getSupportedVersions(): string[] {
  return Object.keys(API_VERSIONS).filter(v => API_VERSIONS[v as ApiVersion].status !== 'sunset');
}

// Get stable versions
export function getStableVersions(): string[] {
  return Object.keys(API_VERSIONS).filter(v => API_VERSIONS[v as ApiVersion].status === 'stable');
}

// Get deprecated versions
export function getDeprecatedVersions(): string[] {
  return Object.keys(API_VERSIONS).filter(v => API_VERSIONS[v as ApiVersion].status === 'deprecated');
}
