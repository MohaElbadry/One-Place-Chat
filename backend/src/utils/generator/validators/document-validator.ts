import type { DocumentValidationResult } from '../../../types/document.types';

/**
 * Validates API specification documents
 */
export class DocumentValidator {
  /**
   * Validates that the document is a valid OpenAPI/Swagger specification
   */
  public validate(document: any): DocumentValidationResult {
    if (!document) {
      return { 
        isValid: false, 
        errors: ['Document is empty'],
        warnings: []
      };
    }
    
    if (!document.openapi && !document.swagger) {
      return { 
        isValid: false, 
        errors: ['Not a valid OpenAPI/Swagger document'],
        warnings: []
      };
    }
    
    return { 
      isValid: true, 
      errors: [],
      warnings: []
    };
  }
}
