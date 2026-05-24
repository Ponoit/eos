// Store push subscription - uses Netlify Blobs (built-in, no plugin needed)
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: '{}' };

  try {
    const { subscription, userId } = JSON.parse(event.body);
    if (!subscription || !userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fields' }) };

    // Use Netlify Blobs via fetch (no package needed)
    const siteId = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
    const token  = process.env.NETLIFY_TOKEN || process.env.TOKEN;

    if (siteId && token) {
      await fetch(`https://api.netlify.com/api/v1/blobs/${siteId}/eos-subs/${userId}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
