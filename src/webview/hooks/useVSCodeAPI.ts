import { useRef } from "react";

interface VSCodeAPI {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

/**
 * Acquires and caches the VS Code webview API handle.
 * Safe to call multiple times — returns the same instance.
 */
export function useVSCodeAPI(): VSCodeAPI {
  const ref = useRef<VSCodeAPI | null>(null);

  if (!ref.current) {
    // acquireVsCodeApi is injected by VS Code into the webview global scope
    const acquire = (globalThis as any).acquireVsCodeApi;
    ref.current = acquire
      ? acquire()
      : {
          postMessage: (msg: unknown) =>
            console.warn("[wai] VS Code API unavailable; message dropped:", msg),
          getState: () => ({}),
          setState: () => {},
        };
  }

  return ref.current!;
}
