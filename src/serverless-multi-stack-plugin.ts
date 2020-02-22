import AwsProvider from 'serverless/plugins/aws/provider/awsProvider';
import * as Serverless from 'serverless';
import * as Plugin from 'serverless/classes/Plugin';
import { MultiStackConfig } from './models';

class MultiStackPlugin implements Plugin {
  readonly serverless: Serverless;
  readonly provider: AwsProvider;
  readonly options: Serverless.Options;
  readonly hooks: Plugin.Hooks;
  static started = false;

  constructor(serverless: Serverless, options: Serverless.Options) {
    this.serverless = serverless;
    this.provider = serverless.getProvider('aws');
    this.options = options;
    this.hooks = {
      'after:deploy:deploy': this.deployStacks.bind(this),
      'before:remove:remove': this.removeStacks.bind(this)
    }
  }

  toConfig(settings: any): MultiStackConfig {
    if (!settings.stacks) {
      throw Error('Missing required stacks parameter');
    }

    return {
      stacks: {
        blah: {}
      },
      regions: {

      }
    };

    // Object.keys(settings.stacks).reduce((stacks, stackLocation) => {
    //   const stack = settings.stacks[stackLocation];
      
    // }, {} as StacksConfig)
  }

  async deployStacks() {
    if (MultiStackPlugin.started) return;

    const pluginManager = this.serverless.pluginManager;
    const stackConfigs = this.toConfig(this.serverless.service.custom['multi-stack']);
  }

  async removeStacks() {

  }
}

export = MultiStackPlugin;