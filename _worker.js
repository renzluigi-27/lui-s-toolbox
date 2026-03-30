export default { 
  async fetch(request, env) {
    const url = new URL(request.url);

    // API route
    if (url.pathname === '/api/iban') {
      const iban = url.searchParams.get('iban');
      const apiKey = env.IBAN_API_KEY;

      const response = await fetch(
        `https://anyapi.io/api/v1/iban?iban=${iban}&apiKey=${apiKey}`
      );

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Static files (disable cache for HTML)
    const response = await env.ASSETS.fetch(request);
    const newHeaders = new Headers(response.headers);

    if (url.pathname.endsWith('.html') || url.pathname === '/') {
      newHeaders.set('Cache-Control', 'no-store');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
