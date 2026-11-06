# AeroLabs AI

Three separate apps in one repository:

| App | Folder | Local address | What it is |
| --- | --- | --- | --- |
| AeroLabs AI website | `web/` | http://localhost:8000 | Home, About, Vision, Blog. Static. |
| VECTRA | `vectra/` | http://localhost:8001 | Formula 1 race analysis: a FastAPI data backend (`vectra/backend`) and its web app (`vectra/frontend`). |
| ASTRAEUS | `astraeus/` | http://localhost:8002 | The asteroid-prospecting venture page. Static. |

Each app has its own copy of the code and assets it uses; nothing is shared at run time.
The website reads the race schedule from VECTRA's API for its "latest race" link.

## Run

All three: `./run-all.sh`

One at a time:

```sh
cd vectra   && ../venv/bin/uvicorn backend.main:app --port 8001
cd web      && python3 serve.py 8000
cd astraeus && python3 serve.py 8002
```

VECTRA needs the Python packages in `vectra/requirements.txt` (installed in `venv/`).

## Addresses between apps

Each app's `assets/js/config.js` lists where the other two live. Change all three copies when the apps
move to their own domains, and set `AEROLABS_WEB_ORIGINS` on VECTRA to the website's address so it may
read the schedule.
