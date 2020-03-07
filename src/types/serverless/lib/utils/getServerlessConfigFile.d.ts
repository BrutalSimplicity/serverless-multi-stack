import Serverless = require('../../index');
import _ from 'lodash';
import { stringify } from 'querystring';

export var getServerlessConfigFile: {
  (serverless: Serverless): any;
  cache: _.MapCache;
}
