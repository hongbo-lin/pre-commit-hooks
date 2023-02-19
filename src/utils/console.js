const pc = require("picocolors");

const consoleInfo = (message) => console.info(pc.cyan(message));

const consoleWarn = (message) => console.warn(pc.yellow(message));

const consoleError = (message) => console.error(pc.red(message));

const consoleSuccess = (message) => console.log(pc.green(message));

module.exports = { consoleError, consoleInfo, consoleSuccess, consoleWarn };
