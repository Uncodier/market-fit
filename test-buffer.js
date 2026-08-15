const fs = require('fs');

async function run() {
  const buf = Buffer.from(new ArrayBuffer(10));
  console.log(buf.length);
}
run();
