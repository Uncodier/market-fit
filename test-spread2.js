const obj = null;
try {
  const arr = [ ...obj ];
} catch (e) {
  console.log(e.message);
}
