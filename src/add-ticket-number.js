const cp = require("child_process");
const fs = require("fs");
const { Command, Option } = require("commander");

const { consoleInfo, consoleError, consoleSuccess, consoleWarn } = require("./utils/console");

const program = new Command();
program
    .argument("<filename>", ".git/COMMIT_EDITMSG file path")
    .addOption(new Option("-b, --branch-to-skip [branch]", "Branches to skip").default("^(main|master|develop|release/[0-9]+.[0-9]+.[0-9]+)$"))
    .addOption(new Option("-t --ticket [ticket]", "Ticket regex").default("(BCD|BLUEB)-[0-9]+"))
    .addOption(new Option("-m --message-pattern [message-pattern]").default("$JT: $CM"))
    .addOption(new Option("-s --skip [skip]").default("").env("SKIP"));

function getBranchName() {
    const cwd = process.cwd();

    const args = ['symbolic-ref', '--short', 'HEAD'];

    const { status, stderr, stdout } = cp.spawnSync('git', args, { cwd, encoding: 'utf-8' });
    if (status !== 0) {
        throw new Error(stderr.toString());
    }
    return stdout.toString().trim();
}

function skipEnvCheck(options, hookName) {
    if (options.skip && options.skip.split(",").includes(hookName)) {
        consoleInfo(`Skipping ${hookName} hook due to SKIP env var set.`)
        process.exit(0);
    }
}

function escapeReplacement(str) {
    return str.replace(/[$]/, '$$$$'); // In replacement to escape $ needs $$
}

function replaceMessageByPattern(ticketNumber, message, pattern) {
    const jiraTicketRegExp = new RegExp('\\$JT', "g");
    const messageRegExp = new RegExp('\\$CM', "g");
    const result = pattern
      .replace(jiraTicketRegExp, escapeReplacement(ticketNumber))
      .replace(messageRegExp, escapeReplacement(message));
  
    return result;
}

function updateCommitMsg(filePath, ticketNumber, pattern) {
    let commitMessage;
    try {
        commitMessage = fs.readFileSync(filePath, { encoding: "utf-8" });
    } catch (error) {
        consoleError(`Unable to read the file ${filePath}`);
        process.exit(1);
    }

    const cleanMessage = commitMessage
        .trim()
        .split("\n")
        .map((line) => line.trimStart())
        .filter((line) => !line.startsWith("#"));

    if (cleanMessage.includes(ticketNumber)) {
        consoleInfo("Commit mesage already contains branch ticket number.");
        process.exit(0);
    } else {
        consoleInfo("No ticket number");
        const messageWithTicket = replaceMessageByPattern(ticketNumber, commitMessage, pattern);

        try {
            fs.writeFileSync(filePath, messageWithTicket, { encoding: 'utf-8' });
        } catch (ex) {
            consoleError(`Unable to write the file "${filePath}".`);
            process.exit(1);
        }

        consoleSuccess(`Add ticket number ${ticketNumber} to commit message.`);
    }
}

function addTicketNumber() {
    program.parse();
    const options = program.opts();

    skipEnvCheck(options, "add-ticket-number");

    const branchName = getBranchName();
    const branchToSkipRegex = new RegExp(options.branchToSkip);

    if (branchName && branchToSkipRegex.test(branchName)) {
        consoleInfo(`${branchName} matches branches to skip, Skipping...`);
        process.exit(0);
    }

    const ticketRegex = new RegExp(options.ticket);
    const ticketMatch = ticketRegex.exec(branchName);

    if (ticketMatch) {
        updateCommitMsg(program.args[0], ticketMatch[0], options.messagePattern);
    } else {
        consoleWarn("All feature/bugfix branch name must include a jira ticket number.");
        consoleWarn("Did you miss-typed or forgot to include one?");
        consoleInfo('\nIf this is intentional, `SKIP=add-ticket-number git commit -m "foo"` to disable this hook.');
    }
}

module.exports = addTicketNumber;
