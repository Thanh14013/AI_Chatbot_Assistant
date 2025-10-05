// Ensure Vite's import.meta.env types are available to TypeScript
/// <reference types="vite/client" />

// Ambient declarations for process.env variables used in the client
// Keeps TypeScript happy when accessing process.env.VITE_* variables

/* eslint-disable @typescript-eslint/no-unused-vars */
declare namespace NodeJS {
  interface ProcessEnv {
    VITE_API_BASE_URL?: string;
    VITE_BACKEND_URL?: string;
    VITE_API_TIMEOUT_MS?: string;
    VITE_ACCESS_TOKEN_EXPIRY_MS?: string;
    VITE_REFRESH_TOKEN_EXPIRY_MS?: string;
    NODE_ENV?: "development" | "production" | "test" | string;
  }
}

export {};
