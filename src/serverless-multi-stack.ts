import AwsProvider from 'serverless/lib/plugins/aws/provider/awsProvider';
import Serverless from 'serverless';
import Plugin, { Commands } from 'serverless/lib/classes/Plugin';
import { toConfig, MultiStackConfig, StackConfig, Command } from './models';
import _ from 'lodash';
import './lodash-async';
import { assertNever } from './utils';
import * as utils from './utils';

const CONFIG_SECTION = 'multi-stack';

type ServerlessCommand = (sls: Serverless) => Promise<Serverless>;

const handleEntryPoint = _.curry(utils.handleEntryPoint);
const printServiceHeader = _.curry(utils.printServiceHeader);
const reload = _.curry(utils.reload);
const restore = _.curry(utils.restore);
const deploy = _.curry(utils.deploy);
const saveStack = _.curry(utils.saveStack);
const remove = _.curry(utils.remove);

class MultiStackPlugin implements Plugin {
  readonly serverless: Serverless;
  readonly provider: AwsProvider;
  readonly options: Serverless.Options;
  readonly hooks: Plugin.Hooks;
  readonly commands: Commands;
  settings: MultiStackConfig;

  constructor(serverless: Serverless, options: Serverless.Options) {
    this.serverless = serverless;
    this.provider = serverless.getProvider('aws');
    this.options = options;
    this.commands = {
      stacks: {
        commands: {
          deploy: {
            usage: 'Deploy multiple serverless stacks',
            lifecycleEvents: ['deploy'],
          },
          remove: {
            lifecycleEvents: ['remove']
          }
        }
      }
    }
    this.hooks = {
      'before:stacks:deploy:deploy': this.configureSettings.bind(this),
      'stacks:deploy:deploy': this.deployStacks.bind(this),
      'before:stacks:remove:remove': this.removeStacks.bind(this)
    }
  }

  async configureSettings() {
    this.settings = await toConfig(this.serverless, this.options);
  }

  async deployStacks() {
    if (!this.settings) {
      this.serverless.cli.log(`No stacks found. Missing [${CONFIG_SECTION}] section. Skipping multi-stack deploys...`)
      return;
    }

    const copy = _(this.serverless).cloneDeep();
    await this.executeCommandPipeline('deploy', this.settings.stacks);

    this.serverless.cli.log(`Restoring ${copy.service.getServiceName()}...`);
    restore(copy, this.serverless);
  }

  async removeStacks() {
    await this.configureSettings();

    if (!this.settings) {
      this.serverless.cli.log(`No stacks found. Missing [${CONFIG_SECTION}] section. Skipping multi-stack removals...`)
      return;
    }

    const copy = _(this.serverless).cloneDeep();
    await this.executeCommandPipeline('remove', this.settings.stacks.reverse());

    this.serverless.cli.log(`Restoring ${copy.service.getServiceName()}...`);
    restore(copy, this.serverless);
  }

  async executeCommandPipeline(cmd: Command, stacks: StackConfig[]) {
    const savedStacks = [] as Serverless[];
    const slsCmd = this.getServerlessCommand(cmd);
    let options = { ...this.options };
    let stackCount = 1;
    for (const stack of stacks) {
      for (const region of stack.regions) {
        const entryPoint = stack.entryPoints?.[cmd];
        options = { ...options, config: stack.location, region };

        await _.flowAsync(
          reload(options),
          printServiceHeader(options, stackCount, stacks.length),
          saveStack(savedStacks),
          handleEntryPoint(entryPoint?.before, options, stack.parameters, savedStacks),
          (sls) => entryPoint?.before ? reload(options, sls) : sls,
          slsCmd,
          handleEntryPoint(entryPoint?.after, options, stack.parameters, savedStacks),
        )(this.serverless);
      }

      stackCount++;
    }
  }

  getServerlessCommand(cmd: Command) {
    switch (cmd) {
      case 'deploy':
        return deploy;
      case 'remove':
        return remove;
      default:
        assertNever(cmd);
    }
  }
}

export = MultiStackPlugin;