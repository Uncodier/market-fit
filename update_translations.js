const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'app/context/locales');
const files = ['en.json', 'es.json'];

const translations = {
  en: {
    "pos.cart.splitTitle": "Split Bill",
    "pos.split.orderTitle": "Order",
    "pos.split.empty": "Empty order",
    "pos.split.addColumn": "Add Order"
  },
  es: {
    "pos.cart.splitTitle": "Dividir Cuenta",
    "pos.split.orderTitle": "Orden",
    "pos.split.empty": "Orden vacía",
    "pos.split.addColumn": "Agregar Orden"
  }
};

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const lang = file.replace('.json', '');
    if (translations[lang]) {
      Object.assign(data, translations[lang]);
      // Sort keys just in case it's sorted
      const sortedData = {};
      Object.keys(data).sort().forEach(k => {
        sortedData[k] = data[k];
      });
      fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 2) + '\n', 'utf8');
      console.log(`Updated ${file}`);
    }
  }
});
