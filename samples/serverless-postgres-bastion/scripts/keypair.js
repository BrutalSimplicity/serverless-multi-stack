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
    options['result.keyName'] = keyName;

    serverless.cli.log(`Key pair created: ${keyName}`);
    if (process.env.DEBUG) {
        serverless.cli.log(`[DEBUG] keyMaterials >>>>> ${keyMaterial}`);
        serverless.cli.log(`[DEBUG] options >>>> ${util.format(options)}`);
    }
}

function removeKeyPair(serverless, options, stacks) {

}

module.exports = {
    createKeyPair,
    removeKeyPair
}