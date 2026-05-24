const https = require('https');
const { gmailConfigured, sendSmtp, makeReminderEmail, fmtDateTR } = require('./gmail-smtp');

const SITE_ID = process.env.NETLIFY_SITE_ID;
const TOKEN = process.env.NETLIFY_TOKEN;
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'project-eos-assistant-001';

async function netlifyBlob(path, method = 'GET', body = null) {
  const opts = { method, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch('https://api.netlify.com/api/v1/blobs/' + SITE_ID + path, opts);
    if (r.status === 404 || r.status === 204) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  } catch (e) {
    return null;
  }
}

function sendNtfy(title, body, topic) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ topic: topic || NTFY_TOPIC, title, message: body, priority: 4 });
    const req = https.request({
      hostname: 'ntfy.sh', port: 443, path: '/', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => { resolve(res.statusCode); });
    req.on('error', () => { resolve(0); });
    req.write(data);
    req.end();
  });
}

exports.handler = async () => {
  if (!SITE_ID || !TOKEN) {
    return { statusCode: 200, body: 'skipped' };
  }
  try {
    const now = Date.now();
    const list = await netlifyBlob('/eos-reminders');
    if (!list || !list.blobs || !list.blobs.length) {
      return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };
    }
    let sent = 0;
    for (const blob of list.blobs) {
      const r = await netlifyBlob('/eos-reminders/' + blob.key);
      if (!r || r.fireAt > now) continue;
      let ntfyMsg = r.body || r.taskTitle || r.title || 'Görev hatırlatıcısı';
      if (r.taskDate) ntfyMsg += ' — ' + fmtDateTR(r.taskDate);
      if (r.taskTime) ntfyMsg += ' ' + r.taskTime;
      await sendNtfy(r.title || '📅 EOS', ntfyMsg, r.ntfyTopic);
      if (r.email && gmailConfigured()) {
        const email = makeReminderEmail(r);
        await sendSmtp(r.email, email.subject, email.html);
      }
      await netlifyBlob('/eos-reminders/' + blob.key, 'DELETE');
      sent++;
    }
    return { statusCode: 200, body: JSON.stringify({ sent }) };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
