/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATABASE_URL: string;
  readonly VITE_ANALYSES_REPO: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
