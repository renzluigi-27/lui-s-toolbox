export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    return env.ASSETS.fetch(request);
  }
};