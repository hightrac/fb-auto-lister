const path = require('path');

module.exports = {
  entry: {
    popup: './src/popup.tsx',
    background: './src/background.js',
    content: './src/content.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  module: {
    rules: [{ test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ }]
  },
  resolve: { extensions: ['.tsx', '.ts', '.js'] }
};
