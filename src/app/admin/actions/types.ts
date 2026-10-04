/** Shape returned by every admin server action (used with useActionState). */
export interface ActionState {
  ok?: boolean;
  message?: string;
  fields?: Record<string, string>;
  /** One-time secret to show the admin (e.g. a generated temporary password). */
  secret?: string;
}

export const initialState: ActionState = {};
