const path = require('path');
const webpack = require('webpack');

const buildPath = path.resolve(__dirname, 'dist');

const client = {
  entry: './src/client/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({ 'global.GENTLY': false }),
  ],
  optimization: {
    minimize: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@server': path.resolve(__dirname, 'src/server'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  output: {
    filename: 'client/[name].js',
    path: buildPath,
  },
  target: 'web',
};

const server = {
  entry: './src/server/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({ 'global.GENTLY': false }),
  ],
  optimization: {
    minimize: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@server': path.resolve(__dirname, 'src/server'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  output: {
    filename: 'server/[name].js',
    path: buildPath,
  },
  target: 'node',
};

const shared = {
  entry: './src/shared/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({ 'global.GENTLY': false }),
  ],
  optimization: {
    minimize: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@server': path.resolve(__dirname, 'src/server'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  output: {
    filename: 'shared/[name].js',
    path: buildPath,
  },
  target: 'web',
};

module.exports = [client, server, shared]; 