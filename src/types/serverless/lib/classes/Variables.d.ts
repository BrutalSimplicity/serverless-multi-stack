import Serverless = require('../../index');

declare class Variables {
    constructor(serverless: Serverless);

    populateService(options: Serverless.Options): Promise<void>;
}

export = Variables;
