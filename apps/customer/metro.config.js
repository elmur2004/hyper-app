// Metro config for the pnpm monorepo: watch the workspace root so `@hyper/shared` resolves,
// and look in both the app's and the root node_modules (hoisted layout — see root .npmrc).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// `@hyper/shared` ships an exports map (import/require conditions); let Metro honour it.
config.resolver.unstable_enablePackageExports = true;

// The monorepo has several nested react copies in the watched tree. Pin react/react-native
// to ONE instance so no hoisted lib (e.g. zustand) binds a second React → "invalid hook call".
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
};

module.exports = config;
