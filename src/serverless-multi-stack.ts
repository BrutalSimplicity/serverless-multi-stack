import AwsProvider from 'serverless/lib/plugins/aws/provider/awsProvider';
import Serverless from 'serverless';
import Plugin from 'serverless/lib/classes/Plugin';
import { toConfig, MultiStackConfig, StacksConfig, EntryPoint, LifecyclePhases } from './models';
import _ from 'lodash';
import './lodash-async';
import { reload, restore, deploy, saveStack, printServiceHeader, remove, handleEntryPoint } from './utils';

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
    this.settings = await toConfig(this.serverless.service?.custom?.[CONFIG_SECTION]);
  }

  async deployStacks() {
    // if (MultiStackPlugin.started) return;
    // MultiStackPlugin.started = true;
    if (!this.settings) {
      this.serverless.cli.log(`No stacks found. Missing [${CONFIG_SECTION}] section. Skipping multi-stack deploys...`)
      return;
    }

    const copy = _(this.serverless).cloneDeep();
    await this.executeCommandPipeline(
      this.settings.stacks,
      'beforeDeploy',
      'afterDeploy',
      deploy
    );

    this.serverless.cli.log(`Restoring ${copy.service.getServiceName()}...`);
    restore(this.serverless, copy);
  }

  async removeStacks() {
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
    restore(this.serverless, copy);
  }

  async executeCommandPipeline(stacks: StacksConfig, before: LifecyclePhases, after: LifecyclePhases, cmd: ServerlessCommand) {
    const savedStacks = [] as Serverless[];
    let options = { ...this.options };
    for (const [location, stack] of Object.entries(stacks)) {
      options = { ...options, ...stack, config: location };

      await _.flowAsync(
        handleEntryPoint(before, stack[before], options, savedStacks),
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