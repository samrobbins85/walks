import { computeRoutePlan, type PlanRequest } from "./planner";

interface Env {
  ASSETS: { fetch: typeof fetch };
  GOOGLE_MAPS_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/plan" && request.method === "POST") {
      return handlePlanRequest(request, env);
    }

    // Serve static assets for everything else
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handlePlanRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const body = (await request.json()) as PlanRequest;

    if (!body.date || !body.walkDuration || !body.startCoords || !body.endCoords) {
      return Response.json(
        { error: "Missing required fields: date, walkDuration, startCoords, endCoords" },
        { status: 400 },
      );
    }

    const plan = await computeRoutePlan(body, {
      GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY,
    });

    return Response.json(plan);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
