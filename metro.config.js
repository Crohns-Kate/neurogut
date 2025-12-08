// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Custom resolver to handle @expo/metro-runtime/rsc/runtime
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, realModuleName, platform, moduleName) => {
  // Handle the RSC runtime import
  if (realModuleName === '@expo/metro-runtime/rsc/runtime') {
    const rscRuntimePath = path.resolve(
      __dirname,
      'node_modules/@expo/metro-runtime/rsc/runtime.js'
    );
    
    // Verify the file exists
    if (fs.existsSync(rscRuntimePath)) {
      return {
        filePath: rscRuntimePath,
        type: 'sourceFile',
      };
    }
  }
  
  // Use default resolution for other modules
  if (originalResolveRequest) {
    return originalResolveRequest(context, realModuleName, platform, moduleName);
  }
  
  // Fallback to default Metro resolver
  return context.resolveRequest(context, realModuleName, platform, moduleName);
};

module.exports = config;
