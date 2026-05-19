import 'telegraf';

declare module 'telegraf' {
  interface Context {
    /** Populated by core/middleware/rbac.ts. */
    state: {
      roles?: string[];
    };
    /**
     * Populated by core/sessions.ts. Use these instead of ctx.session.* directly.
     * The `__scenes` slot is owned by telegraf Scenes — declared here so our
     * custom session shape stays assignment-compatible with `Scenes.SceneSession`.
     */
    session: {
      user?: Record<string, unknown>;
      chat?: Record<string, unknown>;
      scene?: Record<string, unknown>;
      polls?: Record<string, unknown>;
      __scenes?: {
        current?: string;
        expires?: number;
        state?: object;
      };
    };
  }
}

export {};
