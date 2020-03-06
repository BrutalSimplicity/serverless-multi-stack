import Serverless, { Options } from 'serverless';
import PluginManager from 'serverless/lib/classes/PluginManager';
import _ from 'lodash';
import { EntryPoint, ShellEntryPoint, HandlerEntryPoint, LifecyclePhase } from './models';
import { execSync } from 'child_process';
import { cwd } from 'process';
import Service from 'serverless/lib/classes/Service';
import Variables from 'serverless/lib/classes/Variables';

export const reload = _.curry(async (options: Serverless.Options, serverless: Serverless): Promise<Serverless> => {
  serverless.cli.log('Reloading config.....');
  serverless.pluginManager = new PluginManager(serverless);
  serverless.service = new Service(serverless, {});
  serverless.variables = new Variables(serverless);
  const service = serverless.service;
  const pluginManager = serverless.pluginManager;
  serverless.processedInput.options = options;

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

export const cleanOptions = _.curry((options: Serverless.Options, serverless: Serverless) => {
  if (options.c) {
    options.config = options.config || options.c;
    delete options.c;
  }
  if (options.r) {
    options.region = options.region || options.r;
    delete options.r;
  }
  return serverless;
});

export const deploy = _.curry(async (serverless: Serverless): Promise<Serverless> => {
  serverless.cli.log('Deploying....');
  await serverless.pluginManager.spawn('deploy');
  return serverless;
});

export const remove = _.curry(async (serverless: Serverless): Promise<Serverless> => {
  serverless.cli.log('Removing....');
  await serverless.pluginManager.spawn('remove');
  return serverless;
});

export const saveStack = _.curry((stacks: Serverless[], serverless: Serverless): Serverless => {
  const copy = _.cloneDeep(serverless);
  stacks.push(copy);
  return serverless;
})

export const restore = _.curry((copy: any, serverless: any): Serverless => {
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

export const printServiceHeader = _.curry((serverless: Serverless): Serverless => {
  const serviceName = serverless.service.getServiceName();
  const headerLength = 50;
  serverless.cli.log(_.repeat('-', headerLength));
  serverless.cli.log(serviceName);
  serverless.cli.log(_.repeat('-', headerLength));

  return serverless;
});

export const handleEntryPoint = _.curry(async (phase: LifecyclePhase, entryPoint: EntryPoint, options: Options, stacks: Serverless[], serverless: Serverless) => {
  if (!entryPoint) return serverless;
  if (entryPoint.type === 'shell') {
    executeShellEntryPoint(phase, entryPoint, options, serverless);
  }
  else if (entryPoint.type === 'handler') {
    await executeHandlerEntryPoint(phase, entryPoint, options, stacks, serverless);
  }
  return serverless;
});

const executeShellEntryPoint = (phase: LifecyclePhase, entryPoint: ShellEntryPoint, options: Options, serverless: Serverless) => {
  const optionExports = _(options).map((opt, key) => `SLS_OPTS_${key}=${JSON.stringify(opt)}`).join('\n'); 
  const shell = `${optionExports}\n${entryPoint.shell}`;
  execSync(shell, { stdio: 'inherit', encoding: 'utf8' });
}

const executeHandlerEntryPoint = async (phase: LifecyclePhase, entryPoint: HandlerEntryPoint, options: Options, stacks: Serverless[], serverless: Serverless) => {
  const lastIndex = entryPoint.handler.lastIndexOf('.');
  const [path, handler] = [entryPoint.handler.slice(null, lastIndex), entryPoint.handler.slice(lastIndex + 1)];
  return importDynamic(path)
    .then(module => module[handler](serverless, options, stacks));
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
