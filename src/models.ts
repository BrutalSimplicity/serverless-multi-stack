import { existsSync } from 'fs';
import assert, { AssertionError } from 'assert';
import _ from 'lodash';
import { importDynamic, assertNever, remove } from './utils';
import Serverless from 'serverless';
import { MultiStackSchema, RegionsSchema, StacksSchema } from './schema';

export const CUSTOM_SECTION = 'multi-stack';
export type Subset<T, U extends T> = U;

export const AWS_REGIONS = ['us-east-2', 'us-east-1', 'us-west-1', 'us-west-2', 'ap-east-1', 'ap-south-1', 'ap-northeast-3', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ca-central-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1', 'me-south-1', 'sa-east-1'] as const;
export type AwsRegion = typeof AWS_REGIONS[number];

export const LIFECYCLE_PHASES = ['beforeDeploy', 'afterDeploy', 'beforeRemove', 'afterRemove'] as const;
export type LifecyclePhase = typeof LIFECYCLE_PHASES[number];
export type DeployLifecyclePhase = Subset<LifecyclePhase, 'beforeDeploy' | 'afterDeploy'>
export type RemoveLifecyclePhase = Subset<LifecyclePhase, 'beforeRemove' | 'afterRemove'>;

export interface Properties {
  [props: string]: any;
}

export const VALID_ENTRY_POINTS = ['handler', 'shell'] as const;
export type ValidEntryPoint = typeof VALID_ENTRY_POINTS[number];

export interface HandlerEntryPoint {
  type: 'handler';
  handler: string;
}

export interface ShellEntryPoint  {
  type: 'shell';
  shell: string;
}

export type EntryPoint = HandlerEntryPoint | ShellEntryPoint;

export type Command = 'deploy' | 'remove';

export type LifecycleEntryPoint = {
  phase: LifecyclePhase;
  entryPoint: EntryPoint;
}

export type StackProps = Properties & LifecycleEntryPoint;

export interface StackParameters {
  [key: string]: any;
}

export type CommandEntryPoints = {
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

  const stacks = [] as StackConfig[];
  for (const [location, stack] of Object.entries(settings.stacks)) {
    stacks.push(await toStackConfig(location, stack, regionNames));
  }
  
  const regionalStacks = [] as StackConfig[];
  for (const [region, stacks] of Object.entries<StacksSchema>(settings.regions)) {
    if (stacks) {
      for (const [location, stack] of Object.entries(stacks)) {
        regionalStacks.push(await toStackConfig(location, stack, [region], true));
      }
    }
  }

  return {
    stacks: mergeAndOrderStacks(stacks, regionalStacks)
  }
}

const assertRegions = (regions: string[]) => {
  for (const region of regions) {
    assert(isRegion(region), `[region] invalid region specified: ${region}`);
  }
}

const isRegion = (region: string): region is AwsRegion => {
  return AWS_REGIONS.includes(region as AwsRegion);
}

const toStackConfig = async(location: string, props: any, regions: string[], isRegional: boolean = false): Promise<StackConfig> => {
  assert(existsSync(location), `unable to locate ${location}`);
  const stackConfig = {
    location,
    regions,
    isRegional,
    priority: 0
  } as StackConfig;

  if (!props) return stackConfig;

  for (const [key, obj] of Object.entries<any>(props)) {
    if (key === 'priority') {
      stackConfig.priority = parseInt(obj);
    }
    else if (isLifecyclePhase(key)) {
      const command = getCommand(key);
      let entryPoint: EntryPoint;
      const phase = key as LifecyclePhase;
      if (obj.handler) {
        await assertHandler(phase, obj.handler);
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
        throw new AssertionError({ message: `[EntryPoint] ${key} is missing one of the following properties: ${VALID_ENTRY_POINTS.join(',')}` });
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

const isLifecyclePhase = (phase: string): phase is LifecyclePhase => {
  return LIFECYCLE_PHASES.includes(phase as LifecyclePhase);
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
    .map((stack, index) => ({ stack, index }))  // pass along index to preserve order
    .groupBy(({ stack }) => stack.location)
    .flatMap(group => {
      if (group.length > 1) {
        const global = group.find(obj => !obj.stack.isRegional);
        const excludedRegions = _(group).filter(obj => obj.stack.isRegional).flatMap(obj => obj.stack.regions).value();
        global.stack.regions = _(global.stack.regions).difference(excludedRegions).value();
      }
      return group;
    })
    .orderBy(obj => obj.index)
    .orderBy(obj => obj.stack.priority, 'desc')
    .map(obj => obj.stack)
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
