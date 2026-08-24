const fs = require('fs');
const path = './app/context/locales/en.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
data['common.status'] = 'Status';
fs.writeFileSync(path, JSON.stringify(data, null, 2));
