// Cloudflare Worker: speechgyms-proxy
// Routes: *speechgyms.com/*, *.speechgyms.com/*
// Account: Hobbyland.design@gmail.com (e7dac8a1c8816c0f3303f1935e422a10)
//
// Why this exists: Railway's auto Let's Encrypt for the custom domain
// (www.speechgyms.com) never issued — same stuck pattern slayjobs hit.
// Cloudflare Universal SSL terminates client TLS, this Worker forwards
// to the Railway service URL with Host rewritten so Railway routes the
// request to our service by SNI.
//
// To update: paste this file's contents into the Worker in the Cloudflare
// dashboard (Workers & Pages → speechgyms-proxy → Edit code → Deploy).
// See ../RAILWAY-DEPLOYMENT.md for full context.

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = "hobbyland-speechgyms-production.up.railway.app";
    const newUrl = `https://${origin}${url.pathname}${url.search}`;
    const headers = new Headers(request.headers);
    headers.set("Host", origin);
    headers.set("X-Forwarded-Host", url.host);
    headers.set("X-Forwarded-Proto", "https");
    const newRequest = new Request(newUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
    return fetch(newRequest);
  },
};
