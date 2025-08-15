'use client';

import { useState } from 'react';

export default function ToolsPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mock data - will be replaced with real API calls
  const tools = [
    {
      name: 'Petstore API',
      status: 'active',
      endpoints: 12,
      methods: [
        { method: 'GET', path: '/pet', color: 'text-blue-400' },
        { method: 'POST', path: '/pet', color: 'text-green-400' },
        { method: 'PUT', path: '/pet', color: 'text-yellow-400' },
      ]
    },
    {
      name: 'Weather API',
      status: 'active',
      endpoints: 8,
      methods: [
        { method: 'GET', path: '/weather', color: 'text-blue-400' },
        { method: 'GET', path: '/forecast', color: 'text-blue-400' },
      ]
    }
  ];

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="w-64 bg-dark-800 border-l border-dark-600 p-4">
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input 
            type="text" 
            placeholder="Search tools..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* API Tools */}
      <div className="space-y-3">
        {filteredTools.map((tool, index) => (
          <div key={index} className="bg-dark-700 rounded-lg p-3 border border-dark-600">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 ${getStatusColor(tool.status)} rounded-full`}></div>
              <span className="text-sm font-medium">{tool.name}</span>
            </div>
            <p className="text-xs text-gray-400 mb-2">{tool.endpoints} endpoints available</p>
            <div className="space-y-1">
              {tool.methods.map((method, methodIndex) => (
                <div key={methodIndex} className={`text-xs ${method.color}`}>
                  {method.method} {method.path}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
