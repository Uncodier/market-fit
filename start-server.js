const { spawn } = require('child_process');
const server = spawn('npm', ['run', 'start'], {
  detached: true,
  stdio: 'ignore'
});
server.unref();
console.log('Server started');
