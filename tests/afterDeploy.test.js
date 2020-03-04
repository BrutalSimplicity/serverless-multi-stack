
function handler(serverless, options, stacks) {
    options.handlerCalled = true;
    options.stacks = stacks;
    options.serverless = serverless;
}

module.exports = {
    handler
};