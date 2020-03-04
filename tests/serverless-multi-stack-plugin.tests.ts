import { AssertionError } from 'assert';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import fs from 'fs';
import cp from 'child_process';
import yaml from 'js-yaml';
import _ from 'lodash';
import '../src/lodash-async';
import Serverless from 'serverless';
import { toConfig } from '../src/models';
import * as utils from '../src/utils';
import { multiStack, stacks } from './fixtures';
import MultiStackPlugin from '../src/serverless-multi-stack';
import PluginManager from 'serverless/lib/classes/PluginManager';

use(chaiAsPromised);
use(sinonChai);
const mockHandler = sinon.fake.returns(true);

describe('MultiStackPlugin', function () {
  beforeEach(function() {
    sinon.replace(utils, 'importDynamic', s => Promise.resolve({
      handler: mockHandler
    }));
  })

  afterEach(function() {
    sinon.restore();
  })

  describe('should fail when config is invalid', function () {
    let tests =
      [
        {
          name: 'should fail when missing region',
          input: {
            stacks: {
              'serverless.1.yml': {},
              'serverless.2.yml': {}
            }
          }
        },
        {
          name: 'should fail when config not provided',
          input: {}
        },
        {
          name: 'should fail when required param is misspelled',
          input: {
            staks: {
              'serverless.1.yml': {},
              'serverless.2.yml': {}
            }
          }
        },
        {
          name: 'should fail when files don\'t exist',
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

    for (const [_, test] of Object.entries(tests)) {
      it(test.name, async function () {
        await expect(toConfig(test.input)).to.be.rejectedWith(AssertionError);
      })
    }

    it('should fail when region stack does not exist', async function() {
      const stacks = _(multiStack).cloneDeep() as any;
      stacks.custom["multi-stack"].regions['us-east-1']['serverless.4.yml'] = {};

      await expect(toConfig(stacks.custom['multi-stack'])).to.be.rejectedWith(AssertionError);
    })

  })

  describe('should return validated config', async function() {
    it('should return valid config for shell entry point', async function() {
      sinon.stub(fs, 'existsSync').returns(true);

      const testMultiStack = _(multiStack).cloneDeep() as any;

      delete testMultiStack.custom["multi-stack"].stacks['serverless.3.yml'];

      const config = await toConfig(testMultiStack.custom['multi-stack']);

      expect(config).to.not.be.empty;
      expect(config.stacks['serverless.1.yml'].beforeDeploy).to.not.be.empty;
      expect(config.stacks['serverless.1.yml'].beforeDeploy.type).to.equal('shell');
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

    it('should map valid MultiStackConfig', async function () {
      expect(serverless.service.custom?.['multi-stack']).to.not.be.null;

      const expected = _(serverless.service.custom['multi-stack']).cloneDeep() as any;
      expected.stacks['serverless.1.yml'].beforeDeploy.type = 'shell';
      expected.stacks['serverless.3.yml'].afterDeploy.type = 'handler';

      const config = await toConfig(serverless.service.custom['multi-stack']);
      expect(config).to.deep.equal(expected);
    })

    it('should have valid plugin configuration', function() {
      const plugin = new MultiStackPlugin(serverless, options);
      const hooks = plugin.hooks;

      expect(hooks['after:deploy:deploy'].name).to.include(plugin.deployStacks.name);
      expect(hooks['before:remove:remove'].name).to.include(plugin.removeStacks.name);
    })

    it('should call deploy for each stack', async function() {
      const plugin = new MultiStackPlugin(serverless, options);

      const callback = sinon.fake();
      PluginManager.prototype.spawn = callback;

      serverless.cli = {
        log: (_) => {},
        setLoadedCommands: (_) => {},
        setLoadedPlugins: (_) => {}
      };

      await plugin.configureSettings();
      await plugin.deployStacks();

      expect(callback).to.have.been.calledThrice;
      expect(mockHandler).to.have.been.calledOnce;
    })

    it('should call entryPoint handler', async function() {
      // need to setup our own fakes here... I know it's a mess!
      sinon.restore();
      const plugin = new MultiStackPlugin(serverless, options);

      const callback = sinon.fake();
      PluginManager.prototype.spawn = callback;

      serverless.cli = {
        log: (_) => {},
        setLoadedCommands: (_) => {},
        setLoadedPlugins: (_) => {}
      };

      const spy = sinon.spy(utils, 'handleEntryPoint');

      await plugin.configureSettings();
      await plugin.deployStacks();

      // the final call to the handler should inject additional properties
      // on the options object
      const opts = spy.args[spy.args.length-1][2];
      expect(opts.handlerCalled).to.be.true;
      expect(opts.stacks).to.not.be.empty;
      expect(opts.serverless).to.not.be.empty;
    })

    it('should call shell handler', async function() {
      const plugin = new MultiStackPlugin(serverless, options);

      const callback = sinon.fake();
      PluginManager.prototype.spawn = callback;

      serverless.cli = {
        log: (_) => {},
        setLoadedCommands: (_) => {},
        setLoadedPlugins: (_) => {}
      };

      const spy = sinon.spy(cp, 'execSync');

      await plugin.configureSettings();
      await plugin.deployStacks();

      expect(spy.calledOnce).to.be.true;
    })

    after('destroy serverless stacks', function () {
      fs.unlinkSync('serverless.yml');
      _(stacks).forOwn((_, location) => fs.unlinkSync(location));
    })
  })
})
