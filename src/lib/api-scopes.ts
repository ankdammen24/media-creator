export type ApiScope =
  | "read:catalog"
  | "write:submissions"
  | "write:albums"
  | "read:audio:web"
  | "read:audio:master"
  | "read:stats"
  | "admin:moderate"
  | "admin:keys";

export const ALL_SCOPES: ApiScope[] = [
  "read:catalog",
  "write:submissions",
  "write:albums",
  "read:audio:web",
  "read:audio:master",
  "read:stats",
  "admin:moderate",
  "admin:keys",
];

export const USER_ALLOWED_SCOPES: ApiScope[] = [
  "read:catalog",
  "write:submissions",
  "write:albums",
  "read:audio:web",
  "read:stats",
];