const activeClientIds = new Set();

self.addEventListener("message", (event) => {
  const clientId = event.source && "id" in event.source ? event.source.id : null;

  if (event.data?.type === "GAME_START") {
    if (clientId) {
      activeClientIds.add(clientId);
    }
  }
  if (event.data?.type === "GAME_END") {
    if (clientId) {
      activeClientIds.delete(clientId);
    } else {
      activeClientIds.clear();
    }
  }
});

self.addEventListener("fetch", (event) => {
  if (event.clientId && activeClientIds.has(event.clientId)) {
    const url = new URL(event.request.url);
    const sameOrigin = url.origin === self.location.origin;
    // Keep local app/runtime assets available during lockdown (UI, sprites, modules),
    // while still blocking external network access for active match clients.
    if (sameOrigin) {
      event.respondWith(fetch(event.request));
      return;
    }
    event.respondWith(
      new Response("Network blocked during active match", { status: 403 }),
    );
    return;
  }
  event.respondWith(fetch(event.request));
});
