export type HTTPMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';

export interface OpenAPISpec {
  // OpenAPI 3.x
  openapi?: string;
  // Swagger 2.0
  swagger?: string;
  schemes?: string[];
  host?: string;
  basePath?: string;
  info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
    variables?: Record<string, {
      enum?: string[];
      default: string;
      description?: string;
    }>;
  }>;
  paths: Record<string, Record<HTTPMethod, OpenAPIOperation>>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: {
      description?: string;
      url: string;
    };
  }>;
}

export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    description?: string;
    content: {
      [contentType: string]: {
        schema: any;
      };
    };
    required?: boolean;
  };
  responses: {
    [statusCode: string]: {
      description: string;
      content?: {
        [contentType: string]: {
          schema: any;
        };
      };
    };
  };
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
  'x-codegen-request-body-name'?: string;
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema?: any;
  type?: string;
  format?: string;
  items?: {
    type: string;
    format?: string;
  };
  enum?: any[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  annotations?: {
    method?: string;
    path?: string;
    tags?: string[];
    title?: string;
    openWorldHint?: boolean;
    readOnlyHint?: boolean;
  };
  endpoint: {
    method: string;
    path: string;
    baseUrl: string;
  };
  security?: Array<{
    [key: string]: string[];
  }>;
}
