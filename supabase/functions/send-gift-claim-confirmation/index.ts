import { withSupabase } from "npm:@supabase/server@^1";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c] ?? c));
}
async function hashToken(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { claim_token } = await req.json();
      if (!claim_token) return Response.json({ error:"Missing claim token." }, { status:400 });

      const tokenHash = await hashToken(claim_token);
      const { data: claim, error } = await ctx.supabaseAdmin
        .from("registry_claims").select("*").eq("token_hash", tokenHash).maybeSingle();
      if (error) throw error;
      if (!claim) return Response.json({ error:"Gift claim not found." }, { status:404 });
      if (claim.released_at) return Response.json({ ok:true, skipped:"released" });
      if (!claim.claimant_email) return Response.json({ ok:true, skipped:"no_email" });
      if (claim.email_sent_at) return Response.json({ ok:true, skipped:"already_sent" });

      const created = new Date(claim.created_at).getTime();
      if (!Number.isFinite(created) || Date.now() - created > 30 * 60 * 1000) {
        return Response.json({ error:"This gift claim is too old for an automatic confirmation." }, { status:409 });
      }

      const { data: gift, error: giftError } = await ctx.supabaseAdmin
        .from("registry_items").select("title").eq("id", claim.registry_item_id).maybeSingle();
      if (giftError) throw giftError;

      const resendKey = Deno.env.get("RESEND_API_KEY");
      const emailFrom = Deno.env.get("EMAIL_FROM");
      const replyTo = Deno.env.get("EMAIL_REPLY_TO");
      const siteUrl = (Deno.env.get("SITE_URL") || "https://jordanandrochellewedding.netlify.app").replace(/\/+$/,"");
      if (!resendKey || !emailFrom) throw new Error("Email secrets are not configured.");

      const releaseUrl = `${siteUrl}/gift-release.html?token=${encodeURIComponent(claim_token)}`;
      const payload: Record<string, unknown> = {
        from: emailFrom,
        to: [claim.claimant_email],
        subject: `Gift reserved: ${gift?.title || "Jordan & Rochelle's wedding"}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;color:#312a27">
          <p style="text-transform:uppercase;letter-spacing:.12em;color:#8b6d61">Jordan &amp; Rochelle</p>
          <h1>Thank you, ${escapeHtml(claim.claimant_name)}!</h1>
          <p>You reserved <strong>${escapeHtml(gift?.title || "a wedding gift")}</strong> from our wedding gift list.</p>
          <p>You can purchase it wherever you prefer and bring it to the wedding.</p>
          <p>If your plans change, use this private link to make the gift available again:</p>
          <p style="margin:26px 0"><a href="${releaseUrl}" style="display:inline-block;background:#6e5045;color:white;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:bold">Release This Gift</a></p>
          <p style="font-size:13px;color:#756963">November 14, 2026 · Milbank, South Dakota</p>
        </div>`
      };
      if (replyTo) payload.reply_to = replyTo;

      const response = await fetch("https://api.resend.com/emails", {
        method:"POST",
        headers:{ Authorization:`Bearer ${resendKey}`, "Content-Type":"application/json" },
        body:JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.message || "Resend could not send the gift confirmation.");

      await ctx.supabaseAdmin.from("registry_claims")
        .update({ email_sent_at:new Date().toISOString() }).eq("id",claim.id);

      return Response.json({ ok:true });
    } catch (error) {
      console.error(error);
      return Response.json({ error:error instanceof Error ? error.message : "Could not send gift confirmation." }, { status:500 });
    }
  })
};