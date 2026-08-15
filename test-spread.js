const obj = { a: 1 };
try {
  const arr = [ ...obj ];
} catch (e) {
  console.log(e.message);
}
