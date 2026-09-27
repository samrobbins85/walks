/**
 * Cloudflare Worker for the walks site.
 *
 * Serves the static Astro build (via the ASSETS binding) and exposes a single
 * authenticated upload endpoint that writes walk photos to R2:
 *
 *   PUT /api/upload/<slug>/<filename>
 *     Authorization: Bearer <github-token>
 *     Content-Type:  image/webp
 *     x-meta-width / x-meta-height / x-meta-cover
 *
 * The R2 bucket is bound to the Worker (env.BUCKET), so no R2 access key or
 * secret exists on the client or in this code. Uploads are gated by verifying
 * the caller's GitHub token via the OAuth app's token-check endpoint, which
 * only accepts tokens minted by THIS app (client ID + secret), and that the
 * token's user is the allowed account. A token for the same user issued to
 * any other OAuth app is rejected.
 */

interface Env {
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  ALLOWED_GH_LOGIN: string;
  GITHUB_CLIENT_ID: string;
  // Set via `wrangler secret put` / dashboard, never in wrangler.jsonc.
  GITHUB_CLIENT_SECRET: string;
}

const UPLOAD_PREFIX = "/api/upload/";

// One path segment for the walk slug, one for the filename, .webp only.
const KEY_PATTERN = /^[A-Za-z0-9-]+\/[^/]+\.webp$/;

// Returns null when the token is valid for this app and the allowed user;
// otherwise a short reason safe to expose to the caller (no secrets).
async function checkAuth(token: string, env: Env): Promise<string | null> {
  if (!token) return "no token";
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return "worker missing GitHub app credentials";
  }
  // https://docs.github.com/en/rest/apps/oauth-applications#check-a-token
  // Authenticated with the app's own credentials, this 404s for any token
  // that wasn't issued to this OAuth app — unlike /user, which accepts a
  // token from any app the account ever authorized.
  const res = await fetch(
    `https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        // GitHub's API rejects requests without a User-Agent.
        "User-Agent": "walks-upload-broker",
      },
      body: JSON.stringify({ access_token: token }),
    },
  );
  // 401 = our client id/secret pair is wrong; 404 = token not minted by
  // this OAuth app (or revoked/expired).
  if (res.status === 401) return "app credentials rejected by GitHub";
  if (res.status === 404) return "token not issued by this app";
  if (!res.ok) return `token check failed (github ${res.status})`;
  const check = (await res.json()) as { user?: { login?: string } };
  if (check.user?.login?.toLowerCase() !== env.ALLOWED_GH_LOGIN.toLowerCase()) {
    return "user not allowed";
  }
  return null;
}

async function handleUpload(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  if (request.method !== "PUT") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const token = (request.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const authError = await checkAuth(token, env);
  if (authError) {
    return new Response(`Unauthorized: ${authError}`, { status: 401 });
  }

  if (request.headers.get("Content-Type") !== "image/webp") {
    return new Response("Only image/webp uploads are accepted", {
      status: 415,
    });
  }

  let key: string;
  try {
    key = decodeURIComponent(url.pathname.slice(UPLOAD_PREFIX.length));
  } catch {
    return new Response("Invalid object key", { status: 400 });
  }
  if (!KEY_PATTERN.test(key)) {
    return new Response("Invalid object key", { status: 400 });
  }

  const customMetadata: Record<string, string> = {};
  for (const field of ["width", "height", "cover"] as const) {
    const value = request.headers.get(`x-meta-${field}`);
    if (value !== null) customMetadata[field] = value;
  }

  const body = await request.arrayBuffer();
  await env.BUCKET.put(key, body, {
    httpMetadata: { contentType: "image/webp" },
    customMetadata,
  });

  return Response.json({ ok: true, key });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith(UPLOAD_PREFIX)) {
      return handleUpload(request, env, url);
    }
    // Everything else is the static site.
    return env.ASSETS.fetch(request);
  },
};
