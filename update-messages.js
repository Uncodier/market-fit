const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib', 'demo-data', 'demo-habituall.ts');
let data = fs.readFileSync(filePath, 'utf8');

// The user talking to the agent about building the app
data = data.replace(
  "Hi, I watched the AI in Analytics webinar. Can we schedule a demo for my team at DataTech? We are looking to upgrade from our current BI tool.",
  "Hola, quiero crear una app web para HabitUall, es un centro comunitario para trabajar y crecer en Celaya."
);

data = data.replace(
  "Hi Sarah! Thanks for attending the webinar. I'd be happy to schedule a demo for DataTech. Are you available this Tuesday at 10 AM EST?",
  "¡Hola! Claro que sí, me encantaría ayudarte a construir la app web para HabitUall. ¿Qué características te gustaría incluir en la aplicación?"
);

data = data.replace(
  "Tuesday works great. Can you also send over some information about your enterprise pricing?",
  "HabitUall ofrece espacios de coworking premium, clubes, estudios de clases deportivas y salas privadas. Necesito que se pueda ver la ubicación (Manuel Doblado 477), los horarios (9am a 9pm) y una lista de nuestros servicios con sus precios (Cowork $800, Studio $1700, Club $1800, Habitual $2700)."
);

data = data.replace(
  "Absolutely. I've sent a calendar invite for Tuesday at 10 AM. I'll also follow up shortly with our enterprise pricing guide.",
  "Perfecto. He empezado a generar el proyecto con Next.js y Tailwind CSS. Implementaré la página principal mostrando el centro comunitario, las membresías y la ubicación. Aquí tienes un adelanto en el panel de la derecha."
);

data = data.replace(
  "Hello, I'm having trouble connecting our Salesforce account. I keep getting a 'token expired' error.",
  "También necesitamos una sección para próximos eventos, por ejemplo 'Taller de Yoga' los días 15 a las 10:00 AM."
);

data = data.replace(
  "Hi there. I can help with that. This usually happens when the OAuth token needs to be refreshed. Please go to Settings > Integrations and click 'Reconnect' on the Salesforce card.",
  "Entendido. Añadí la sección de eventos. Ya puedes ver la previsualización actualizada con todas las secciones de HabitUall."
);

fs.writeFileSync(filePath, data);
console.log("Updated messages in demo-habituall.ts");
