export const SCHEMA_PHASES = ['beforeDeploy', 'afterDeploy', 'beforeRemove', 'afterRemove'] as const;
export type SchemaPhase = typeof SCHEMA_PHASES[number];

export interface StacksSchema {
  [stackLocation: string]: {
    [key: string]: any;
  };
}

export interface RegionsSchema {
  [region: string]: StacksSchema;
}


export interface MultiStackSchema {
  stacks: StacksSchema;
  regions: RegionsSchema
}