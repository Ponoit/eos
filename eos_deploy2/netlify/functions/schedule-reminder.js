exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const data = JSON.parse(event.body);
    const siteId = process.env.NETLIFY_SITE_ID;
    const token  = process.env.NETLIFY_TOKEN;
    const key = data.userId + '_' + data.taskId;

    const blobFetch = async (path, method='GET', body=null) => {
      const opts = { method, headers: { 'Authorization': 'Bearer '+token, 'Content-Type': 'application/json' } };
      if(body) opts.body = JSON.stringify(body);
      const r = await fetch('https://api.netlify.com/api/v1/blobs/'+siteId+path, opts);
      return r.status;
    };

    if (event.httpMethod === 'DELETE') {
      await blobFetch('/eos-reminders/'+key, 'DELETE');
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod === 'POST') {
      await blobFetch('/eos-reminders/'+key, 'PUT', data);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers, body: '{}' };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
