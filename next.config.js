const { join } = require("path");

/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig = {
  reactStrictMode: false,
  sassOptions: {
    includePaths: [join(__dirname, "styles")],
  },
};

module.exports = withBundleAnalyzer(nextConfig);
