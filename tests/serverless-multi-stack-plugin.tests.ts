import { expect } from 'chai';
import { toConfig } from '../src/models';
import { AssertionError } from 'assert';

describe('MultiStackPlugin', function () {
  it('should throw when config is invalid', function () {
    let inputs = 
      [{
        stacks: {
          'serverless.1.yml': {},
          'serverless.2.yml': {}
        }
      } as any,
      {
      },
      {
        staks: {
          'serverless.1.yml': {},
          'serverless.2.yml': {}
        }
      },
      // files don't exist
      {
        stacks: {
          'serverless.1.yml': {},
          'serverless.2.yml': {}
        },
        regions: {
          'us-east-1': {}
        }
      }];
    
    inputs.forEach(input => expect(() => toConfig(input)).to.throw(AssertionError));
  })
})
