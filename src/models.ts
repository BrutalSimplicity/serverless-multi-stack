import * as Serverless from 'serverless';
import { existsSync } from 'fs';
import assert from 'assert';

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

export type ServerlessOptions = Serverless.Options & { [key: string]: any };

export function toConfig(settings: any): MultiStackConfig | undefined {
  if (!settings) return undefined;
  assert(settings.stacks, '[stacks] is a required field');
  assert(settings.regions, '[regions] is a required field');

  const stacks = Object.keys(settings.stacks)
    .reduce((stacks, stackLocation) => {
      assert(existsSync(stackLocation), `unable to locate ${stackLocation}`);
      stacks[stackLocation] = settings.stacks[stackLocation];
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