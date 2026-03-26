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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get submission ID from request
    const { submission_id, action } = await req.json();
    if (!submission_id || !action) {
      return new Response(JSON.stringify({ error: "submission_id and action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the submission
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      await supabase.from("submissions").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", submission_id);
      return new Response(JSON.stringify({ success: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      // Forward to MediaMaxxing API
      const apiKey = Deno.env.get("MEDIAMAXXING_API_KEY");
      const mmRes = await fetch("https://api.mediamaxxing.com/api/v1/submissions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign_id: submission.campaign_id,
          content_url: submission.content_url,
          external_username: submission.external_username,
        }),
      });

      const mmData = await mmRes.json();

      if (!mmRes.ok) {
        // If duplicate on MediaMaxxing side, still approve locally
        if (mmRes.status === 409) {
          await supabase.from("submissions").update({
            status: "approved",
            updated_at: new Date().toISOString(),
          }).eq("id", submission_id);

          return new Response(JSON.stringify({ success: true, status: "approved", note: "Already exists on MediaMaxxing" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ error: mmData.error || "MediaMaxxing API error", status: mmRes.status }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update local submission with MediaMaxxing ID
      await supabase.from("submissions").update({
        status: "approved",
        mediamaxxing_id: mmData.data?.id,
        platform: mmData.data?.platform,
        updated_at: new Date().toISOString(),
      }).eq("id", submission_id);

      return new Response(JSON.stringify({ success: true, status: "approved", mediamaxxing: mmData.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'approve' or 'reject'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
