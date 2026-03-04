const { Jimp } = require('jimp');

async function main() {
  const img = await Jimp.read('/Users/prado/.cursor/projects/Users-prado-Desktop-Proyectos-Uncodie-Code-market-fit/assets/browser-screenshot-db36a89d-fcb1-4edb-a49a-55cc50ede4cc.png');
  const width = img.bitmap.width;
  const height = img.bitmap.height;
  
  let colors = {};
  for(let y=0; y<height; y++) {
    for(let x=0; x<width; x++) {
      let hex = img.getPixelColor(x, y).toString(16);
      if(hex !== 'ffffffff') {
        colors[hex] = (colors[hex] || 0) + 1;
      }
    }
  }
  let sorted = Object.entries(colors).sort((a,b)=>b[1]-a[1]);
  console.log(`Size: ${width}x${height}`);
  console.log(sorted.slice(0, 10));
}
main();
