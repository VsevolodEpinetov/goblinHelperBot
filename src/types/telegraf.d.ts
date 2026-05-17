import 'telegraf';

declare module 'telegraf' {
  interface Context {
    // Populated by core/middleware/rbac.ts in a later plan.
    state: {
      roles?: string[];
    };
  }
}

export {};
