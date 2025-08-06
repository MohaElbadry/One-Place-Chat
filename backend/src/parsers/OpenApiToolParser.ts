import { OpenAPIV3 } from "openapi-types";
import { JSONSchema7 } from "json-schema";
import {
  MCPTool,
  OpenAPIParameter,
  OpenAPIOperation,
  HttpMethod,
  ParameterLocation,
} from "../types.js";

/**
 * Parser for OpenAPI specifications that generates MCP tools.
 * Converts OpenAPI operations into executable tool definitions.
 */
export class OpenApiToolParser {
  private spec: OpenAPIV3.Document;
  private baseUrl: string;
  private components: OpenAPIV3.ComponentsObject;
  private securitySchemes: Record<
    string,
    OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject
  > = {};

  constructor(spec: OpenAPIV3.Document) {
    this.spec = spec;
    this.components = spec.components || {};
    this.securitySchemes = this.components.securitySchemes || {};
    this.baseUrl = this.getBaseUrl();
  }

  private getBaseUrl(): string {
    const spec = this.spec as any; // Type assertion to handle both v2 and v3

    // Handle OpenAPI 3.x
    if (spec.servers && spec.servers.length > 0) {
      let url = spec.servers[0].url;
      // Handle server variables if present
      if (spec.servers[0].variables) {
        for (const [varName, varDef] of Object.entries(
          spec.servers[0].variables as Record<string, { default: string }>
        )) {
          url = url.replace(`{${varName}}`, (varDef as any).default);
        }
      }
      // If the URL is relative and starts with /, prepend a default host
      if (url.startsWith("/")) {
        const defaultHost: string = ""; // Default fallback
        url = `${defaultHost}${url}`;
      }
      return url.endsWith("/") ? url.slice(0, -1) : url;
    }

    // Handle Swagger 2.0
    if ("swagger" in spec && spec.swagger === "2.0") {
      const scheme = Array.isArray(spec.schemes) ? spec.schemes[0] : "https";
      const host = spec.host || "petstore.swagger.io";
      const basePath = spec.basePath || "";
      return `${scheme}://${host}${basePath}`.replace(/\/$/, "");
    }

    return ""; // Fallback to relative URLs
  }

