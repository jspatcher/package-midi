const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

/** @type {import('webpack').Configuration} */
const config = {
  entry: {
    index: './src/index.ts',
    "index.jspatpkg": './src/index.jspatpkg.ts'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  node: {
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: "",
    libraryTarget: 'commonjs',
    chunkFilename: 'js/[chunkhash].js'
  },
  module: {
    rules: [{
      test: /\.worklet\.(ts|js)$/,
      use: [{
        loader: 'worklet-loader',
        options: {
          inline: true
        }
      }],
      exclude: /node_modules/
    }, {
      test: /\.(ts|js)x?$/,
      use: {
        loader: 'esbuild-loader',
        options: {
          loader: 'tsx',
          target: 'es2017'
        }
      },
      exclude: /node_modules/
    }]
  },
  plugins: [
    new CleanWebpackPlugin()
  ],
  // watch: true,
  watchOptions: {
    ignored: /node_modules/
  }
};
module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    config.devtool = 'source-map';
    config.output.filename = '[name].js';
  }
  if (argv.mode === 'production') {
    config.devtool = 'source-map';
    config.output.filename = '[name].js';
  }
  return config;
};