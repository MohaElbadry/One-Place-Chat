'use client';

import React, { useState } from 'react';

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
}

export default function ToolsPanel({ tools }: ToolsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-green-100 text-green-800';
      case 'POST':
        return 'bg-blue-100 text-blue-800';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.path.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const toggleToolExpansion = (toolId: string) => {
    setExpandedTools(prev => {
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

    const truncatedDescription = description.substring(0, 150) + '...';
    return { description: truncatedDescription, isTruncated: true };
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Available Tools</h2>
        
        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredTools.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <span className="w-8 h-8 mx-auto mb-2 text-gray-300">🔧</span>
            <p className="text-sm">No tools found</p>
            <p className="text-xs text-gray-400">Try adjusting your search</p>
          </div>
        ) : (
          <div className="p-2">
            {filteredTools.map((tool) => {
              const { description: displayDescription, isTruncated } = truncateDescription(tool.description, tool.id);
              
              return (
                <div
                  key={tool.id}
                  className="p-3 rounded-lg border border-gray-200 mb-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate break-words">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 break-words">
                        {displayDescription}
                      </p>
                      
                      {/* See more/less button for long descriptions */}
                      {isLongDescription(tool.description) && (
                        <button
                          onClick={() => toggleToolExpansion(tool.id)}
                          className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {expandedTools.has(tool.id) ? 'See less' : 'See more'}
                        </button>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getMethodColor(tool.method)} flex-shrink-0 ml-2`}>
                      {tool.method}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500 break-all">
                    <span className="font-mono">{tool.path}</span>
                  </div>
                  
                  {tool.tags && tool.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tool.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs break-words"
                        >
                          {tag}
                        </span>
                      ))}
                      {tool.tags.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          +{tool.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
