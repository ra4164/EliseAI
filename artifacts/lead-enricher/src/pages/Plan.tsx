import React from "react";
import { Link } from "wouter";

export default function Plan() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8 pb-24">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Rollout Plan</h1>
        <p className="text-xl text-muted-foreground font-serif italic">EliseAI Lead Enricher</p>
      </div>

      <div className="prose prose-slate dark:prose-invert max-w-none">
        <p className="lead font-medium text-lg border-l-4 border-primary pl-4 py-1 bg-primary/5 dark:bg-primary/10 rounded-r">
          <strong>Goal:</strong> Cut SDR time-per-lead from ~20 minutes of manual research to under 2 minutes of review-and-send.
        </p>

        <h3>Phase 1 — MVP Validation (Week 1-2)</h3>
        <ul>
          <li>Internal dogfood with 2 senior SDRs and the SDR manager.</li>
          <li>Run on a held-out backlog of 50 historical inbound leads. Compare:
            <ul>
              <li>Time spent per lead (baseline vs. tool-assisted).</li>
              <li>Reply rate of the AI-drafted outreach vs. the SDR's hand-written outreach (A/B blind test).</li>
              <li>Subjective rating (1-5) of insight quality and email quality.</li>
            </ul>
          </li>
          <li><strong>Acceptance criteria:</strong> median time per lead &lt;= 5 min; reply rate parity or better; insight quality &gt;= 4/5.</li>
          <li><strong>Stakeholders:</strong> SDR Manager, Head of Sales, Sales Ops, two pilot SDRs.</li>
        </ul>

        <h3>Phase 2 — Pilot (Week 3-5)</h3>
        <ul>
          <li>Roll out to the full SDR team (~8 reps) for new inbound leads only. Existing pipeline stays manual.</li>
          <li>Add a feedback widget on the lead detail page (thumbs up/down on the email + insights) and review weekly.</li>
          <li>Track: lead-to-meeting conversion, response rate, time-to-first-touch, SDR NPS on the tool.</li>
          <li><strong>Stakeholders:</strong> full SDR team, RevOps for CRM-side metrics, Sales Engineering for feedback triage.</li>
        </ul>

        <h3>Phase 3 — Production Rollout (Week 6-8)</h3>
        <ul>
          <li>Connect to CRM (HubSpot or Salesforce) so new inbound leads auto-populate, and outreach drafts sync back as suggested first-touch emails (not auto-sent).</li>
          <li>Schedule a daily 9am job that enriches all leads created in the last 24h (cron in the API server). Surface the daily report to SDRs in Slack.</li>
          <li>Open access to AEs as a read-only research view.</li>
          <li>Document score methodology and update the scoring rubric quarterly with input from RevOps.</li>
        </ul>

        <hr />

        <h3>Stakeholders Map</h3>
        <ul>
          <li><strong>Executive Sponsor:</strong> VP of Sales — owns the go/no-go.</li>
          <li><strong>Daily Owner:</strong> SDR Manager — owns adoption and feedback loop.</li>
          <li><strong>Build Owner:</strong> Sales Ops + AI Eng — owns reliability, scoring rubric, model upgrades.</li>
          <li><strong>Reviewers:</strong> Marketing (brand voice in emails), Compliance (data sourcing), RevOps (CRM integration).</li>
        </ul>

        <h3>Risks &amp; Mitigations</h3>
        <ul>
          <li><strong>Risk:</strong> AI emails sound generic.<br/><strong>Mitigation:</strong> keep human-in-the-loop for first 90 days; reps must edit/approve before send.</li>
          <li><strong>Risk:</strong> API rate limits or outages.<br/><strong>Mitigation:</strong> cache responses, exponential backoff, graceful "data unavailable" states.</li>
          <li><strong>Risk:</strong> Bad scores erode trust.<br/><strong>Mitigation:</strong> show score reasons inline; let reps mark a lead as "miscategorized" to feed retraining.</li>
        </ul>

        <hr />

        <h3>Scoring Methodology <span className="text-sm font-normal text-muted-foreground">(documented assumptions)</span></h3>
        <p>
          EliseAI sells to multifamily property managers, so good leads correlate with: dense urban locations (high WalkScore + transit), high-rent metros (Census median gross rent), large addressable population, and recent company news indicating growth, expansion, hiring, or new property acquisitions.
        </p>
        <ul>
          <li><strong>Higher score weight goes to:</strong> walkability &gt;= 70, median household income &gt; $75k, total population &gt; 50k in the place, recent positive news in last 90 days mentioning expansion/acquisition/hiring.</li>
          <li><strong>Lower score for:</strong> rural addresses (low WalkScore), missing news coverage, very small place population.</li>
        </ul>
      </div>
    </div>
  );
}