  public parseOperations(): MCPTool[] {
    const tools: MCPTool[] = [];

    if (!this.spec.paths) return tools;

    // Process each path in the spec
    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      if (!pathItem) continue;

      // Process each HTTP method in the path
      const methods = Object.entries(pathItem)
        .filter(([key]) =>
          ["get", "post", "put", "delete", "patch", "head", "options"].includes(
            key
          )
        )
        .map(([key]) => key as Lowercase<HttpMethod>);

      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        try {
          const tool = this.parseOperation(
            path,
            method.toUpperCase() as HttpMethod,
            operation
          );
          if (tool) {
            tools.push(tool);
          }
        } catch (error) {
          console.error(
            `Error parsing operation ${method.toUpperCase()} ${path}:`,
            error
          );
        }
      }
    }

    return tools;
  }

  private parseOperation(
    path: string,
    method: HttpMethod,
    operation: OpenAPIV3.OperationObject
  ): MCPTool | null {
    if (!operation) return null;

    const operationId =
      operation.operationId ||
      `${method}_${path.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const description =
      operation.summary || operation.description || "No description available";

    // Convert parameters to OpenAPIParameter array
    const parameters = (operation.parameters || [])
      .map((param) => {
        if ("$ref" in param) {
          return this.resolveParameterRef(param);
        }
        return this.normalizeParameter(param);
      })
      .filter((p): p is OpenAPIParameter => p !== null);

    // Handle request body reference if present
    let requestBody = operation.requestBody;
    if (requestBody && "$ref" in requestBody) {
      requestBody = this.resolveRequestBodyRef(requestBody);
    }

    // Create operation with normalized parameters and request body
    const normalizedOperation: OpenAPIOperation = {
      ...operation,
      parameters,
      requestBody: requestBody as OpenAPIV3.RequestBodyObject | undefined,
    };

    return {
      name: operationId,
      description,
      inputSchema: this.extractInputSchema(normalizedOperation),
      annotations: {
        method,
        path,
        tags: operation.tags,
        deprecated: !!operation.deprecated,
        title: operation.summary || "",
        openWorldHint: false,
        readOnlyHint: method === "GET" || method === "HEAD",
      },
      endpoint: {
        method,
        path,
        baseUrl: this.baseUrl,
      },
      security: operation.security || this.spec.security || [],
      execute: async () => {
        throw new Error(
          "Not implemented: API calls should be handled by the MCP server"
        );
      },
    };
  }

  private resolveRequestBodyRef(
    ref: OpenAPIV3.ReferenceObject
  ): OpenAPIV3.RequestBodyObject | undefined {
    if (!ref.$ref) return undefined;

    const refPath = ref.$ref.split("/").slice(1); // Remove the leading #
    let current: any = this.spec;

    for (const part of refPath) {
      if (!current || typeof current !== "object" || !(part in current)) {
        return undefined;
      }
      current = current[part];
    }

    return current as OpenAPIV3.RequestBodyObject;
  }

  private resolveSchema(schema: any): any {
    if (!schema) return {};

    // Handle schema references
    if (schema.$ref) {
      const refPath = schema.$ref.split("/").slice(1);
      let current: any = this.spec;

      for (const part of refPath) {
        if (!current || typeof current !== "object" || !(part in current)) {
          return {}; // Invalid reference
        }
        current = current[part];
      }
      return this.resolveSchema(current);
    }

    // Handle allOf, anyOf, oneOf
    if (schema.allOf || schema.anyOf || schema.oneOf) {
      const combined: any = { type: "object", properties: {}, required: [] };
      const schemas = [
        ...(schema.allOf || []),
        ...(schema.anyOf || []),
        ...(schema.oneOf || []),
      ];

      for (const s of schemas) {
        const resolved = this.resolveSchema(s);
        if (resolved.properties) {
          combined.properties = {
            ...combined.properties,
            ...resolved.properties,
          };
        }
        if (resolved.required) {
          combined.required = [
            ...(combined.required || []),
            ...resolved.required,
          ];
        }
      }

      return combined;
    }

    // Handle arrays
    if (schema.type === "array" && schema.items) {
      return {
        type: "array",
        items: this.resolveSchema(schema.items),
      };
    }

    // Handle objects
    if (schema.type === "object" || schema.properties) {
      const result: any = { type: "object", properties: {} };

      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(
          schema.properties as Record<string, any>
        )) {
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

  private normalizeParameter(
    param: OpenAPIV3.ParameterObject
  ): OpenAPIParameter | null {
    if (!param || !param.in) return null;

    // Ensure the parameter is in a valid location
    const validLocations: ParameterLocation[] = [
      "query",
      "header",
      "path",
      "cookie",
    ];
    if (!validLocations.includes(param.in as ParameterLocation)) return null;

    const normalized: OpenAPIParameter = {
      ...param,
      in: param.in as ParameterLocation,
      schema: param.schema as JSONSchema7,
      type: (param as any).type,
      format: (param as any).format,
      enum: (param as any).enum,
      default: (param as any).default,
    };

    return normalized;
  }

  private extractInputSchema(operation: OpenAPIOperation): JSONSchema7 {
    const properties: Record<string, any> = {};
    const required: string[] = [];
  
    // Handle parameters (query, path, header)
    if (operation.parameters) {
      for (const param of operation.parameters) {
        const paramDef = this.resolveParameterRef(param);
        if (!paramDef) continue;
  
        const {
          name,
          in: paramIn,
          required: isRequired,
          schema,
          description,
        } = paramDef;
        
        if (!name || !paramIn) continue;
  
        // Only include path, query, and header parameters
        if (!['path', 'query', 'header'].includes(paramIn)) continue;
  
        // Create property schema
        const propertySchema: JSONSchema7 = {
          type: (schema?.type as any) || 'string',
          description,
          ...(schema || {}),
        };
  
        // Handle enums
        if ((param as any).enum) {
          propertySchema.enum = (param as any).enum;
        }
  
        // Handle default values
        if ((param as any).default !== undefined) {
          propertySchema.default = (param as any).default;
        }
  
        // Add to properties
        properties[name] = propertySchema;
  
        // Mark as required if it's a path parameter or explicitly marked as required
        if (isRequired || paramIn === 'path') {
          if (!required.includes(name)) {
            required.push(name);
          }
        }
      }
    }
  
    // Handle request body
    if (operation.requestBody && !('$ref' in operation.requestBody)) {
      const content = operation.requestBody.content;
      if (content && content['application/json']?.schema) {
        const bodySchema = this.resolveSchema(content['application/json'].schema);
        if (bodySchema) {
          // If the schema is an object with properties, include them directly
          if (bodySchema.type === 'object' && bodySchema.properties) {
            Object.assign(properties, bodySchema.properties);
            
            // Add required fields from the body schema
            if (Array.isArray(bodySchema.required)) {
              for (const field of bodySchema.required) {
                if (!required.includes(field as string)) {
                  required.push(field as string);
                }
              }
            }
          } else {
            // For non-object schemas, include as a single 'body' parameter
            properties.body = bodySchema;
            if (operation.requestBody.required) {
              required.push('body');
            }
          }
        }
      }
    }
  
    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false,
    };
  }

  private convertParameterToSchema(
    param: OpenAPIParameter
  ): JSONSchema7 | null {
    if (!param) return null;

    // Create a basic schema with type information
    const schema: JSONSchema7 & { deprecated?: boolean } = {
      type: (param.schema?.type ||
        (param as any).type ||
        "string") as JSONSchema7["type"],
      description: param.description,
      format: param.format || param.schema?.format,
      enum: param.enum || param.schema?.enum,
      default: (param as any).default,
    };

    // Add deprecated property if needed
    if ((param as any).deprecated) {
      schema.deprecated = true;
    }

    // Handle array types
    if (
      (schema.type === "array" || (param as any).type === "array") &&
      (param.items || param.schema?.items)
    ) {
      schema.items = param.items || param.schema?.items || { type: "string" };
    }

    return Object.keys(schema).length > 0 ? schema : null;
  }

  private resolveParameterRef(
    param: OpenAPIParameter | { $ref: string }
  ): OpenAPIParameter | null {
    // If it's not a reference, return as is
    if (!("$ref" in param)) return param;

    // Handle the case where $ref might be undefined
    if (!param.$ref) return null;

    // Resolve the reference (e.g., #/components/parameters/PetId)
    const refPath = param.$ref.split("/").slice(1); // Remove the leading #
    let current: any = this.spec;

    for (const part of refPath) {
      if (!current || typeof current !== "object" || !(part in current)) {
        return null; // Invalid reference
      }
      current = current[part];
    }

    // Ensure we have a valid parameter
    if (
      current &&
      typeof current === "object" &&
      "name" in current &&
      "in" in current
    ) {
      return current as OpenAPIParameter;
    }

    return null;
  }
}
