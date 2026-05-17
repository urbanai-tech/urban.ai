const fs = require('fs');
const https = require('https');

const API_KEY = process.env.MAILERSEND_API_KEY;
const DOMAIN_ID = process.env.MAILERSEND_DOMAIN_ID;
const SENDER_EMAIL = process.env.EMAIL_SENDER || 'noreply@notify.myurbanai.com';

if (!API_KEY || !DOMAIN_ID) {
  console.error('Set MAILERSEND_API_KEY and MAILERSEND_DOMAIN_ID before running this setup script.');
  process.exit(1);
}

const templatesToCreate = [
  { key: 'MAILERSEND_FORGOT_PASS_TEMPLATE', name: 'Recuperacao de Senha - Urban AI' },
  { key: 'MAILERSEND_CONFIRM_EMAIL_TEMPLATE', name: 'Confirmacao de Email - Urban AI' },
  { key: 'MAILERSEND_SEND_CODE_TEMPLATE', name: 'Envio de Codigo - Urban AI' },
  { key: 'MAILERSEND_ANALISE_PROPRIEDADE_INICIADO', name: 'Analise Iniciada - Urban AI' },
  { key: 'MAILERSEND_ANALISE_PROPRIEDADE_FINALIZADO', name: 'Analise Finalizada - Urban AI' },
  { key: 'MAILERSEND_ENVIO_NOTIFICATION', name: 'Nova Notificacao - Urban AI' }
];

async function createTemplate(tpl) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      domain_id: DOMAIN_ID,
      name: tpl.name
    });

    const options = {
      hostname: 'api.mailersend.com',
      path: '/v1/templates',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          const json = JSON.parse(responseData);
          resolve({ key: tpl.key, id: json.data.id });
        } else {
          console.error('Failed response:', responseData);
          reject(new Error(`Failed to create ${tpl.name}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const newIds = {};
  for (const tpl of templatesToCreate) {
    try {
      console.log('Creating template:', tpl.name);
      const res = await createTemplate(tpl);
      console.log('Created ID:', res.id);
      newIds[res.key] = res.id;
    } catch (e) {
      console.error(e.message);
    }
  }
  
  let envContent = fs.readFileSync('.env', 'utf8');
  for (const [key, id] of Object.entries(newIds)) {
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${id}`);
    } else {
      envContent += `\n${key}=${id}`;
    }
  }
  
  envContent = envContent.replace(/^MAILERSEND_API_KEY=.*/m, `MAILERSEND_API_KEY=${API_KEY}`);
  envContent = envContent.replace(/^EMAIL_SENDER=.*/m, `EMAIL_SENDER=${SENDER_EMAIL}`);
  
  fs.writeFileSync('.env', envContent);
  console.log('Successfully updated .env with new template IDs!');
}

run();
