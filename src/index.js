// Functions in the `/src` directory are deployed as Cloudflare Functions.
export async function onRequest(context) {
  const data = {
    message: "Hello from the online-edited API!",
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}