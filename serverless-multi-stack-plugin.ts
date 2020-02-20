import Serverless = require("serverless");
import AwsProvider = require("serverless/plugins/aws/provider/awsProvider");
import Plugin = require("serverless/classes/Plugin");

interface Properties {
  [props: string]: string;
}

type ValidEntryPoints = 'handler' | 'shell';

type EntryPoint = {
  [key in ValidEntryPoints]: string;
}

type LifecyclePhases = 'beforeDeploy' | 'afterDeploy' | 'beforeRemove' | 'afterRemove';

type LifecycleEntryPoint = {
  [key in LifecyclePhases]?: EntryPoint;
}

interface StacksConfig {
  [stackLocation: string]: Properties & LifecycleEntryPoint;
}

interface MultiStackConfig {
  name: string;
  stacks: StacksConfig;
  regions: {
    [region: string]: StacksConfig;
  }
}

type ServerlessOptions = Serverless.Options & { [key: string]: any };

class MultiStackPlugin implements Plugin {
  readonly serverless: Serverless;
  readonly provider: AwsProvider;
  readonly options: ServerlessOptions;
  readonly hooks: Plugin.Hooks;

  constructor(serverless: Serverless, options: ServerlessOptions) {
    this.serverless = serverless;
    this.provider = serverless.getProvider('aws');
    this.options = options;
    this.hooks = {
      'after:deploy': this.deployStacks.bind(this)
    }
  }

  async deployStacks() {

  }
}

export = MultiStackPlugin;