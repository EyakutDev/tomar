// This public site identifier only allows Cloudflare to collect analytics.
if (
  import.meta.env.PROD &&
  import.meta.env.MODE !== "demo" &&
  ["ttomar.online", "www.ttomar.online"].includes(window.location.hostname)
) {
  const beacon = document.createElement("script");
  beacon.type = "module";
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = JSON.stringify({ token: "065336cde0964946a30ce01c49f607ed" });
  document.body.appendChild(beacon);
}
