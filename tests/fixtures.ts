
export const multiStack = {
  service: 'multi-stack',
  provider: {
    name: 'aws'
  },
  custom: {
    'multi-stack': {
      stacks: {
        'serverless.1.yml': {
          setting1: true,
          setting2: false,
          beforeRemove: {
            shell: 'echo test'
          }
        },
        'serverless.2.yml': {},
        'serverless.3.yml': {
          afterDeploy: {
            handler: 'afterDeploy.handler'
          }
        }
      },
      regions: {
        'us-east-1': {}
      }
    }
  }
} as any;

export const stacks = {
  'serverless.1.yml': {
    service: 'service-1',
    provider: {
      name: 'aws'
    }
  },
  'serverless.2.yml': {
    service: 'service-2',
    provider: {
      name: 'aws'
    }
  },
  'serverless.3.yml': {
    service: 'service-3',
    provider: {
      name: 'aws'
    }
  }
} as any;
