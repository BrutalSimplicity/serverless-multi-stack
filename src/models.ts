import { existsSync } from 'fs';
import assert from 'assert';
import _ from 'lodash';
import { handleEntryPoint, importDynamic } from './utils';

export interface Properties {
  [props: string]: any;
}

export type ValidEntryPoints = 'handler' | 'shell';

export interface HandlerEntryPoint {
  type: 'handler';
  handler: string;
}

export interface ShellEntryPoint  {
  type: 'shell';
  shell: string;
}

export type EntryPoint = HandlerEntryPoint | ShellEntryPoint;

export type LifecyclePhases = 'beforeDeploy' | 'afterDeploy' | 'beforeRemove' | 'afterRemove';
export const LifecyclePhases = ['beforeDeploy', 'afterDeploy', 'beforeRemove', 'afterRemove'];

export type LifecycleEntryPoint = {
  [key in LifecyclePhases]?: EntryPoint;
}

export type StackProps = Properties & LifecycleEntryPoint;

export interface StacksConfig {
  [stackLocation: string]: StackProps;
}


export interface MultiStackConfig {
  stacks: StacksConfig;
  regions: {
    [region: string]: StacksConfig;
  }
}

export async function toConfig(settings: any) : Promise<MultiStackConfig | undefined> {
  if (!settings) return undefined;
  assert(settings.stacks, '[stacks] is a required field');
  assert(settings.regions, '[regions] is a required field');

  const stacks = {} as StacksConfig;
  for (const [location, stack] of Object.entries(settings.stacks)) {
    assert(existsSync(location), `unable to locate ${location}`);
    stacks[location] = await toStackProps(stack);
  }
  
  const regions = {} as { [region: string]: StacksConfig };
  for (const [region, stacks] of Object.entries<StacksConfig>(settings.regions)) {
    if (stacks) {
      for (const [location, props] of Object.entries(stacks)) {
        assert(existsSync(location), `unable to locate ${location}`);
        stacks[location] = await toStackProps(props);
      }
    }
    regions[region] = stacks;
  }

  return {
    stacks,
    regions
  } as MultiStackConfig;
}

async function toStackProps(props: any): Promise<StackProps> {
  const stackProps = {} as StackProps;
  if (!props) return stackProps;
  for (const [key, obj] of Object.entries<any>(props)) {
    stackProps[key] = obj;
    if (obj && LifecyclePhases.includes(key)) {
      if (obj.handler) {
        assert(obj.handler, `[handler] is a requried field for ${key}`);
        const sliceIndex = obj.handler.lastIndexOf('.')
        assert(sliceIndex >= 0, '[handler] syntax is invalid should be of the form ./path.handler');
        const [path, handler] = [obj.handler.slice(null, sliceIndex), obj.handler.slice(sliceIndex+1)];
        const module = await importDynamic(path);
        assert(module, `[handler] unable to find module for ${key}`);
        assert(module[handler], `[handler] unable to resolve module handler for ${key}. Be sure the method has been exported.`);
        stackProps[key] = {
          type: 'handler',
          handler: obj.handler
        } as HandlerEntryPoint;
      }
      else if (obj.shell) {
        assert(obj.shell, `[shell] is a requried field for ${key}`);
        stackProps[key] = {
          type: 'shell',
          shell: obj.shell
        } as ShellEntryPoint;
      }
    }
  }
  return stackProps;
}


export function applyRegionalOverrides(stacksConfig: StacksConfig, regionConfig: StacksConfig): StacksConfig {
  return {
    ...stacksConfig,
    ...regionConfig
  }
}