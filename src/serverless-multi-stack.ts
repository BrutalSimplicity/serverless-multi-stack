import AwsProvider from 'serverless/lib/plugins/aws/provider/awsProvider';
import Serverless from 'serverless';
import Plugin from 'serverless/lib/classes/Plugin';
import { toConfig, MultiStackConfig } from './models';
import _ from 'lodash';
import './lodash-async';
import { reload, restore, deploy, saveStack, printServiceHeader, remove, handleEntryPoint } from './utils';

const CONFIG_SECTION = 'multi-stack';

class MultiStackPlugin implements Plugin {
  readonly serverless: Serverless;
  readonly provider: AwsProvider;
  readonly options: Serverless.Options;
  readonly hooks: Plugin.Hooks;
  settings: MultiStackConfig;
  static started = false;

  constructor(serverless: Serverless, options: Serverless.Options) {
    this.serverless = serverless;
    this.provider = serverless.getProvider('aws');
    this.options = options;
    this.hooks = {
      'before:deploy:deploy': this.configureSettings.bind(this),
      'after:deploy:deploy': this.deployStacks.bind(this),
      'before:remove:remove': this.removeStacks.bind(this)
    }
  }

  async configureSettings() {
    this.settings = await toConfig(this.serverless.service?.custom?.[CONFIG_SECTION]);
  }

  async deployStacks() {
    if (!this.settings) {
      this.serverless.cli.log(`No stacks found. Missing [${CONFIG_SECTION}] section. Skipping multi-stack deploys...`)
      return;
    }

    const stacks = [] as Serverless[];
    const copy = _(this.serverless).cloneDeep();
    for (const [location, stack] of Object.entries(this.settings.stacks)) {
      this.options.config = location;

      await _.flowAsync(
        reload(this.options),
        printServiceHeader,
        saveStack(stacks),
        handleEntryPoint('beforeDeploy', stack.beforeDeploy, this.options, stacks),
        deploy,
        handleEntryPoint('afterDeploy', stack.afterDeploy, this.options, stacks),
      )(this.serverless);
    }

    this.serverless.cli.log(`Restoring ${copy.service.getServiceName()}...`);
    restore(this.serverless, copy);
  }

  async removeStacks() {
    if (!this.settings) {
      this.serverless.cli.log(`No stacks found. Missing [${CONFIG_SECTION}] section. Skipping multi-stack deploys...`)
      return;
    }

    const stacks = [] as Serverless[];
    const copy = _(this.serverless).cloneDeep();
    for (const [location, stack] of Object.entries(this.settings.stacks).reverse()) {
      this.options.config = location;

      await _.flowAsync(
        reload(this.options),
        printServiceHeader,
        saveStack(stacks),
        remove,
      )(this.serverless);
    }

    this.serverless.cli.log(`Restoring ${copy.service.getServiceName()}...`);
    restore(this.serverless, copy);
  }
}

export = MultiStackPlugin;