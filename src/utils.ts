import Serverless, { Options } from 'serverless';
import PluginManager from 'serverless/lib/classes/PluginManager';
import _ from 'lodash';
import { EntryPoint, ShellEntryPoint, HandlerEntryPoint, LifecyclePhases } from './models';
import { execSync } from 'child_process';

const reload = _.curry(async (options: Serverless.Options, serverless: Serverless): Promise<Serverless> => {
  serverless.cli.log('Reloading config.....');
  serverless.pluginManager = new PluginManager(serverless);
  const service = serverless.service;
  const pluginManager = serverless.pluginManager;

  await pluginManager.loadConfigFile()
    .then(() => service.load(options))
    .then(() => {
      pluginManager.setCliCommands(serverless.processedInput.commands);
      pluginManager.setCliOptions(serverless.processedInput.options);
      return pluginManager.loadAllPlugins(serverless.service.plugins);
    })
    .then(() => {
      serverless.cli.setLoadedCommands(pluginManager.getCommands());
      serverless.cli.setLoadedPlugins(pluginManager.getPlugins());
      return pluginManager.updateAutocompleteCacheFile();
    })
    .then(() => {
      return serverless.variables.populateService(options)
    })
    .then(() => {
      service.mergeArrays();
      service.setFunctionNames(serverless.processedInput.options);
      return service.validate();
    });
  
  return serverless;
});

const deploy = _.curry(async (serverless: Serverless): Promise<Serverless> => {
  serverless.cli.log('Deploying....');
  await serverless.pluginManager.spawn('deploy');
  return serverless;
});

const remove = _.curry(async (serverless: Serverless): Promise<Serverless> => {
  serverless.cli.log('Removing....');
  await serverless.pluginManager.spawn('remove');
  return serverless;
});

const saveStack = _.curry((stacks: Serverless[], serverless: Serverless): Serverless => {
  const copy = _.cloneDeep(serverless);
  stacks.push(copy);
  return serverless;
})

const restore = _.curry((copy: any, serverless: any): Serverless => {
  _.keys(serverless).forEach(key => {
    if (!copy[key]) {
        delete serverless[key];
    }
  });
  _.keys(copy).forEach(key => {
      serverless[key] = copy[key];
  });
  return serverless;
});

const printServiceHeader = _.curry((serverless: Serverless): Serverless => {
  const serviceName = serverless.service.getServiceName();
  const headerLength = 50;
  serverless.cli.log(_.repeat('-', headerLength));
  serverless.cli.log(serviceName);
  serverless.cli.log(_.repeat('-', headerLength));

  return serverless;
});

const handleEntryPoint = _.curry(async (phase: LifecyclePhases, entryPoint: EntryPoint, options: Options, stacks: Serverless[], serverless: Serverless) => {
  if (!entryPoint) return serverless;
  if (entryPoint.type === 'shell') {
    executeShellEntryPoint(phase, entryPoint, options, serverless);
  }
  else if (entryPoint.type === 'handler') {
    await executeHandlerEntryPoint(phase, entryPoint, options, stacks, serverless);
  }
  return serverless;
});

const executeShellEntryPoint = (phase: LifecyclePhases, entryPoint: ShellEntryPoint, options: Options, serverless: Serverless) => {
  const optionExports = _(options).map((opt, key) => `SLS_OPTS_${key}=${JSON.stringify(opt)}`).join('\n'); 
  const shell = `${optionExports}\n${entryPoint.shell}`;
  const result = execSync(shell, { stdio: 'inherit', encoding: 'utf8' });

  options.shellResults = options.shellResults || {};
  options.shellResults[serverless.service.getServiceName()][phase] = result;
}

const executeHandlerEntryPoint = async (phase: LifecyclePhases, entryPoint: HandlerEntryPoint, options: Options, stacks: Serverless[], serverless: Serverless) => {
  const [path, handler] = entryPoint.handler.split('.');
  return importDynamic(path)
    .then(module => module[handler](serverless, options, stacks));
}

export const importDynamic = (path: string) => import(path);

export { reload, deploy, remove, restore, saveStack, printServiceHeader, handleEntryPoint };
