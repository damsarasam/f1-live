---
version: 1
slug: "frontend-index-html"
primary_target: "frontend/index.html"
related_targets: []
---

# Surface brief: F1 Data Hub web app (frontend/)

Mode: Operate (Home, Sessions, Live, Strategy are working screens). Build path: code-led (no image generation on this machine).
Audience/job: public F1 fans pick a session or follow a live one and read what happened at a glance.
Constraints: data from the FastAPI backend only; honest empty/limited states (F1 TV archive lock, OpenF1 2023+ coverage, live restriction); WCAG AA; reduced motion honoured; colour never the only encoding (tyre letters, position numbers).
Direction pinned by the user: F1 TV broadcast graphics. The concept roll ran (seed:6a489a337ae57640); the pinned world wins over its assignment.

## Direction contract

THESIS: The app reads like the TV graphics package of a race broadcast: data arrives as timing-tower strips, lower thirds and circuit maps, not as dashboard cards. Refuses the default analytics grid of rounded cards, KPI tiles and chart widgets.
OWN-WORLD: Carbon black ground (#0B0B10) with a cooler panel layer, broadcast red (#E10600) only for selection, live state and leaders, white for data. Titillium Web throughout, italic heavy uppercase for titles and driver codes, upright for data. Hard-edged slanted strips (clip-path parallelograms of 4 points), team colour slivers, tyre discs with letters. No rounded corners, no glass, no gradients on text.
STORY: A visitor lands on the latest session already on screen, sees who won and where the cars were, then drills into any past session, the live board on race day, or strategy history for the next Grand Prix.
FIRST VIEWPORT: Home: full-width broadcast title strip with the latest session name (left), next race countdown (right); below, a timing tower of the latest classification (left, 40%) beside the circuit map with car positions (right, 60%); section entry links as a slanted tab strip in the top bar. Primary action: open the session in Sessions.
FORM: Broadcast graphics package (user-pinned, position 1 of 1; the user-pinned direction beats the roll, challengers declined as off-brief). seed:6a489a337ae57640
SIGNATURE: Lap replay. On Sessions the fastest lap draws itself around the circuit coloured by speed while a car marker travels it in real lap time (scaled), with replay control; live car markers glide between refreshes; tower rows slide when positions change.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
