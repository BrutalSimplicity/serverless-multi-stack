import { existsSync } from 'fs';
import assert from 'assert';
import _ from 'lodash';

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

export type LifecycleEntryPoint = {
  [key in LifecyclePhases]?: EntryPoint;
}

export interface StacksConfig {
  [stackLocation: string]: Properties & LifecycleEntryPoint;
}

export interface MultiStackConfig {
  stacks: StacksConfig;
  regions: {
    [region: string]: StacksConfig;
  }
}

export async function toConfig(settings: any): Promise<MultiStackConfig | undefined> {
  if (!settings) return undefined;
  assert(settings.stacks, '[stacks] is a required field');
  assert(settings.regions, '[regions] is a required field');

  const stacks = {} as StacksConfig;
  for (const [location, stack] of Object.entries(stacks)) {
    assert(existsSync(location), `unable to locate ${location}`);
    stacks[location] = stack;
    await validateEntryPoints(stack);
  }
  
  const regions = {} as { [region: string]: StacksConfig };
  for (const [region, stacks] of Object.entries(settings.regions)) {
    const stacksEntity = stacks as StacksConfig;
    if (stacksEntity) {
      for (const [location, stack] of Object.entries(stacks)) {
        assert(existsSync(location), `unable to locate ${location}`);
        stacksEntity[location] = stack;
        await validateEntryPoints(stack);
      }
    }
    regions[region] = stacksEntity;
  }

  return {
    stacks,
    regions
  } as MultiStackConfig;
}

async function validateEntryPoints(stack: Properties & LifecycleEntryPoint) {
  for (const [key, val] of Object.entries(stack)) {
    const entryPoint = val as EntryPoint;
    if (entryPoint) {
      if (entryPoint.type === 'handler') {
        assert(entryPoint.handler, `[handler] is a requried field for ${key}`);
        const [path, handler] = entryPoint.handler.split('.');
        const module = await import(path);
        assert(module, `[handler] unable to find module for ${key}`);
        assert(module[handler], `[handler] unable to resolve module handler for ${key}. Be sure the method has been exported.`);
      }
      else if (entryPoint.type === 'shell') {
        assert(entryPoint.shell, `[shell] is a requried field for ${key}`);
      }
    }
  }
}


export function applyRegionalOverrides(stacksConfig: StacksConfig, regionConfig: StacksConfig): StacksConfig {
  return {
    ...stacksConfig,
    ...regionConfig
  }
}