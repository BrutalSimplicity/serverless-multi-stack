// Type definitions for serverless 1.18
// Project: https://github.com/serverless/serverless#readme
// Definitions by: Hassan Khan <https://github.com/hassankhan>
//                 Jonathan M. Wilbur <https://github.com/JonathanWilbur>
//                 Alex Pavlenko <https://github.com/a-pavlenko>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

import Service = require('./lib/classes/Service');
import Plugin = require('./lib/classes/Plugin');
import PluginManager = require('./lib/classes/PluginManager');
import Utils = require('./lib/classes/Utils');
import YamlParser = require('./lib/classes/YamlParser');
import AwsProvider = require('./lib/plugins/aws/provider/awsProvider');
import { Commands } from './lib/classes/Plugin';

declare namespace Serverless {
    interface Options {
        function?: string;
        watch?: boolean;
        extraServicePath?: string;
        stage: string | null;
        region: string | null;
        noDeploy?: boolean;
        [key: string]: any;
    }

    interface Config {
        servicePath: string;
    }

    interface FunctionDefinition {
        name: string;
        package: Package;
        runtime?: string;
        handler: string;
        timeout?: number;
        memorySize?: number;
        environment?: { [name: string]: string };
    }

    interface Event {
        eventName: string;
    }

    interface Package {
        include: string[];
        exclude: string[];
        artifact?: string;
        individually?: boolean;
    }
}

declare class Serverless {
    constructor(config?: {});

    init(): Promise<any>;
    run(): Promise<any>;

    setProvider(name: string, provider: AwsProvider): null;
    getProvider(name: string): AwsProvider;

    getVersion(): string;

    cli: {
        log(message: string): void;
        setLoadedPlugins(plugins: Plugin[]): void;
        setLoadedCommands(commands: Commands): void;
    };

    providers: {};
    utils: Utils;
    variables: {
        populateService(options: Serverless.Options): Promise<void>;
    };
    yamlParser: YamlParser;
    pluginManager: PluginManager;

    config: Serverless.Config;
    serverlessDirPath: string;

    service: Service;
    version: string;
    processedInput: {
        commands: Plugin.Commands,
        options: Serverless.Options
    }
}

export = Serverless;
