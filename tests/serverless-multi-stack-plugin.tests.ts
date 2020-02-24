import { AssertionError } from 'assert';
import { expect } from 'chai';
import fs from 'fs';
import yaml from 'js-yaml';
import _ from 'lodash';
import '../src/lodash-async';
import Serverless from 'serverless';
import sinon from 'sinon';
import { MultiStackConfig, toConfig } from '../src/models';
import MultiStackPlugin from '../src/serverless-multi-stack';

const multiStack = {
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
    } as MultiStackConfig
  }
};
const stacks = {
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
};

describe('MultiStackPlugin', function () {
  describe('should throw when config is invalid', function () {
    let tests =
      [
        {
          name: 'should throw when missing region',
          input: {
            stacks: {
              'serverless.1.yml': {},
              'serverless.2.yml': {}
            }
          }
        },
        {
          name: 'should throw when config not provided',
          input: {}
        },
        {
          name: 'should throw when required param is misspelled',
          input: {
            staks: {
              'serverless.1.yml': {},
              'serverless.2.yml': {}
            }
          }
        },
        {
          name: 'should throw when files don\'t exist',
          input: {
            stacks: {
              'serverless.1.yml': {},
              'serverless.2.yml': {}
            },
            regions: {
              'us-east-1': {}
            }
          }
        }
      ];

    tests.forEach(test => {
      it(test.name, function () {
        expect(() => toConfig(test.input)).to.throw(AssertionError);
      })
    })
  })

  describe('lodash-async', function() {
    it('should return result from async flow', async function() {
      type TestType = { a: string, x: number, y: number } | {};

      const async1 = _.curry((state: TestType): Promise<TestType> => {
        return Promise.resolve({ ...state, a: 'aa' });
      })
      const async2 = _.curry((state: TestType): Promise<TestType> => {
        return Promise.resolve(state);
      })
      const async3 = _.curry((state: any): Promise<TestType> => {
        _(state).forOwn((v, k) => {
          if (_.isNumber(v)) {
            state[k] = v * 2;
          }
        })
        return Promise.resolve(state);
      })

      const actual = await _.flowAsync(
        async1,
        async2,
        async3
      )({ a: 'a', x: 1, y: 2 });

      const expected = { a: 'aa', x: 2, y: 4 };

      expect(actual).to.deep.equal(expected);
    })
  })

  describe('validate serverless plugin pipeline', function () {
    const servicePath = process.cwd();
    const config = 'serverless.yml';
    const options = { stage: 'dev', region: 'us-east-1', config };
    const serverless = new Serverless({ servicePath });

    before('create serverless stacks', async function () {
      _(stacks).forOwn((stack, location) => {
        fs.writeFileSync(location, yaml.safeDump(stack), { flag: 'w+' });
      });

      fs.writeFileSync('serverless.yml', yaml.safeDump(multiStack), { flag: 'w+' });

      serverless.processedInput = {
        commands: {},
        options
      };
      await serverless.service.load(options);
    })

    it('should throw when region stack does not exist', function() {
      const stacks = _(multiStack).cloneDeep();
      stacks.custom["multi-stack"].regions['us-east-1']['serverless.4.yml'] = {};

      expect(() => toConfig(stacks.custom['multi-stack'])).to.throw(AssertionError);
    })

    it('should map valid MultiStackConfig', function () {
      expect(serverless.service.custom?.['multi-stack']).to.not.be.null;

      const config = toConfig(serverless.service.custom['multi-stack']);
      expect(config).to.deep.equal(multiStack.custom['multi-stack']);
    })

    it('should have valid plugin configuration', function() {
      const plugin = new MultiStackPlugin(serverless, options);
      const hooks = plugin.hooks;

      expect(hooks['after:deploy:deploy'].name).to.include(plugin.deployStacks.name);
      expect(hooks['before:remove:remove'].name).to.include(plugin.removeStacks.name);
    })

    it('should call deploy for each stack', async function() {
      const plugin = new MultiStackPlugin(serverless, options);

      const stacks = [] as Serverless[];
      serverless.pluginManager.spawn = (__) => { stacks.push(_(serverless).cloneDeep()); return Promise.resolve() };
      serverless.cli = {
        log: (_) => {},
        setLoadedCommands: (_) => {},
        setLoadedPlugins: (_) => {}
      };

      await plugin.deployStacks();

      expect(stacks).length(3);
      _(stacks)
      .zip(['service-1', 'service-2', 'service-3'])
      .forEach(pair => {
        expect(pair[0].service.getServiceName()).to.equal(pair[1]);
      })
    })

    after('destroy serverless stacks', function () {
      fs.unlinkSync('serverless.yml');
      _(stacks).forOwn((_, location) => fs.unlinkSync(location));
    })
  })
})
