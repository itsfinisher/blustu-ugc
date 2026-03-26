import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read query params
    const url = new URL(req.url);
    const external_username = url.searchParams.get("external_username");
    if (!external_username) {
      return new Response(
        JSON.stringify({ error: "external_username query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build proxy URL with params
    const proxyUrl = new URL("https://api.mediamaxxing.com/api/v1/submissions");
    proxyUrl.searchParams.set("external_username", external_username);

    const campaign_id = url.searchParams.get("campaign_id");
    const status = url.searchParams.get("status");
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");

    if (campaign_id) proxyUrl.searchParams.set("campaign_id", campaign_id);
    if (status) proxyUrl.searchParams.set("status", status);
    if (limit) proxyUrl.searchParams.set("limit", limit);
    if (offset) proxyUrl.searchParams.set("offset", offset);

    // Proxy to MediaMaxxing
    const apiKey = Deno.env.get("MEDIAMAXXING_API_KEY");
    const res = await fetch(proxyUrl.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
