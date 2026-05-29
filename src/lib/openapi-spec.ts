export const openapiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Catalogus Musicus API",
    version: "1.0.0",
    description:
      "Public read API for the approved catalog, and authenticated v1 API for submissions, audio, stats and admin moderation.",
  },
  servers: [{ url: "/", description: "Current host" }],
  tags: [
    { name: "Public", description: "Open endpoints, no auth required" },
    { name: "Submissions", description: "Tracks/episodes (write requires write:submissions)" },
    { name: "Albums", description: "Releases (write requires write:albums)" },
    { name: "Audio", description: "Signed URLs for audio files" },
    { name: "Stats", description: "Playback / spin data" },
    { name: "Admin", description: "Moderation endpoints" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "cm_live_*",
        description:
          "API key issued from Settings → API keys. Send as `Authorization: Bearer cm_live_...`",
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/public/tracks": {
      get: {
        tags: ["Public"], security: [],
        summary: "List approved tracks",
        parameters: [
          { name: "artist", in: "query", schema: { type: "string" } },
          { name: "album", in: "query", schema: { type: "string" } },
          { name: "media_type", in: "query", schema: { type: "string", enum: ["music", "podcast"] } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/public/tracks/{id}": {
      get: {
        tags: ["Public"], security: [],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/api/public/artists": {
      get: { tags: ["Public"], security: [], summary: "List artists", responses: { "200": { description: "OK" } } },
    },
    "/api/public/artists/{id}": {
      get: {
        tags: ["Public"], security: [], summary: "Artist with discography",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/public/albums": { get: { tags: ["Public"], security: [], responses: { "200": { description: "OK" } } } },
    "/api/public/albums/{id}": {
      get: {
        tags: ["Public"], security: [], summary: "Album with tracks",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/public/podcasts": { get: { tags: ["Public"], security: [], responses: { "200": { description: "OK" } } } },
    "/api/public/episodes/{id}": {
      get: {
        tags: ["Public"], security: [],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/submissions": {
      get: { tags: ["Submissions"], summary: "List submissions (scoped to key owner for user keys)", responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } } },
      post: {
        tags: ["Submissions"], summary: "Create submission (scope: write:submissions)",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["artist_profile_id", "title", "media_type", "audio_path", "artwork_path"] } } } },
        responses: { "201": { description: "Created" }, "401": { description: "Unauthorized" }, "403": { description: "Forbidden" } },
      },
    },
    "/api/v1/submissions/{id}": {
      get: { tags: ["Submissions"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
      patch: { tags: ["Submissions"], summary: "Update pending/rejected submission (scope: write:submissions)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
    },
    "/api/v1/albums": {
      get: { tags: ["Albums"], responses: { "200": { description: "OK" } } },
      post: { tags: ["Albums"], summary: "Create album (scope: write:albums)", responses: { "201": { description: "Created" } } },
    },
    "/api/v1/audio/{id}": {
      get: {
        tags: ["Audio"], summary: "Signed audio URL (5 min) — scope: read:audio:web or read:audio:master",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "variant", in: "query", schema: { type: "string", enum: ["web", "master"], default: "web" } },
        ],
        responses: { "200": { description: "Signed URL" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/stats/spins": {
      get: {
        tags: ["Stats"], summary: "Playback events (scope: read:stats)",
        parameters: [
          { name: "submission", in: "query", schema: { type: "string" } },
          { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 1000, default: 200 } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/admin/moderation": {
      get: { tags: ["Admin"], summary: "Pending submissions queue (scope: admin:moderate)", responses: { "200": { description: "OK" } } },
      patch: { tags: ["Admin"], summary: "Approve or reject a submission (scope: admin:moderate)", responses: { "200": { description: "OK" } } },
    },
  },
} as const;
