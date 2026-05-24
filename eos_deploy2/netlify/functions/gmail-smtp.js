const tls = require('tls');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

function gmailConfigured() {
  return !!(GMAIL_USER && GMAIL_PASS);
}

function fmtDateTR(dateStr) {
  if (!dateStr) return '';
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const p = dateStr.split('-');
  return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

function makeReminderEmail(r) {
  const title = r.taskTitle || r.body || '';
  const date = fmtDateTR(r.taskDate);
  const time = r.taskTime || '';
  const note = r.taskNote || '—';
  const category = r.taskCategory || 'Genel';
  const prio = r.taskPriority || '🟡';
  return {
    subject: '\uD83D\uDCC5 ' + title + ' yaklaşıyor',
    html: '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
      + '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.9;color:#111;background:#fff">'
      + '<p style="margin:0">Efendim ' + title + ' yaklaşıyor</p>'
      + '<p style="margin:0">&#x1F4C5; Tarih: ' + date + '</p>'
      + '<p style="margin:0">&#x23F0; Saat: ' + time + '</p>'
      + '<p style="margin:0">&nbsp;</p>'
      + '<p style="margin:0">Açıklama: ' + note + '</p>'
      + '<p style="margin:0">Kategori: ' + category + '</p>'
      + '<p style="margin:0">Öncelik: ' + prio + ' \u203C\uFE0F</p>'
      + '<p style="margin:0">&nbsp;</p>'
      + '<p style="margin:0">Bu hatırlatma EOS tarafından gönderildi.&nbsp;<span style="white-space:nowrap">🩵</span></p>'
      + '</body></html>'
  };
}

function makeTestEmail() {
  return {
    subject: '\uD83D\uDCC5 \uD83C\uDF89 EOS Test',
    html: '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
      + '<body style="margin:0;padding:24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.9;color:#111;background:#fff">'
      + '<p style="margin:0">EOS test e-postası — Gmail üzerinden gönderildi.</p>'
      + '<p style="margin:0">&nbsp;</p>'
      + '<p style="margin:0">Bu hatırlatma EOS tarafından gönderildi.&nbsp;<span style="white-space:nowrap">🩵</span></p>'
      + '</body></html>'
  };
}

function sendSmtp(to, subject, htmlBody) {
  return new Promise((resolve) => {
    if (!gmailConfigured()) {
      resolve(0);
      return;
    }
    const auth = Buffer.from('\0' + GMAIL_USER + '\0' + GMAIL_PASS).toString('base64');
    let step = 0;
    const socket = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' }, () => {});
    const send = (cmd) => socket.write(cmd + '\r\n');
    const msg = [
      'From: EOS <' + GMAIL_USER + '>',
      'To: ' + to,
      'Subject: ' + subject,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody
    ].join('\r\n');
    socket.on('data', (d) => {
      const line = d.toString();
      if (step === 0 && line.startsWith('220')) { send('EHLO eos-assistant.netlify.app'); step++; }
      else if (step === 1 && line.includes('250 ')) { send('AUTH PLAIN ' + auth); step++; }
      else if (step === 2 && line.startsWith('235')) { send('MAIL FROM:<' + GMAIL_USER + '>'); step++; }
      else if (step === 3 && line.startsWith('250')) { send('RCPT TO:<' + to + '>'); step++; }
      else if (step === 4 && line.startsWith('250')) { send('DATA'); step++; }
      else if (step === 5 && line.startsWith('354')) { send(msg + '\r\n.'); step++; }
      else if (step === 6 && line.startsWith('250')) { send('QUIT'); resolve(250); }
      else if (line.startsWith('5')) { socket.destroy(); resolve(0); }
    });
    socket.on('error', () => { resolve(0); });
    socket.setTimeout(15000, () => { socket.destroy(); resolve(0); });
  });
}

module.exports = { gmailConfigured, sendSmtp, makeReminderEmail, makeTestEmail, fmtDateTR };
