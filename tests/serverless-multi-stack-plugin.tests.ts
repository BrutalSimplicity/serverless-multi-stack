import { expect } from 'chai';
import { toConfig } from '../src/models';
import { AssertionError } from 'assert';
import Serverless from 'serverless';
import PluginManager from 'serverless/classes/PluginManager';
import fs from 'fs';
import _ from 'lodash';
import yaml from 'js-yaml';

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

  describe('should return valid config', function () {
    const multiStack = {
      service: 'multi-stack',
      provider: {
        name: 'aws'
      },
      custom: {
        'multi-stack': {
          'stacks': {
            'serverless.1.yml': {
              setting1: 'true',
              setting2: 'false',
              afterDestroy: {
                shell: 'echo destroyed'
              }
            },
            'serverless.2.yml': null as any,
            'serverless.3.yml': {
              afterDeploy: {
                handler: 'afterDesploy.handler'
              }
            }
          },
          'regions': {
            'us-east-1': null as any,
          }
        }
      }
    };
    const stacks = {
      'serverless.1.yml': {
        service: 'service-1'
      },
      'serverless.2.yml': {
        service: 'service-1'
      },
      'serverless.3.yml': {
        service: 'service-1'
      }
    };

    const config = 'serverless.yml';
    const servicePath = process.cwd();
    const serverless = new Serverless({ servicePath });
    const options = { stage: 'dev', region: 'us-east-1', config };

    before('create serverless stacks', async function () {

      _(stacks).forOwn((stack, location) => {
        fs.writeFileSync(location, yaml.safeDump(stack), { flag: 'w+' });
      });

      fs.writeFileSync('serverless.yml', yaml.safeDump(multiStack), { flag: 'w+' });

      serverless.processedInput = {
        commands: [],
        options
      };
      await serverless.service.load(options);
    })

    it('should return valid stack and region references', function () {
      expect(serverless.service.custom?.['multi-stack']).to.not.be.null;
      const config = toConfig(serverless.service.custom['multi-stack']);

      console.log(config);
    })

    after('destroy serverless stacks', function () {
      fs.unlinkSync('serverless.yml');
      _(stacks).forOwn((_, location) => fs.unlinkSync(location));
    })
  })
})
