import Serverless = require("../../index");
import Plugin = require("./Plugin");

declare class PluginManager {
    constructor(serverless: Serverless)

    setCliOptions(options: Serverless.Options): void;
    setCliCommands(commands: {}): void;

    loadConfigFile(): Promise<void>;
    addPlugin(plugin: Plugin.PluginStatic): void;
    loadAllPlugins(servicePlugins: {}): Promise<void>;
    loadPlugins(plugins: {}): void;
    loadCorePlugins(): void;
    loadServicePlugins(servicePlugins: {}): void;
    loadCommand(pluginName: string, details: {}, key: string): {};
    loadCommands(pluginInstance: Plugin): void;
    spawn(commandsArray: string | string[], options?: any): Promise<void>;
    getPlugins(): Plugin[];
    getCommands(): Plugin.Commands;
    updateAutocompleteCacheFile(): Promise<void>;

    cliOptions: {};
    cliCommands: {};
    serverless: Serverless;
    plugins: Plugin[];
    commands: {};
    hooks: {};
    deprecatedEvents: {};
}

export = PluginManager;
