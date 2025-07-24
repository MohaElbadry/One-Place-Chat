import { OpenAPIV3 } from 'openapi-types';
import { JSONSchema7 } from 'json-schema';
import { OpenAPISpec, ToolDefinition } from '../types/openapi.types';

type ParameterLocation = 'query' | 'header' | 'path' | 'cookie';

interface OpenAPIParameter {
  name: string;
  in: ParameterLocation;
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: any;
  type?: string;
  format?: string;
  enum?: any[];
  default?: any;
  items?: {
    type?: string;
    format?: string;
    enum?: any[];
    $ref?: string;
  };
  $ref?: string;
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<OpenAPIParameter | { $ref: string }>;
  requestBody?: {
    description?: string;
    content: {
      [mimeType: string]: {
        schema: any;
      };
    };
    required?: boolean;
  };
  responses: Record<string, any>;
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
}

export class OpenAPIParser {
  private spec: OpenAPISpec;
  private baseUrl: string;
  private components: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
    responses?: Record<string, any>;
    parameters?: Record<string, OpenAPIParameter>;
    requestBodies?: Record<string, any>;
  };

  constructor(spec: OpenAPISpec) {
    this.spec = spec;
    this.components = spec.components || {};
    this.baseUrl = this.determineBaseUrl();
  }

  private determineBaseUrl(): string {
    // Handle OpenAPI 3.x
    if (this.spec.servers && this.spec.servers.length > 0) {
      const server = this.spec.servers[0];
      let url = server.url;
      
      // Handle server variables if present
      if (server.variables) {
        for (const [varName, varDef] of Object.entries(server.variables as Record<string, { default: string }>)) {
          url = url.replace(`{${varName}}`, varDef.default);
        }
      }
      
      // Ensure the URL doesn't end with a slash
      return url.endsWith('/') ? url.slice(0, -1) : url;
    }
    
    // Handle Swagger 2.0
    if ('swagger' in this.spec) {
      const scheme = this.spec.schemes?.[0] || 'https';
      const host = this.spec.host || 'petstore.swagger.io';
      const basePath = this.spec.basePath || '';
      return `${scheme}://${host}${basePath}`.replace(/\/$/, '');
    }
    
    return ''; // Fallback to relative URLs
  }

  public parseOperations(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    
    // Process each path in the spec
    const paths = this.spec.paths || {};
    for (const [path, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      
      // Process each HTTP method in the path
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;
      for (const method of methods) {
        // Safely access the operation using type assertion
        const operation = (pathItem as any)[method];
        if (!operation || typeof operation !== 'object') continue;
        
        try {
          const tool = this.parseOperation(path, method.toUpperCase(), operation);
          if (tool) {
            tools.push(tool);
          }
        } catch (error) {
          console.error(`Error parsing operation ${method.toUpperCase()} ${path}:`, error);
        }
      }
    }
    
    return tools;
  }

  private parseOperation(path: string, method: string, operation: OpenAPIOperation): ToolDefinition | null {
    const inputSchema = this.extractInputSchema(operation);
    const methodUpper = method.toUpperCase();
    
    return {
      name: operation.operationId || `${methodUpper}_${path.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      description: operation.summary || operation.description || 'No description available',
      inputSchema,
      annotations: {
        method: methodUpper,
        path,
        tags: operation.tags,
        deprecated: operation.deprecated || false,
        title: operation.summary || '',
        openWorldHint: false,
        readOnlyHint: methodUpper === 'GET' || methodUpper === 'HEAD'
      },
      endpoint: {
        method: methodUpper,
        path,
        baseUrl: this.baseUrl
      },
      security: operation.security || this.spec.security || [],
      execute: async () => {
        throw new Error('Not implemented: API calls should be handled by the MCP server');
      }
    };
  }

  private extractInputSchema(operation: OpenAPIOperation): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Handle parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        const paramDef = this.resolveParameterRef(param);
        if (!paramDef) continue;

        const { name, in: paramIn, required: isRequired, schema, description } = paramDef;
        
        // Skip parameters that aren't path, query, or header
        if (!['path', 'query', 'header'].includes(paramIn)) continue;
        
        // Add to properties
        properties[name] = {
          type: schema?.type || 'string',
          description,
          ...(schema || {})
        };
        
        // Mark as required if needed
        if (isRequired || paramIn === 'path') {
          required.push(name);
        }
      }
    }

    // Handle request body
    if (operation.requestBody) {
      const content = operation.requestBody.content;
      const jsonContent = content['application/json'];
      if (jsonContent?.schema) {
        properties['body'] = this.resolveSchema(jsonContent.schema);
        if (operation.requestBody.required) {
          required.push('body');
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false
    };
  }

  private convertParameterToSchema(param: OpenAPIParameter): JSONSchema7 | null {
    if (!param) return null;
    
    // Create a basic schema with type information
    const schema: JSONSchema7 & { deprecated?: boolean } = {
      type: (param.schema?.type || param.type || 'string') as JSONSchema7['type'],
      description: param.description,
      format: param.format || param.schema?.format,
      enum: param.enum || param.schema?.enum,
      default: param.default,
    };

    // Add deprecated property if needed
    if (param.deprecated) {
      schema.deprecated = true;
    }

    // Handle array types
    if ((schema.type === 'array' || param.type === 'array') && (param.items || param.schema?.items)) {
      schema.items = param.items || param.schema?.items || { type: 'string' };
    }

    return schema;
    return Object.keys(schema).length > 0 ? schema : null;
  }

  private resolveParameterRef(param: OpenAPIParameter | { $ref: string }): OpenAPIParameter | null {
    // If it's not a reference, return as is
    if (!('$ref' in param)) return param;
    
    // Handle the case where $ref might be undefined
    if (!param.$ref) return null;
    
    // Resolve the reference (e.g., #/components/parameters/PetId)
    const refPath = param.$ref.split('/').slice(1); // Remove the leading #
    let current: any = this.spec;
    
    for (const part of refPath) {
      if (!current || typeof current !== 'object' || !(part in current)) {
        return null; // Invalid reference
      }
      current = current[part];
    }
    
    // Ensure we have a valid parameter
    if (current && typeof current === 'object' && 'name' in current && 'in' in current) {
      return current as OpenAPIParameter;
    }
    
    return null;
  }

  private resolveSchema(schema: any): any {
    if (!schema) return {};
    
    // Handle schema references
    if (schema.$ref) {
      const refPath = schema.$ref.split('/').slice(1);
      let current: any = this.spec;
      
      for (const part of refPath) {
        if (!current || typeof current !== 'object' || !(part in current)) {
          return {}; // Invalid reference
        }
        current = current[part];
      }
      return this.resolveSchema(current);
    }
    
    // Handle allOf, anyOf, oneOf
    if (schema.allOf || schema.anyOf || schema.oneOf) {
      const combined: any = { type: 'object', properties: {}, required: [] };
      const schemas = [...(schema.allOf || []), ...(schema.anyOf || []), ...(schema.oneOf || [])];
      
      for (const s of schemas) {
        const resolved = this.resolveSchema(s);
        if (resolved.properties) {
          combined.properties = { ...combined.properties, ...resolved.properties };
        }
        if (resolved.required) {
          combined.required = [...(combined.required || []), ...resolved.required];
        }
      }
      
      return combined;
    }
    
    // Handle arrays
    if (schema.type === 'array' && schema.items) {
      return {
        type: 'array',
        items: this.resolveSchema(schema.items)
      };
    }
    
    // Handle objects
    if (schema.type === 'object' || schema.properties) {
      const result: any = { type: 'object', properties: {} };
      
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
          result.properties[propName] = this.resolveSchema(propSchema);
        }
      }
      
      if (schema.required) {
        result.required = schema.required;
      }
      
      return result;
    }
    
    // Handle primitive types
    return { ...schema };
  }
}
