const fs = require('fs');
const os = require('os');
const util = require('util');

async function createKeyPair(serverless, options, stacks) {
  const provider = serverless.getProvider('aws');
  let publicKeyPath = options['key-pair']['public-rsa-key'];
  const keyName = options['key-pair']['key-name'];
  if (!keyName || !publicKeyPath)
    return;

  publicKeyPath = publicKeyPath.startsWith('~') ? publicKeyPath.replace('~', os.homedir()) : publicKeyPath;
  const keyMaterial = fs.readFileSync(publicKeyPath, { encoding: 'utf8' })

  try {
    await provider.request('EC2', 'importKeyPair', {
      KeyName: keyName,
      PublicKeyMaterial: keyMaterial
    });
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }

  // needs to be flattened if you want it to be resolved
  // by the sls stack
  options['result.keyName'] = keyName;

  serverless.cli.log(`Key pair created: ${keyName}`);
  if (process.env.DEBUG) {
    serverless.cli.log(`[DEBUG] keyMaterials >>>>> ${keyMaterial}`);
    serverless.cli.log(`[DEBUG] options >>>> ${util.format(options)}`);
  }
}

async function removeKeyPair(serverless, options, stacks) {
  const keyName = options['key-pair']['key-name'];
  if (!keyName) return;

  const provider = serverless.getProvider('aws');

  try {
    await provider.request('EC2', 'deleteKeyPair', {
      KeyName: keyName
    });
  }
  catch (err) {
    if (!err.message.includes('does not exist')) {
      throw err;
    }
  }

  serverless.cli.log(`Key pair deleted: ${keyName}`)
}

module.exports = {
  createKeyPair,
  removeKeyPair
}