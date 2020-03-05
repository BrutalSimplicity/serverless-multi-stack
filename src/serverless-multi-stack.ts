import AwsProvider from 'serverless/lib/plugins/aws/provider/awsProvider';
import Serverless from 'serverless';
import Plugin from 'serverless/lib/classes/Plugin';
import { toConfig, MultiStackConfig, StacksConfig, LifecyclePhases, StackConfig } from './models';
import _ from 'lodash';
import './lodash-async';
import { reload, restore, deploy, saveStack, printServiceHeader, remove, handleEntryPoint, cleanOptions } from './utils';

const CONFIG_SECTION = 'multi-stack';

type ServerlessCommand = (sls: Serverless) => Promise<Serverless>;

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
    this.settings = await toConfig(this.serverless);
  }

  async deployStacks() {
    if (!this.settings) {
      this.serverless.cli.log(`No stacks found. Missing [${CONFIG_SECTION}] section. Skipping multi-stack deploys...`)
      return;
    }

    const copy = _(this.serverless).cloneDeep();
    await this.executeCommandPipeline(
      this.settings.stacks,
      deploy
    );

    this.serverless.cli.log(`Restoring ${copy.service.getServiceName()}...`);
    restore(copy, this.serverless);
  }

  async removeStacks() {
    await this.configureSettings();

    debugger;

    if (!this.settings) {
      this.serverless.cli.log(`No stacks found. Missing [${CONFIG_SECTION}] section. Skipping multi-stack removals...`)
      return;
    }

    const reversedStacks = Object.keys(this.settings.stacks).reduceRight((obj, key) => {
      obj[key] = this.settings.stacks[key];
      return obj;
    }, {} as StacksConfig);

    const copy = _(this.serverless).cloneDeep();
    await this.executeCommandPipeline(
      reversedStacks,
      'beforeRemove',
      'afterRemove',
      remove
    );

    this.serverless.cli.log(`Restoring ${copy.service.getServiceName()}...`);
    restore(copy, this.serverless);
  }

  async executeCommandPipeline(stacks: StackConfig[], cmd: ServerlessCommand) {
    const savedStacks = [] as Serverless[];
    let options = { ...this.options };
    for (const stack of stacks) {
      options = { ...options, ...stack, config: location };

      await _.flowAsync(
        handleEntryPoint(before, stack[before], options, savedStacks),
        cleanOptions(options),
        reload(options),
        printServiceHeader,
        saveStack(savedStacks),
        cmd,
        handleEntryPoint(after, stack[after], options, savedStacks)
      )(this.serverless);
    }
  }

}

export = MultiStackPlugin;