/** @type {import('next').NextConfig} */
const nextConfig = {
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

    return config;
  },
};

export default nextConfig;
