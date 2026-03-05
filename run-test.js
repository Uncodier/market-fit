const { loadEnvConfig } = require('@next/env')
loadEnvConfig(process.cwd())
require('./test-signup-phone.js');
