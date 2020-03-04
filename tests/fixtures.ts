
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
          beforeDeploy: {
            shell: 'echo "shell script executed"'
          }
        },
        'serverless.2.yml': {},
        'serverless.3.yml': {
          afterDeploy: {
            handler: './tests/afterDeploy.test.handler'
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
