import { existsSync } from 'fs';
import assert from 'assert';
import _ from 'lodash';

export interface Properties {
  [props: string]: string;
}

export type ValidEntryPoints = 'handler' | 'shell';

export type EntryPoint = {
  [key in ValidEntryPoints]: string;
}

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

  const stacks = _(settings.stacks)
    .map((o, k) => [k, o])
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