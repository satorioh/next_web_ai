const isProd = process.env.NEXT_PUBLIC_ENV === "production";

export const SITE_TITLE = "Next Web ML";
export const BACKEND_URL_PREFIX = isProd
  ? "https://api.regulusai.top:2096/api/v1/webml/"
  : "http://0.0.0.0:8000/api/v1/webml/";
