import { existsSync } from 'fs';
import assert from 'assert';
import _ from 'lodash';

export interface Properties {
  [props: string]: any;
}

export type ValidEntryPoints = 'handler' | 'shell';

interface HandlerEntryPoint {
  handler: string;
}

interface ShellEntryPoint  {
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

export function toConfig(settings: any): MultiStackConfig | undefined {
  if (!settings) return undefined;
  assert(settings.stacks, '[stacks] is a required field');
  assert(settings.regions, '[regions] is a required field');
  const validRegionStacks = _(settings.regions)
    .filter(regionStacks => !_.isEmpty(regionStacks))
    .reduce((stacks, regionStacks) => _(stacks).assign(regionStacks).value(), {}) as StacksConfig;

  const stacks = _(settings.stacks)
    .assign(validRegionStacks)
    .entries()
    .reduce((stacks, [location, stack]) => {
      assert(existsSync(location), `unable to locate ${location}`);
      stacks[location] = stack;
      return stacks;
    }, {} as StacksConfig)

  return {
    stacks,
    regions: settings.regions
  } as MultiStackConfig;
}

export function applyRegionalOverrides(stacksConfig: StacksConfig, regionConfig: StacksConfig): StacksConfig {
  return {
    ...stacksConfig,
    ...regionConfig
  }
}