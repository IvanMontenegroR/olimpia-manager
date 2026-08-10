/** @type {import('next').NextConfig} */

// En GitHub Pages el sitio se sirve desde /<repo>/, no desde la raíz.
// PAGES=1 lo activa en el workflow; en local queda en la raíz.
const enPages = process.env.PAGES === "1";
const repo = "/olimpia-manager";

export default {
  output: "export",
  basePath: enPages ? repo : "",
  assetPrefix: enPages ? repo : "",
  images: { unoptimized: true },
  devIndicators: false,
};
