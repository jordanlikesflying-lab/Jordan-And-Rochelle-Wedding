import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const pexelsKey = Deno.env.get("PEXELS_API_KEY");
    const authorization = req.headers.get("Authorization") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Supabase function environment is incomplete." }, 500);
    }
    if (!pexelsKey) return json({ error: "PEXELS_API_KEY is not configured." }, 500);
    if (!authorization) return json({ error: "Sign in to the Command Center first." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Your admin session is not valid." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: adminRow, error: adminError } = await adminClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!adminRow) return json({ error: "Administrator access required." }, 403);

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query || "").trim().slice(0, 120);
    if (!query) return json({ error: "Enter something to search for." }, 400);

    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "12");
    url.searchParams.set("orientation", "landscape");

    const response = await fetch(url, {
      headers: { Authorization: pexelsKey },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Pexels search failed", response.status, text);
      if (response.status === 429) return json({ error: "The photo-search limit has been reached. Try again later." }, 429);
      return json({ error: "Photo search is unavailable right now." }, 502);
    }

    const result = await response.json();
    const photos = Array.isArray(result?.photos)
      ? result.photos.map((photo: any) => ({
          id: photo.id,
          image: photo?.src?.large || photo?.src?.medium || photo?.src?.original || "",
          thumb: photo?.src?.medium || photo?.src?.small || photo?.src?.large || "",
          alt: photo?.alt || "",
          photographer: photo?.photographer || "",
          photographer_url: photo?.photographer_url || "",
          pexels_url: photo?.url || "",
        })).filter((photo: any) => photo.image)
      : [];

    return json({ photos });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Photo search failed." }, 500);
  }
});
