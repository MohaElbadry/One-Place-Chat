import type { OpenAPISpec, OpenAPIOperation, OpenAPIParameter, ToolDefinition } from '../types/openapi.types.js';
import type { JSONSchema7 } from 'json-schema';

export class OpenAPIParser {
  private spec: OpenAPISpec;
  private baseUrl: string;

  constructor(spec: OpenAPISpec) {
    this.spec = spec;
    this.baseUrl = this.resolveBaseUrl();
  }

  private resolveBaseUrl(): string {
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
      return `${scheme}://${host}${basePath}`;
    }
    
    // Default fallback
    return 'https://petstore.swagger.io/v2';
  }

  public parseOperations(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    for (const [path, methods] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (typeof operation === 'object' && 'operationId' in operation) {
          const op = operation as OpenAPIOperation;
          const tool = this.createToolDefinition(path, method, op);
          tools.push(tool);
        }
      }
    }

    return tools;
  }

  private createToolDefinition(
    path: string,
    method: string,
    operation: OpenAPIOperation
  ): ToolDefinition {
    const inputSchema = this.extractInputSchema(operation);
    
    return {
      name: operation.operationId,
      description: operation.summary || operation.description || 'No description available',
      inputSchema,
      annotations: {
        method: method.toUpperCase(),
        path,
        tags: operation.tags,
        deprecated: operation.deprecated
      },
      endpoint: {
        method: method.toUpperCase(),
        path,
        baseUrl: this.baseUrl
      },
      security: operation.security || this.spec.security
    };
  }

  private extractInputSchema(operation: OpenAPIOperation): JSONSchema7 {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Process path, query, and header parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        const paramSchema = this.convertParameterToSchema(param);
        if (paramSchema) {
          properties[param.name] = paramSchema;
          if (param.required) {
            required.push(param.name);
          }
        }
      }
    }

    // Process request body
    if (operation.requestBody) {
      const contentTypes = Object.keys(operation.requestBody.content);
      const jsonContent = contentTypes.find(ct => ct.includes('json')) || contentTypes[0];
      
      if (jsonContent && operation.requestBody.content[jsonContent]?.schema) {
        const bodySchema = this.resolveSchema(operation.requestBody.content[jsonContent].schema);
        properties['body'] = {
          ...bodySchema,
          description: operation.requestBody.description
        };
        
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
    let schema: JSONSchema7 = {
      type: param.type as any,
      description: param.description,
      format: param.format,
      deprecated: param.deprecated,
      enum: param.enum,
      default: param.default,
    };

    // Handle array types
    if (schema.type === 'array' && param.items) {
      schema.items = {
        type: param.items.type as any,
        format: param.items.format,
      };
    }

    // If we have a schema reference, resolve it
    if (param.schema) {
      const resolvedSchema = this.resolveSchema(param.schema);
      schema = { ...schema, ...resolvedSchema };
    }

    // Clean up undefined values
    Object.keys(schema).forEach(key => {
      if (schema[key as keyof JSONSchema7] === undefined) {
        delete schema[key as keyof JSONSchema7];
      }
    });

    return Object.keys(schema).length > 0 ? schema : null;
  }

  private resolveSchema(schema: any): any {
    if (!schema) return {};
    
    // Handle $ref
    if (schema.$ref) {
      const refPath = schema.$ref.split('/').slice(1); // Remove the '#'
      let current = this.spec as any;
      
      for (const part of refPath) {
        current = current[part];
        if (!current) break;
      }
      
      if (current) {
        return this.resolveSchema(current);
      }
    }
    
    // Handle allOf, anyOf, oneOf
    const combiners = ['allOf', 'anyOf', 'oneOf'] as const;
    for (const combiner of combiners) {
      if (schema[combiner]) {
        return {
          [combiner]: schema[combiner].map((s: any) => this.resolveSchema(s))
        };
      }
    }
    
    // Handle arrays
    if (schema.type === 'array' && schema.items) {
      return {
        ...schema,
        items: this.resolveSchema(schema.items)
      };
    }
    
    // Handle objects
    if (schema.properties) {
      const properties: Record<string, any> = {};
      for (const [propName, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
        properties[propName] = this.resolveSchema(propSchema);
      }
      
      return {
        ...schema,
        properties,
        required: schema.required || []
      };
    }
    
    return { ...schema };
  }
}
