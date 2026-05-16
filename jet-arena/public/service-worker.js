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
    event.respondWith(
      new Response("Network blocked during active match", { status: 403 }),
    );
    return;
  }
  event.respondWith(fetch(event.request));
});
