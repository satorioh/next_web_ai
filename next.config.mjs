// import TerserPlugin from 'terser-webpack-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverMinification: false,
  },
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.wasm$/i,
      type: "javascript/auto",
      use: [
        {
          loader: "file-loader",
        },
      ],
    });

    // if (!options.dev) {
    //   if (Array.isArray(config.optimization.minimizer)) {
    //     for (const plugin of config.optimization.minimizer) {
    //       console.log(plugin.toString());
    //     }
    //     config.optimization.minimizer.push(
    //       new TerserPlugin({
    //         terserOptions: {
    //           jsc: {
    //             minify: {
    //               compress: {
    //                 typeofs: false,
    //               },
    //             },
    //           },
    //         },
    //       }),
    //     );
    //   }
    // }

    return config;
  },
};

export default nextConfig;
