import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Serve a simple health check for CORS preflight
if (import.meta.main && Deno.env.get("DENO_DEPLOYMENT_ID") === undefined) {
  console.log("Hello from Functions!");
}

export async function tallyFinalResults(req: Request): Promise<Response> {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Get request body
    const { election_id, encryption_key } = await req.json();
    if (!election_id) {
      return new Response(
        JSON.stringify({ error: "Missing election_id parameter" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Fetch all encrypted ballots for this election
    const { data: ballots, error: ballotsError } = await supabase
      .from("encrypted_ballots")
      .select("*")
      .eq("election_id", election_id);

    if (ballotsError) {
      throw new Error(`Failed to fetch ballots: ${ballotsError.message}`);
    }

    if (!ballots || ballots.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          election_id,
          total_ballots_cast: 0,
          candidate_tallies: [],
          verification: {
            ballot_count: 0,
            audit_log_count: 0,
            count_match: true,
            vote_stuffing_detected: false,
          },
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Fetch audit logs to verify ballot count
    const { data: auditLogs, error: auditError } = await supabase
      .from("voter_audit_logs")
      .select("*")
      .eq("election_id", election_id)
      .eq("event_type", "vote_cast");

    if (auditError) {
      throw new Error(`Failed to fetch audit logs: ${auditError.message}`);
    }

    const ballot_count = ballots.length;
    const audit_count = auditLogs?.length || 0;
    const count_match = ballot_count === audit_count;

    if (!count_match) {
      console.warn(
        `Vote stuffing detected! Ballot count (${ballot_count}) != Audit log count (${audit_count})`
      );
    }

    // Fetch candidates for position mapping
    const { data: candidates, error: candidatesError } = await supabase
      .from("candidates")
      .select("*")
      .eq("election_id", election_id);

    if (candidatesError) {
      throw new Error(
        `Failed to fetch candidates: ${candidatesError.message}`
      );
    }

    // Decrypt and tally votes
    // NOTE: This is a simplified decryption - you need to implement actual decryption
    // based on your encryption algorithm (likely AES-256-GCM or similar)
    const tallyByCandidate: Record<string, Record<string, number>> = {};

    for (const ballot of ballots) {
      try {
        // Placeholder: In production, decrypt ballot.encrypted_payload using encryption_key
        // For now, assume encrypted_payload contains JSON stringified votes: [{candidate_id, position}, ...]
        // IMPLEMENT ACTUAL DECRYPTION HERE based on your cipher setup
        let votes = [];
        try {
          votes = JSON.parse(atob(ballot.encrypted_payload)); // Base64 decode for demo
        } catch {
          console.warn(`Failed to parse ballot ${ballot.id}, skipping`);
          continue;
        }

        // Group votes by position
        for (const vote of votes) {
          const { candidate_id, position } = vote;
          if (!candidate_id || !position) continue;

          if (!tallyByCandidate[position]) {
            tallyByCandidate[position] = {};
          }
          if (!tallyByCandidate[position][candidate_id]) {
            tallyByCandidate[position][candidate_id] = 0;
          }
          tallyByCandidate[position][candidate_id]++;
        }
      } catch (err) {
        console.warn(
          `Error processing ballot ${ballot.id}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        continue;
      }
    }

    // Convert tally to candidate-focused format
    const candidateTallies = [];
    for (const candidate of candidates || []) {
      const position = candidate.position;
      const candidateId = candidate.id;
      const votes = tallyByCandidate[position]?.[candidateId] || 0;

      candidateTallies.push({
        candidate_id: candidateId,
        candidate_name: candidate.full_name,
        position: position,
        votes: votes,
      });
    }

    // Sort by position and votes descending
    candidateTallies.sort((a, b) => {
      if (a.position !== b.position) {
        return a.position.localeCompare(b.position);
      }
      return b.votes - a.votes;
    });

    return new Response(
      JSON.stringify({
        success: true,
        election_id,
        total_ballots_cast: ballot_count,
        candidate_tallies: candidateTallies,
        verification: {
          ballot_count,
          audit_log_count: audit_count,
          count_match,
          vote_stuffing_detected: !count_match,
        },
        tallied_at: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in tally-final-results:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Deno Deploy / Supabase Edge Function entry point
Deno.serve(tallyFinalResults);
