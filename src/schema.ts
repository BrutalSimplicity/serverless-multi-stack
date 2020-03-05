
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