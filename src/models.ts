import { existsSync } from 'fs';
import assert, { AssertionError } from 'assert';
import _ from 'lodash';
import { importDynamic, assertNever, remove } from './utils';
import Serverless from 'serverless';
import { MultiStackSchema, RegionsSchema, StacksSchema } from './schema';

const CUSTOM_SECTION = 'multi-stack';
type Subset<T,U extends T> = U;

export const AWS_REGIONS = ['us-east-2', 'us-east-1', 'us-west-1', 'us-west-2', 'ap-east-1', 'ap-south-1', 'ap-northeast-3', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ca-central-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1', 'me-south-1', 'sa-east-1'] as const;
export type AwsRegion = typeof AWS_REGIONS[number];

export const LIFECYCLE_PHASES = ['beforeDeploy', 'afterDeploy', 'beforeRemove', 'afterRemove'] as const;
export type LifecyclePhase = typeof LIFECYCLE_PHASES[number];
export type DeployLifecyclePhase = Subset<LifecyclePhase, 'beforeDeploy' | 'afterDeploy'>
export type RemoveLifecyclePhase = Subset<LifecyclePhase, 'beforeRemove' | 'afterRemove'>;

export interface Properties {
  [props: string]: any;
}

export type ValidEntryPoint = 'handler' | 'shell';
export const ValidEntryPoints = ['handler', 'shell'];

export interface HandlerEntryPoint {
  type: 'handler';
  handler: string;
}

export interface ShellEntryPoint  {
  type: 'shell';
  shell: string;
}

export type EntryPoint = HandlerEntryPoint | ShellEntryPoint;

export const COMMANDS = ['deploy', 'remove'] as const;
export type Command = typeof COMMANDS[number];

export type LifecycleEntryPoint = {
  phase: LifecyclePhase;
  entryPoint: EntryPoint;
}

export type StackProps = Properties & LifecycleEntryPoint;

export interface StackParameters {
  [key: string]: any;
}

type CommandEntryPoints = {
  [key in Command]?: LifecycleEntryPoint;
}

export type StackConfig = {
  location: string;
  parameters: StackParameters;
  entryPoints: CommandEntryPoints;
  regions: AwsRegion[];
  priority: number;
  isRegional: boolean;
}

export interface StacksConfig {
  [stackLocation: string]: StackProps;
}


export interface MultiStackConfig {
  stacks: StackConfig[];
}

export const toConfig = async(serverless: Serverless) : Promise<MultiStackConfig | undefined> => {
  const settings = serverless?.service?.custom?.[CUSTOM_SECTION] as MultiStackSchema;
  if (!settings) return undefined;
  assert(settings.regions, '[regions] is a required field');

  const regionNames = Object.keys(settings.regions);
  assertRegions(regionNames);

  const stackLocations = Object.keys(settings.stacks);
  assert(_.uniq(stackLocations).length === stackLocations.length, '[stacks] duplicate global stacks found');

  const stacks = [] as StackConfig[];
  for (const [location, stack] of Object.entries(settings.stacks)) {
    assert(existsSync(location), `unable to locate ${location}`);
    stacks.push(await toStackConfig(location, stack, regionNames));
  }
  
  const regionalStacks = [] as StackConfig[];
  for (const [region, stacks] of Object.entries<StacksSchema>(settings.regions)) {
    const stackLocations = Object.keys(stacks);
    assert(_.uniq(stackLocations).length === stackLocations.length, `[regions] duplicate regional stacks found: ${region}`);
    if (stacks) {
      for (const [location, stack] of Object.entries(stacks)) {
        assert(existsSync(location), `unable to locate ${location}`);
        const validStack = await toStackConfig(location, stack, [region as AwsRegion]);
        validStack.isRegional = true;
        regionalStacks.push(validStack);
      }
    }
  }

  return {
    stacks: mergeAndOrderStacks(stacks, regionalStacks)
  }
}

const assertRegions = (regions: string[]) => {
  for (const region of regions) {
    assert(region in AWS_REGIONS, `[region] invalid region specified: ${region}`);
  }
}

const toStackConfig = async(location: string, props: any, regions: string[]): Promise<StackConfig> => {
  const stackConfig = {
    location,
    regions,
  } as StackConfig;

  if (!props) return stackConfig;

  for (const [key, obj] of Object.entries<any>(props)) {
    if (key === 'priority') {
      stackConfig.priority = parseInt(obj);
    }
    else if (key in LIFECYCLE_PHASES) {
      const command = getCommand(key);
      let entryPoint: EntryPoint;
      const phase = key as LifecyclePhase;
      if (obj.handler) {
        assertHandler(phase, obj.handler);
        entryPoint = {
          type: 'handler',
          handler: obj.handler
        };
      }
      else if (obj.shell) {
        assert(obj.shell, `[shell] is a requried field for ${key}`);
        entryPoint = {
          type: 'shell',
          shell: obj.shell
        };
      }
      else {
        throw new AssertionError({ message: `[EntryPoint] ${key} is missing one of the following properties: ${ValidEntryPoints.join(',')}` });
      }

      stackConfig.entryPoints = {
        [command]: {
          phase,
          entryPoint
        }
      }
    }
    else {
      stackConfig.parameters = stackConfig.parameters || {};
      stackConfig.parameters[key] = obj;
    }
  }

  return stackConfig;
}

const getCommand = (key: string): Command => {
  const phase = key as LifecyclePhase
  switch (phase) {
    case 'beforeDeploy':
    case 'afterDeploy':
      return 'deploy';
    case 'beforeRemove':
    case 'afterRemove':
      return 'remove';
    default:
      assertNever(phase);
  }
}

const mergeAndOrderStacks = (globalStacks: StackConfig[], regionalStacks: StackConfig[]) => {
  return _(globalStacks).concat(regionalStacks)
    .groupBy(stack => stack.location)
    .flatMap(group => {
      if (group.length > 1) {
        const globalStack = group.find(stack => !stack.isRegional);
        const excludedRegions = _(group).filter(stack => stack.isRegional).flatMap(stack => stack.regions).value();
        globalStack.regions = _(globalStack.regions).difference(excludedRegions).value();
      }
      return group;
    })
    .orderBy(stack => stack.priority, 'desc')
    .value();
}

export const assertHandler = async (phase: LifecyclePhase, handlerPath: string) => {
  assert(handlerPath, `[handler] is a requried field for ${phase}`);
  const sliceIndex = handlerPath.lastIndexOf('.')
  assert(sliceIndex >= 0, '[handler] syntax is invalid should be of the form ./path.handler');
  const [path, handler] = [handlerPath.slice(null, sliceIndex), handlerPath.slice(sliceIndex+1)];
  const module = await importDynamic(path);
  assert(module, `[handler] unable to find module for ${phase}`);
  assert(module[handler], `[handler] unable to resolve module handler for ${phase}. Be sure the method has been exported.`);
}
