// Where each AeroLabs AI app lives. Change these when the apps move to their own domains.
export const APPS = {
  web: "http://localhost:8000",
  vectra: "http://localhost:8001",
  astraeus: "http://localhost:8002",
};

/** Link to a page in another app: url("vectra", "/sessions") */
export const url = (app, path = "/") => APPS[app].replace(/\/$/, "") + path;

/** Point every <a data-app="vectra" data-path="/live"> at its app's address */
export function wireAppLinks(root = document) {
  for (const a of root.querySelectorAll("a[data-app]")) a.href = url(a.dataset.app, a.dataset.path || "/");
}
