import * as fs from 'fs';
import axios from 'axios';
import { DocumentLoader } from '../types/document.types';

/**
 * Handles loading API specification documents from various sources
 */
export class DocumentLoaderImpl implements DocumentLoader {
  /**
   * Loads a document from a file path or URL
   */
  public async load(documentPath: string): Promise<any> {
    try {
      let content: string;

      if (this.isUrl(documentPath)) {
        const response = await axios.get(documentPath);
        content = JSON.stringify(response.data);
      } else {
        content = fs.readFileSync(documentPath, 'utf-8');
      }

      return JSON.parse(content);
    } catch (error: any) {
      throw new Error(`Failed to load document: ${error.message}`);
    }
  }

  /**
   * Checks if a path is a valid URL
   */
  public isUrl(path: string): boolean {
    try {
      new URL(path);
      return true;
    } catch {
      return false;
    }
  }
}
