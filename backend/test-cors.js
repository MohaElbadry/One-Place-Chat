#!/usr/bin/env node

import http from 'http';

// Test CORS configuration
const testCors = () => {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/health',
    method: 'GET',
    headers: {
      'Origin': 'http://frontend:3000',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type'
    }
  };

  console.log('🧪 Testing CORS configuration...');
  console.log('📡 Making request with Origin: http://frontend:3000');

  const req = http.request(options, (res) => {
    console.log(`✅ Response Status: ${res.statusCode}`);
    console.log('📋 CORS Headers:');
    console.log(`   Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin'] || 'Not set'}`);
    console.log(`   Access-Control-Allow-Credentials: ${res.headers['access-control-allow-credentials'] || 'Not set'}`);
    console.log(`   Access-Control-Allow-Methods: ${res.headers['access-control-allow-methods'] || 'Not set'}`);
    console.log(`   Access-Control-Allow-Headers: ${res.headers['access-control-allow-headers'] || 'Not set'}`);
    
    if (res.statusCode === 200) {
      console.log('🎉 CORS test passed!');
    } else {
      console.log('❌ CORS test failed!');
    }
  });

  req.on('error', (err) => {
    console.log('❌ Request failed:', err.message);
    console.log('💡 Make sure the backend server is running on port 3001');
  });

  req.end();
};

// Test OPTIONS preflight request
const testPreflight = () => {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/health',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://frontend:3000',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type'
    }
  };

  console.log('\n🧪 Testing CORS preflight request...');

  const req = http.request(options, (res) => {
    console.log(`✅ Preflight Status: ${res.statusCode}`);
    console.log('📋 Preflight Headers:');
    console.log(`   Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin'] || 'Not set'}`);
    console.log(`   Access-Control-Allow-Credentials: ${res.headers['access-control-allow-credentials'] || 'Not set'}`);
    console.log(`   Access-Control-Allow-Methods: ${res.headers['access-control-allow-methods'] || 'Not set'}`);
    console.log(`   Access-Control-Allow-Headers: ${res.headers['access-control-allow-headers'] || 'Not set'}`);
    
    if (res.statusCode === 204) {
      console.log('🎉 CORS preflight test passed!');
    } else {
      console.log('❌ CORS preflight test failed!');
    }
  });

  req.on('error', (err) => {
    console.log('❌ Preflight request failed:', err.message);
  });

  req.end();
};

// Run tests
testCors();
setTimeout(testPreflight, 1000);
