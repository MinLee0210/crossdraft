/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // static site: no server needed, deploy the `out/` folder anywhere
  reactStrictMode: true
};
export default nextConfig;
