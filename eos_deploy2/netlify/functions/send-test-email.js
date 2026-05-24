const { gmailConfigured, sendSmtp, makeTestEmail } = require('./gmail-smtp');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: '{}' };
  }
  if (!gmailConfigured()) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Gmail not configured on server' })
    };
  }
  try {
    const data = JSON.parse(event.body || '{}');
    const to = (data.to || '').trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
    }
    const email = makeTestEmail();
    const status = await sendSmtp(to, email.subject, email.html);
    if (status !== 250) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'SMTP failed' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
