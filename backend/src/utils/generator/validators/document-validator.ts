import { DocumentValidationResult } from '../../types/document.types';

/**
 * Validates API specification documents
 */
export class DocumentValidator {
  /**
   * Validates that the document is a valid OpenAPI/Swagger specification
   */
  public validate(document: any): DocumentValidationResult {
    if (!document) {
      return { valid: false, error: 'Document is empty' };
    }
    
    if (!document.openapi && !document.swagger) {
      return { valid: false, error: 'Not a valid OpenAPI/Swagger document' };
    }
    
    return { valid: true };
  }
}
