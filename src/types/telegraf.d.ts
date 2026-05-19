import 'telegraf';

declare module 'telegraf' {
  interface Context {
    /** Populated by core/middleware/rbac.ts. */
    state: {
      roles?: string[];
    };
    /** Populated by core/sessions.ts. Use these instead of ctx.session.* directly. */
    session: {
      user?: Record<string, unknown>;
      chat?: Record<string, unknown>;
      scene?: Record<string, unknown>;
      polls?: Record<string, unknown>;
    };
  }
}

export {};
