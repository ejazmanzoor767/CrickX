const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// This monorepo contains React 18.3.1 is shared by the Expo app and web app. Force Metro to use one React instance in the native app
// so React hooks share the same dispatcher.
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules || {}),
    react: path.resolve(__dirname, '../../node_modules/react'),
  },
};

module.exports = config;
