"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface Tool {
  id: string;
  name: string;
  description: string;
  method: string;
  path: string;
  tags: string[];
  deprecated: boolean;
  title: string;
  readOnly: boolean;
  openWorld: boolean;
}

interface ToolsPanelProps {
  tools: Tool[];
  onToolClick?: (tool: Tool) => void;
}

export default function ToolsPanel({ tools, onToolClick }: ToolsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-green-500/20 text-green-400 border border-green-500/30";
      case "POST":
        return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
      case "PUT":
        return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
      case "DELETE":
        return "bg-red-500/20 text-red-400 border border-red-500/30";
      case "PATCH":
        return "bg-purple-500/20 text-purple-400 border border-purple-500/30";
      default:
        return "bg-muted text-muted-foreground border border-border";
    }
  };

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.path.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const toggleToolExpansion = (toolId: string) => {
    setExpandedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  };

  const isLongDescription = (description: string) => {
    return description.length > 150;
  };

  const truncateDescription = (description: string, toolId: string) => {
    if (!isLongDescription(description)) {
      return { description, isTruncated: false };
    }

    const isExpanded = expandedTools.has(toolId);

    if (isExpanded) {
      return { description, isTruncated: false };
    }

    const truncatedDescription = description.substring(0, 150) + "...";
    return { description: truncatedDescription, isTruncated: true };
  };

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Available Tools
        </h2>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-muted text-foreground"
          />
        </div>
      </div>

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto">
        {filteredTools.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <span className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50">
              🔧
            </span>
            <p className="text-sm">No tools found</p>
            <p className="text-xs text-muted-foreground/70">
              Try adjusting your search
            </p>
          </div>
        ) : (
          <div className="p-2">
            {filteredTools.map((tool) => {
              const { description: displayDescription, isTruncated } =
                truncateDescription(tool.description, tool.id);

              return (
                <Card
                  key={tool.id}
                  onClick={() => onToolClick?.(tool)}
                  className="mb-2 hover:bg-accent/50 transition-colors cursor-pointer border-border"
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-foreground truncate break-words">
                          {tool.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed break-words">
                          {displayDescription}
                        </p>

                        {/* See more/less button for long descriptions */}
                        {isLongDescription(tool.description) && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleToolExpansion(tool.id);
                            }}
                            className="mt-1 h-auto p-0 text-xs font-medium text-primary hover:text-primary/80"
                          >
                            {expandedTools.has(tool.id)
                              ? "See less"
                              : "See more"}
                          </Button>
                        )}
                      </div>
                      <Badge
                        className={`ml-2 flex-shrink-0 ${getMethodColor(
                          tool.method
                        )}`}
                      >
                        {tool.method}
                      </Badge>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground break-all flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">
                          Path:
                        </span>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
                          {tool.path}
                        </code>
                      </div>
                      {/* Show path parameters if they exist */}
                      {tool.path.match(/\{([^}]+)\}/g) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tool.path
                            .match(/\{([^}]+)\}/g)
                            ?.map((param: string, index: number) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="px-1.5 py-0.5 bg-red-100 text-red-700 border-red-200 text-xs font-medium"
                              >
                                {param.replace(/[{}]/g, "")}
                              </Badge>
                            ))}
                        </div>
                      )}
                    </div>

                    {tool.tags && tool.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tool.tags.slice(0, 3).map((tag, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs break-words"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {tool.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{tool.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
