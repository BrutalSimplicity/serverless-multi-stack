import { AssertionError } from 'assert';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { toConfig, CUSTOM_SECTION, HandlerEntryPoint, ShellEntryPoint } from '../src/models';
import Serverless from 'serverless';
import { MultiStackSchema } from '../src/schema';
import fs from 'fs';
import * as utils from '../src/utils';
import cp from 'child_process';

use(chaiAsPromised);

describe('#toConfig', function() {
  afterEach(function() {
    sinon.restore();
  })

  it('should fail when regions are not specified', async function() {
    const serverless = getServerlessMock({
      stacks: { 'a': {}, 'b': {}, 'c': {} }
    } as any);

    await expect(toConfig(serverless)).to.be.rejectedWith(AssertionError);
  })

  it('should fail when regions do not exist', async function() {
    const serverless = getServerlessMock({
      stacks: { 'a': {}, 'b': {}, 'c': {} },
      regions: { 'us-east-1': {}, 'us-west-2': {}, 'us-eas-2': {} }
    });

    await expect(toConfig(serverless)).to.be.rejectedWith(AssertionError);
  })

  it('should fail when there stacks do not exist', async function() {
    const serverless = getServerlessMock({
      stacks: { 'a': {}, 'b': {}, 'c': {} },
      regions: { 'us-east-1': {}, 'us-west-2': {}, 'us-east-2': {} }
    });

    await expect(toConfig(serverless)).to.be.rejectedWith(AssertionError);
  })

  it('should fail when valid entrypoint is missing', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const serverless = getServerlessMock({
      stacks: { 'a': { 'beforeDeploy': { 'exec': {} } }, 'b': {}, 'c': {} },
      regions: { 'us-east-1': {}, 'us-west-2': {}, 'us-east-2': {} }
    });
    
    await expect(toConfig(serverless)).to.be.rejectedWith(AssertionError);
  })

  it('should fail when handler entrypoint is missing', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const serverless = getServerlessMock({
      stacks: { 'a': { 'beforeDeploy': { 'handler': './path.handler' } }, 'b': {}, 'c': {} },
      regions: { 'us-east-1': {}, 'us-west-2': {}, 'us-east-2': {} }
    });
    
    await expect(toConfig(serverless)).to.be.rejectedWith(Error);
  })

  it('should fail when handler entrypoint method is missing', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const importDynamic = sinon.fake.returns({ differentHandler: () => {} });
    sinon.replace(utils, 'importDynamic', importDynamic);
    const serverless = getServerlessMock({
      stacks: { 'a': { 'beforeDeploy': { 'handler': './path.handler' } }, 'b': {}, 'c': {} },
      regions: { 'us-east-1': {}, 'us-west-2': {}, 'us-east-2': {} }
    });
    
    await expect(toConfig(serverless)).to.be.rejectedWith(AssertionError);
  })

  it('should fail when handler entrypoint syntax is invalid', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const serverless = getServerlessMock({
      stacks: { 'a': { 'beforeDeploy': { 'handler': 'blah' } }, 'b': {}, 'c': {} },
      regions: { 'us-east-1': {}, 'us-west-2': {}, 'us-east-2': {} }
    });
    
    await expect(toConfig(serverless)).to.be.rejectedWith(AssertionError);
  })

  it('should map stack', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const serverless = getServerlessMock({
      stacks: { 'a': {}, 'b': {} },
      regions: { 'us-east-1': {}, 'us-west-2': {} }
    });

    const config = await toConfig(serverless);

    expect(config.stacks[0].location).to.equal('a');
    expect(config.stacks[1].location).to.equal('b');
    expect(config.stacks[0].regions).to.have.members(['us-east-1', 'us-west-2'])
    expect(config.stacks[1].regions).to.have.members(['us-east-1', 'us-west-2'])
  })

  it('should map stack with properties', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const serverless = getServerlessMock({
      stacks: { 'a': { prop1: true, prop2: true } },
      regions: { 'us-east-1': {}, 'us-west-2': {}, 'us-east-2': {} }
    });

    const config = await toConfig(serverless);

    expect(config.stacks[0].parameters.prop1).to.be.true;
    expect(config.stacks[0].parameters.prop2).to.be.true;
  })

  it('should map and order stacks by priority', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const serverless = getServerlessMock({
      stacks: { 'a': {}, 'b': {}, 'c': { priority: 1 }, 'd': { priority: 2 } },
      regions: { 'us-east-1': {}, 'us-west-2': {}, 'us-east-2': {} }
    });

    const config = await toConfig(serverless);

    expect(config.stacks.length).to.equal(4);
    expect(config.stacks[0].location).to.equals('d');
    expect(config.stacks[1].location).to.equals('c');
  })

  it('should map global and regional stacks', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const serverless = getServerlessMock({
      stacks: { 'a': {}, 'b': {} },
      regions: { 'us-east-1': { 'c': {}, 'd': {} }, 'us-west-2': { 'e': {} }, 'us-east-2': {} }
    });

    const config = await toConfig(serverless);

    expect(config.stacks.length).to.equal(5);
    expect(config.stacks[0].location).to.equal('a');
    expect(config.stacks[1].location).to.equal('b');
    expect(config.stacks[2].location).to.equal('c');
    expect(config.stacks[2].isRegional).to.be.true;
    expect(config.stacks[3].location).to.equal('d');
    expect(config.stacks[3].isRegional).to.be.true;
    expect(config.stacks[4].location).to.equal('e');
    expect(config.stacks[4].isRegional).to.be.true;
  })

  it('should allow regional stacks to override global regions', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const serverless = getServerlessMock({
      stacks: { 'a': {}, 'b': {} },
      regions: { 'us-east-1': { 'a': {}, 'c': {} }, 'us-west-2': { 'b': {} }, 'us-east-2': {} }
    });

    const config = await toConfig(serverless);

    expect(config.stacks.length).to.equal(5);
    expect(config.stacks[0].regions).to.not.have.members(['us-east-1'])
    expect(config.stacks[1].regions).to.not.have.members(['us-west-2'])
  })

  it('should allow regional stacks to override global regions', async function() {
    sinon.replace(fs, 'existsSync', () => true);
    const serverless = getServerlessMock({
      stacks: { 'a': {}, 'b': {} },
      regions: { 'us-east-1': { 'a': {}, 'c': {} }, 'us-west-2': { 'b': {} }, 'us-east-2': {} }
    });

    const config = await toConfig(serverless);

    expect(config.stacks.length).to.equal(5);
    expect(config.stacks[0].regions).to.not.have.members(['us-east-1'])
    expect(config.stacks[1].regions).to.not.have.members(['us-west-2'])
  })

  it('should map stacks and entrypoint handlers', async function() {
    const importDynamic = sinon.fake.returns({ handler: () => {} });
    const execSync = sinon.fake();
    sinon.replace(fs, 'existsSync', () => true);
    sinon.replace(utils, 'importDynamic', importDynamic);
    sinon.replace(cp, 'execSync', execSync);

    const serverless = getServerlessMock({
      stacks: { 'a': { 'beforeDeploy': { handler: './path.handler' } }, 'b': { 'afterRemove': { 'shell': 'blah' } } },
      regions: { 'us-east-1': { 'a': {}, 'c': {} }, 'us-west-2': { 'b': {} }, 'us-east-2': {} }
    });

    const config = await toConfig(serverless);

    expect(config.stacks[0].entryPoints.deploy.phase).to.equal('beforeDeploy');
    expect(config.stacks[0].entryPoints.deploy.entryPoint.type).to.equal('handler');
    expect((config.stacks[0].entryPoints.deploy.entryPoint as HandlerEntryPoint).handler).to.equal('./path.handler')
    expect(config.stacks[1].entryPoints.remove.phase).to.equal('afterRemove');
    expect(config.stacks[1].entryPoints.remove.entryPoint.type).to.equal('shell');
    expect((config.stacks[1].entryPoints.remove.entryPoint as ShellEntryPoint).shell).to.equal('blah')
  });

})

const getServerlessMock = (settings: MultiStackSchema): Serverless => {
  const serverless = new Serverless();
  serverless.service.custom[CUSTOM_SECTION] = settings;
  return serverless;
}