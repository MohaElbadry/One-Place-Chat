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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  const getCategoryFromPath = (path: string) => {
    const segments = path.split('/').filter(Boolean);
    return segments.length > 0 ? segments[0] : 'other';
  };

  const categories = ['all', ...Array.from(new Set(tools.map(tool => getCategoryFromPath(tool.path))))];

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tool.path.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || getCategoryFromPath(tool.path) === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'pet':
        return <span className="text-gray-600">Code</span>;
      case 'weather':
        return <span className="text-gray-600">Globe</span>;
      case 'httpbin':
        return <span className="text-gray-600">Zap</span>;
      default:
        return <span className="text-gray-600">Code</span>;
    }
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

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                selectedCategory === category
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {getCategoryIcon(category)}
              {category === 'all' ? 'All' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4">
          {filteredTools.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <span className="w-8 h-8 mx-auto mb-2 text-gray-300">🔍</span>
              <p className="text-sm">No tools found</p>
              <p className="text-xs text-gray-400">Try adjusting your search or category filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTools.map((tool) => (
                <div
                  key={tool.id}
                  className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm">{tool.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getMethodColor(tool.method)}`}>
                      {tool.method}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-600 mb-2">{tool.description}</p>
                  
                  <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                    {tool.path}
                  </div>
                  
                  {/* The inputSchema property is removed from the Tool interface, so this block is removed */}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          <p>{filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''} available</p>
          <p className="mt-1">Powered by OpenAPI & ChromaDB</p>
        </div>
      </div>
    </div>
  );
}
