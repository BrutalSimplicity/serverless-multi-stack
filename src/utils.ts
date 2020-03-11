import Serverless, { Options } from 'serverless';
import PluginManager from 'serverless/lib/classes/PluginManager';
import _ from 'lodash';
import { EntryPoint, ShellEntryPoint, HandlerEntryPoint, LifecyclePhase, StackConfig, Command, StackParameters } from './models';
import { execSync } from 'child_process';
import { cwd } from 'process';
import Service from 'serverless/lib/classes/Service';
import Variables from 'serverless/lib/classes/Variables';
import { getServerlessConfigFile } from 'serverless/lib/utils/getServerlessConfigFile';

export const reload = async (options: Serverless.Options, serverless: Serverless): Promise<Serverless> => {
  serverless.cli.log('Reloading config.....');
  serverless.pluginManager = new PluginManager(serverless);
  serverless.service = new Service(serverless, {});
  serverless.variables = new Variables(serverless);
  const service = serverless.service;
  const pluginManager = serverless.pluginManager;
  const slsOptions = serverless.processedInput.options;
  slsOptions.config = options.config;
  slsOptions.region = options.region;
  cleanOptions(slsOptions);
  getServerlessConfigFile.cache.clear();


  await pluginManager.loadConfigFile()
    .then(() => service.load(slsOptions))
    .then(() => {
      pluginManager.setCliCommands(slsOptions);
      pluginManager.setCliOptions(slsOptions);
      return pluginManager.loadAllPlugins(serverless.service.plugins);
    })
    .then(() => {
      serverless.cli.setLoadedCommands(pluginManager.getCommands());
      serverless.cli.setLoadedPlugins(pluginManager.getPlugins());
      return pluginManager.updateAutocompleteCacheFile();
    })
    .then(() => {
      return serverless.variables.populateService(slsOptions)
    })
    .then(() => {
      service.mergeArrays();
      service.setFunctionNames(slsOptions);
      return service.validate();
    });
  
  return serverless;
}

const cleanOptions = (options: Serverless.Options) => {
  if (options.c) {
    options.config = options.config || options.c;
    delete options.c;
  }
  if (options.r) {
    options.region = options.region || options.r;
    delete options.r;
  }
}

export const deploy = async (serverless: Serverless): Promise<Serverless> => {
  serverless.cli.log('Deploying....');
  await serverless.pluginManager.spawn('deploy');
  return serverless;
}

export const remove = async (serverless: Serverless): Promise<Serverless> => {
  serverless.cli.log('Removing....');
  await serverless.pluginManager.spawn('remove');
  return serverless;
}

export const saveStack = (stacks: Serverless[], serverless: Serverless): Serverless => {
  const copy = _.cloneDeep(serverless);
  stacks.push(copy);
  return serverless;
}

export const restore = (copy: any, serverless: any): Serverless => {
  _.keys(serverless).forEach(key => {
    if (!copy[key]) {
        delete serverless[key];
    }
  });
  _.keys(copy).forEach(key => {
      serverless[key] = copy[key];
  });
  return serverless;
}

export const printServiceHeader = (options: Serverless.Options, stackCount: number, numStacks: number, serverless: Serverless): Serverless => {
  const serviceName = serverless.service.getServiceName();
  const headerLength = 50;
  serverless.cli.log(_.repeat('-', headerLength));
  serverless.cli.log(`${serviceName} - ${options.region} (${stackCount}/${numStacks})`);
  serverless.cli.log(_.repeat('-', headerLength));

  return serverless;
}

export const handleEntryPoint = async (entryPoint: EntryPoint, options: Options, params: StackParameters, stacks: Serverless[], serverless: Serverless) => {
  if (!entryPoint) return serverless;
  switch (entryPoint.type) {
    case 'handler':
      await entryPoint.handler(serverless, options, params, stacks);
      return serverless;
    case 'shell':
      executeShellEntryPoint(entryPoint, options, serverless);
      return serverless;
    default:
      assertNever(entryPoint);
  }
}

const executeShellEntryPoint = (entryPoint: ShellEntryPoint, options: Options, serverless: Serverless) => {
  const optionExports = _(options).map((opt, key) => `SLS_OPTS_${key}=${JSON.stringify(opt)}`).join('\n'); 
  const shell = `${optionExports}\n${entryPoint.shell}`;
  execSync(shell, { stdio: 'inherit', encoding: 'utf8' });
}

export const importDynamic = async (path: string) => {
  if (!path.startsWith('/')) {
    path = path.startsWith('./') ? path.replace('./', cwd() + '/') : cwd() + '/' + path;
  }
  return import(path);
}

export const assertNever = (x: never): never => {
  throw new Error('Unexpected object: ' + x);
}
