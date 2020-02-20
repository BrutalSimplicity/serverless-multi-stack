const fs = require('fs');
const _ = require('lodash');
const util = require('util');
const PluginManager = require('serverless/lib/classes/PluginManager');
const Service = require('serverless/lib/classes/Service');
const Variables = require('serverless/lib/classes/Variables');

let started = false;
class ServerlessMultiStackPlugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.provider = serverless.getProvider('aws');


        this.hooks = {
            'after:deploy:deploy': this.deployStacks.bind(this),
            'before:remove:remove': this.destroyStacks.bind(this),
            'after:remove:remove': () => console.log(this.provider.serverless.service)
        }
    }

    async printBucket() {
        console.log(await this.provider.getServerlessDeploymentBucketName());
    }

    async deployStacks() {
        if (started) {
            console.log(this.serverless);
            return;
        }
        const copy = _.cloneDeep(this.serverless);
        this.options.config = './serverless.2.yml';
        started = true;
        this.serverless.pluginManager = new PluginManager(this.serverless);
        this.serverless.service = new Service(this.serverless);
        this.serverless.variables = new Variables(this.serverless);
        await this.serverless.pluginManager.loadConfigFile()
            .then(() => this.serverless.service.load(this.options))
            .then(() => this.serverless.pluginManager.loadAllPlugins(this.serverless.service.plugins))
            .then(() => {
                this.serverless.cli.setLoadedPlugins(this.serverless.pluginManager.getPlugins());
                this.serverless.cli.setLoadedCommands(this.serverless.pluginManager.getCommands());
                return this.serverless.pluginManager.updateAutocompleteCacheFile();
            });

        console.log(this.serverless);
        await this.serverless.variables.populateService(this.options).then(() => {
            const service = this.serverless.service;
            service.mergeArrays();
            service.setFunctionNames(this.serverless.processedInput.options);
            service.validate();
        });

        console.log(this.serverless);
        await this.serverless.pluginManager.spawn('deploy');
        _.keys(this.serverless).forEach(key => {
            if (!copy[key]) {
                delete this.serverless[key];
            }
        });
        _.keys(copy).forEach(key => {
            this.serverless[key] = copy[key];
        });
    }


    async destroyStacks() {
        if (started) {
            console.log(this.serverless);
            return;
        }
        const copyProvider = _.cloneDeep(this.provider);
        const copy = _.cloneDeep(this.serverless);
        const copyOptions = _.cloneDeep(this.options);
        this.options.config = './serverless.2.yml';
        started = true;
        this.serverless.pluginManager = new PluginManager(this.serverless);
        this.serverless.service = new Service(this.serverless);
        this.serverless.variables = new Variables(this.serverless);
        await this.serverless.pluginManager.loadConfigFile()
            .then(() => this.serverless.service.load(this.options))
            .then(() => this.serverless.pluginManager.loadAllPlugins(this.serverless.service.plugins))
            .then(() => {
                this.serverless.cli.setLoadedPlugins(this.serverless.pluginManager.getPlugins());
                this.serverless.cli.setLoadedCommands(this.serverless.pluginManager.getCommands());
                return this.serverless.pluginManager.updateAutocompleteCacheFile();
            });

        await this.serverless.variables.populateService(this.options).then(() => {
            const service = this.serverless.service;
            service.mergeArrays();
            service.setFunctionNames(this.serverless.processedInput.options);
            service.validate();
        });

        await this.serverless.pluginManager.spawn('remove');
        _.keys(this.serverless).forEach(key => {
            if (!copy[key]) {
                delete this.serverless[key];
            }
        });
        _.keys(copy).forEach(key => {
            this.serverless[key] = copy[key];
        });
    }

}

async function reinit(serverless) {
    return serverless.pluginManager
        .loadConfigFile()
        .then(() => {
            // set the options and commands which were processed by the CLI
            serverless.pluginManager.setCliOptions(serverless.processedInput.options);
            serverless.pluginManager.setCliCommands(serverless.processedInput.commands);

            return serverless.service.load(serverless.processedInput.options);
        })
        .then(() => {
            // load all plugins
            return serverless.pluginManager.loadAllPlugins(serverless.service.plugins);
        })
        .then(() => {
            return serverless.pluginManager.updateAutocompleteCacheFile();
        });
}

module.exports = ServerlessMultiStackPlugin;