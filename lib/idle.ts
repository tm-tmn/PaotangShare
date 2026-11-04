// Shared by the server (session check) and the browser (auto-lock). Keep free of Node-only imports.
export const IDLE_MS = 5 * 60 * 1000; // ask for the PIN again after this long without use
export const ACTIVE_KEY = "pt-last-active";
