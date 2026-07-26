Generate a comprehensive, professional README.md for this project. This is 
a portfolio/interview project, so the README needs to clearly communicate 
both what the app does for a non-technical reader AND the engineering 
depth for a technical reader (recruiters, interviewers, other engineers).

Structure the README with these sections, in this order:

1. TITLE + ONE-LINE PITCH
   A short, punchy description of what the app does, in plain language 
   (e.g. "Signal is a real-time uptime monitor that watches your websites 
   and alerts you the moment something breaks").

2. OVERVIEW
   2-3 sentences explaining the problem this solves and who it's for, 
   written for someone with zero technical background.

3. KEY FEATURES
   A bulleted list of what the app actually does from a user's 
   perspective (add monitors, live dashboard, instant alerts, uptime 
   history, response time tracking) — no implementation details here, 
   just capabilities.

4. ARCHITECTURE / HOW IT WORKS
   Explain the actual system design in plain but accurate language:
   - How the polling engine works (concurrent scheduling, not one 
     interval per monitor)
   - How real-time updates reach the browser (WebSocket broadcast, not 
     polling from the frontend)
   - How anomaly/alert detection works (state-transition based DOWN/
     RECOVERED, rolling-average HIGH_LATENCY detection)
   - The SSRF protection layer and why it matters (server-side requests 
     to user-submitted URLs are a real security risk if unvalidated)
   Include a simple architecture diagram in ASCII or Mermaid syntax 
   showing: Frontend (React) <-> Backend (Express + WebSocket) <-> 
   Polling Engine <-> External URLs, and Backend <-> PostgreSQL.

5. TECH STACK
   A clear table: Layer | Technology | Why it was chosen (one short 
   reason per row — e.g. "WebSocket | ws | push real-time updates 
   without client-side polling overhead").

6. ENGINEERING CHALLENGES SOLVED
   This is the most important section for a technical reader. List the 
   genuinely hard problems this project solved, specifically:
   - Concurrent polling at scale without blocking Node's event loop 
     (Promise.allSettled + concurrency cap, not sequential awaits)
   - Overlap protection for slow-responding monitors
   - SSRF prevention on user-submitted URLs (DNS resolution + private 
     IP range blocking)
   - PostgreSQL array-parameter binding bug with Drizzle's raw sql 
     template and how it was diagnosed and fixed (this is a real, 
     specific debugging story — include it, don't be generic)
   - Batched WebSocket updates on the frontend to avoid excessive 
     re-renders

7. DATABASE SCHEMA
   Show the three tables (monitors, monitor_logs, alerts) with their 
   columns, either as a code block or a simple diagram, plus one 
   sentence per table explaining its purpose.

8. API REFERENCE
   A table of all endpoints: Method | Path | Description | 
   Request/Response shape (brief).

9. GETTING STARTED / LOCAL SETUP
   Step-by-step: prerequisites, environment variables needed (with 
   placeholder values, never real secrets), how to run the schema 
   migration, how to start backend and frontend.

10. SCREENSHOTS
    Add placeholder image markdown tags with descriptive alt text and 
    a TODO comment noting where I should manually add real screenshots 
    (e.g. dashboard overview, alerts page, add-monitor modal).

11. FUTURE IMPROVEMENTS
    A short honest list of what's not yet built (e.g. auth/multi-user 
    support, email/Slack alert delivery, historical uptime graphs beyond 
    100 checks, SSL certificate expiry monitoring) — this shows maturity 
    and awareness of the project's current scope vs a production system.

12. LICENSE
    Standard MIT license placeholder.

Formatting requirements:
- Use proper Markdown: headers, tables, code blocks with language tags, 
  badges if reasonable (tech stack badges via shields.io style).
- Keep tone clear and professional, not overly casual or full of emoji 
  spam — a few relevant emoji in section headers is fine, not more.
- Be factually accurate to the actual codebase — do not invent features, 
  endpoints, or architecture details that don't exist in the current 
  implementation. If unsure about an implementation detail, check the 
  actual source files before writing that section.

Do NOT modify any application code, routes, schema, or configuration — 
this task is strictly to create/update README.md.