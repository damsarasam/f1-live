# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

FastAPI (Python) backend serving JSON plus a plain HTML/CSS/JS frontend with no build step; FastAPI serves the static files. Charts are hand-drawn SVG/canvas. Replaces the earlier Streamlit app. Deploy target: undecided.

## Users

Public visitors: Formula 1 fans who want to dig into race data — browsing past sessions, following a live session, and comparing strategies. Assumed (not confirmed): mostly desktop browsing, with phone use during live race weekends.

## Product Purpose

The site root is the Aerolabs AI company page introducing the company and its two products. The F1 section's own landing page (/f1) introduces F1 Data Hub and sends visitors to its three areas (Live, past Sessions, Strategy), proving at first sight that it is free with no login, showing a real lap replay, the latest result and the next-race countdown.

F1 Data Hub turns raw timing and telemetry into readable race analysis in the browser: historical sessions (fastest-lap track map coloured by speed, classification, tyre stints, head-to-head speed traces), a live tracker (weather, timing tower, car positions) and strategy predictions from the last three years' top-five finishers. Success: a visitor picks a session and understands what happened without needing a data tool.

## Positioning

Free, browser-only F1 analysis built on open data (FastF1 results, OpenF1 laps/telemetry/live timing), combining history, live and strategy in one place without an F1 TV account.

## Operating Context

- Race weekends: live page left open during sessions, auto-refreshing.
- Between races: exploring past sessions and preparing for the next Grand Prix's strategy.

## Capabilities and Constraints

- Since Oct 2026 the F1 livetiming archive needs an F1 TV login, so FastF1 loads results only; laps/telemetry come from OpenF1, which covers 2023 onwards. 2022 still loads via FastF1's mirror; earlier seasons show results only.
- OpenF1 free tier: 3 requests/second and 30/minute, shared by all visitors, so the backend must cache centrally and never fan visitor requests straight through.
- First FastF1 session load is slow (~15–20 s); the UI needs a real loading state.
- OpenF1 restricts unauthenticated access during live sessions; the live page must explain this rather than fail.
- The local 3D race replay (desktop window, Python 3.11+) does not fit a public site and is dropped from the web UI.

## Brand Commitments

- Company: Aerolabs AI. The site root (/) is the Aerolabs AI company landing page; it presents two products.
- Company mission (user-supplied, presented as vision): "AeroLabs AI is an advanced motorsport intelligence platform focused on real time race analytics, aerodynamic strategy optimization and AI driven performance modeling. Leveraging historical and live Formula 1 data the platform delivers dynamic race visualizations, predictive strategy insights and decision support systems designed to mirror next generation racing technologies." Aerolabs AI is also an aerospace asteroid-mining company.
- Product 1: F1 Data Hub, live now at /f1 (Sessions, Live, Strategy beneath it). Describe it by what it does today; AI-driven modelling and predictive insights are roadmap, never presented as shipped features.
- Product 2: ASTRAEUS, "Autonomous Asteroid Mining & Resource Intelligence", tagline "Beyond Earth. Within reach." Under construction: shown as a product block on the main page with a coming-soon state; no separate page, no invented specs, partners, missions or dates.
- The user will supply an Aerolabs AI logo file; until then the wordmark is set as text in a swappable slot.
- Visual identity: the parent brand (main page) gets its own identity that can hold motorsport and space; the F1 TV broadcast graphics world (carbon black, red, white, italic uppercase type, timing towers) stays inside F1 Data Hub.
- Must not imitate official Formula 1 branding (no F1 logo, official fonts or trademarked marks), nor any space agency's insignia.

## Evidence on Hand

Real data only, fetched live from FastF1/OpenF1. No testimonials, user counts or partnerships exist; never fabricate them.

## Product Principles

1. Data first: every screen answers a race question; decoration never hides numbers.
2. Honest about data gaps: say why data is missing (F1 TV requirement, season coverage, live restriction) instead of showing raw errors.
3. Fast perceived speed: cache aggressively and show progress during slow loads.
4. Broadcast feel, readable at a glance like a TV graphic.

## Accessibility & Inclusion

Public site: aim for WCAG 2.2 AA contrast and keyboard access, and honour prefers-reduced-motion. Team and tyre colours must not be the only way information is encoded.
