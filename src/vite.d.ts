/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TARGET: "run" | "editor";
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module ".css" {
  const content: Record<string, string>;
  export default content;
}
