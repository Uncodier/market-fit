// Debug de la detección MIME con el texto real de producción
const realProductionText = `--Apple-Mail=_F4579245-0FDA-4EAE-9DE9-C77217F707ED Content-Transfer-Encoding: quoted-printable Content-Type: text/plain; charset=utf-8 Hola Richard, te paso un resumen de lo que hablamos: - Hay que hacer un setup de la cuenta para ver que estrategias nos propone el sistema y como opmtizar el presupuesto (lo coordino con Goerge acá mi calendly www.calendly.com/sergio-prado http://www.calendly.com/sergio-prado) - Trataremos de rescatar leads actuales, y revisar que puntos de contacto automatizar del pipeline actual. - Prospectar en paralelo con un nuevo Pipeline de mejora automatica con Market Fit. - A mediano plazo buscar la integracion del mercado américano. - Revisar estrategias de SEO y generacion de contenidos para autoridad. --Apple-Mail=_F4579245-0FDA-4EAE-9DE9-C77217F707ED Content-Transfer-Encoding: quoted-printable Content-Type: text/html; charset=utf-8 <html><head><meta http-equiv="content-type" content="text/html; charset=utf-8"></head><body style="overflow-wrap: break-word; -webkit-nbsp-mode: space; line-break: after-white-space;">Hola Richard, te paso un resumen de lo que hablamos:<div><br></div><div>- Hay que hacer un setup de la cuenta para ver que estrategias nos propone el sistema y como opmtizar el presupuesto (lo coordino con Goerge acá mi calendly <a href="http://www.calendly.com/sergio-prado">www.calendly.com/sergio-prado</a>)</div><div><br></div><div>- Trataremos de rescatar leads actuales, y revisar que puntos de contacto automatizar del pipeline actual.</div><div><br></div><div>- Prospectar en paralelo con un nuevo Pipeline de mejora automatica con Market Fit.</div><div><br></div><div>- A mediano plazo buscar la integracion del mercado américano.</div><div><br></div><div>- Revisar estrategias de SEO y generacion de contenidos para autoridad.</div></body></html> --Apple-Mail=_F4579245-0FDA-4EAE-9DE9-C77217F707ED--`;

// Función actual de detección
function currentDetection(text) {
  if (!text || typeof text !== 'string') return false;
  
  const hasMimeBoundary = /--[A-Za-z0-9_=-]{10,}/i.test(text);
  const hasContentType = /Content-Type:\s*(text\/plain|text\/html)/i.test(text);
  const hasContentTransferEncoding = /Content-Transfer-Encoding:/i.test(text);
  
  console.log('Detección actual:');
  console.log('- Boundary:', hasMimeBoundary);
  console.log('- Content-Type:', hasContentType);
  console.log('- Transfer-Encoding:', hasContentTransferEncoding);
  
  return hasMimeBoundary && hasContentType && hasContentTransferEncoding;
}

// Función mejorada de detección
function improvedDetection(text) {
  if (!text || typeof text !== 'string') return false;
  
  // Detectar boundaries MIME (más flexible)
  const hasMimeBoundary = /--[A-Za-z0-9_=-]{10,}/i.test(text);
  
  // Detectar Content-Type (más flexible, puede estar sin espacios después de :)
  const hasContentType = /Content-Type:\s*(text\/(?:plain|html))/i.test(text);
  
  // Detectar Content-Transfer-Encoding
  const hasContentTransferEncoding = /Content-Transfer-Encoding:/i.test(text);
  
  // También verificar que tenga estructura MIME típica
  const hasMultipleParts = text.split(/--[A-Za-z0-9_=-]{10,}/).length > 2;
  
  console.log('Detección mejorada:');
  console.log('- Boundary:', hasMimeBoundary);
  console.log('- Content-Type:', hasContentType);
  console.log('- Transfer-Encoding:', hasContentTransferEncoding);
  console.log('- Multiple parts:', hasMultipleParts);
  
  return hasMimeBoundary && hasContentType && hasContentTransferEncoding && hasMultipleParts;
}

// Función de parsing mejorada
function improvedParser(text) {
  if (!improvedDetection(text)) {
    return {
      hasMultipart: false,
      cleanText: text
    };
  }

  // Extraer boundary
  const boundaryMatch = text.match(/--([A-Za-z0-9_=-]{10,})/);
  if (!boundaryMatch) {
    return { hasMultipart: false, cleanText: text };
  }

  const boundary = boundaryMatch[1];
  console.log('Boundary encontrado:', boundary);

  // Dividir por boundary
  const parts = text.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  
  let textPlain = '';
  let foundContent = false;

  // Procesar cada parte
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part || part === '--') continue;

    console.log(`\nParte ${i}:`, part.substring(0, 100) + '...');

    // Buscar Content-Type: text/plain
    if (/Content-Type:\s*text\/plain/i.test(part)) {
      console.log('✅ Encontrada parte text/plain');
      
      // Extraer el contenido después de los headers
      // Buscar el patrón: charset=utf-8 seguido del contenido
      const contentMatch = part.match(/charset=utf-8\s+(.+?)(?=\s+--[A-Za-z0-9_=-]{10,}|$)/s);
      if (contentMatch) {
        textPlain = contentMatch[1].trim();
        foundContent = true;
        console.log('✅ Contenido extraído:', textPlain.substring(0, 100) + '...');
        break;
      }
    }
  }

  if (!foundContent) {
    // Fallback: buscar contenido entre charset=utf-8 y el siguiente boundary
    const fallbackMatch = text.match(/charset=utf-8\s+(.+?)(?=\s+--[A-Za-z0-9_=-]{10,})/s);
    if (fallbackMatch) {
      textPlain = fallbackMatch[1].trim();
      foundContent = true;
      console.log('✅ Contenido extraído (fallback):', textPlain.substring(0, 100) + '...');
    }
  }

  return {
    hasMultipart: foundContent,
    textPlain: foundContent ? textPlain : '',
    cleanText: foundContent ? textPlain : text
  };
}

// Test
console.log('='.repeat(80));
console.log('DEBUG: Detección MIME en Producción');
console.log('='.repeat(80));

console.log('\n1. Texto de entrada (primeros 200 chars):');
console.log(realProductionText.substring(0, 200) + '...');

console.log('\n2. Detección actual:');
const currentResult = currentDetection(realProductionText);
console.log('Resultado:', currentResult ? '✅ DETECTADO' : '❌ NO DETECTADO');

console.log('\n3. Detección mejorada:');
const improvedResult = improvedDetection(realProductionText);
console.log('Resultado:', improvedResult ? '✅ DETECTADO' : '❌ NO DETECTADO');

if (improvedResult) {
  console.log('\n4. Parsing del contenido:');
  const parsed = improvedParser(realProductionText);
  
  console.log('\n5. Resultado final:');
  if (parsed.hasMultipart) {
    console.log('✅ ÉXITO - Contenido extraído:');
    console.log('---');
    console.log(parsed.textPlain);
    console.log('---');
  } else {
    console.log('❌ FALLO - No se pudo extraer contenido');
  }
} 