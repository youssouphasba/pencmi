const { isStrongPassword } = require('class-validator');

class SeedCredentialsError extends Error {}

function readSeedPassword(name, env = process.env) {
  const value = env[name];
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 72
    || !isStrongPassword(value, { minLength: 12, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })) {
    throw new SeedCredentialsError(`Variable ${name} requise : mot de passe fort de 12 caracteres minimum, 72 octets maximum.`);
  }
  return value;
}

module.exports = { readSeedPassword, SeedCredentialsError };
