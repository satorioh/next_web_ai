export const SITE_TITLE = "Next Web ML";
export const BACKEND_URL_PREFIX = process.env.NEXT_PUBLIC_BACKEND_URL_PREFIX;
export const S3_SIG_BUCKET = process.env.NEXT_PUBLIC_S3_SIG_BUCKET;
export const MP_VERSION = "0.10.14"
export const WASM_PATH = `${S3_SIG_BUCKET}/tflite/wasm/${MP_VERSION}`;
export const STUN_SERVER = process.env.NEXT_PUBLIC_STUN_SERVER;
