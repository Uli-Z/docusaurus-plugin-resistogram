/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { checkCommandPermissions, ShellExecutionService, } from '@google/gemini-cli-core';
export class ConfirmationRequiredError extends Error {
    commandsToConfirm;
    constructor(message, commandsToConfirm) {
        super(message);
        this.commandsToConfirm = commandsToConfirm;
        this.name = 'ConfirmationRequiredError';
    }
}
/**
 * Finds all instances of shell command injections (`!{...}`) in a prompt,
 * executes them, and replaces the injection site with the command's output.
 *
 * This processor ensures that only allowlisted commands are executed. If a
 * disallowed command is found, it halts execution and reports an error.
 */
export class ShellProcessor {
    commandName;
    /**
     * A regular expression to find all instances of `!{...}`. The inner
     * capture group extracts the command itself.
     */
    static SHELL_INJECTION_REGEX = /!\{([^}]*)\}/g;
    /**
     * @param commandName The name of the custom command being executed, used
     *   for logging and error messages.
     */
    constructor(commandName) {
        this.commandName = commandName;
    }
    async process(prompt, context) {
        const { config, sessionShellAllowlist } = {
            ...context.services,
            ...context.session,
        };
        const commandsToExecute = [];
        const commandsToConfirm = new Set();
        const matches = [...prompt.matchAll(ShellProcessor.SHELL_INJECTION_REGEX)];
        if (matches.length === 0) {
            return prompt; // No shell commands, nothing to do.
        }
        // Discover all commands and check permissions.
        for (const match of matches) {
            const command = match[1].trim();
            const { allAllowed, disallowedCommands, blockReason, isHardDenial } = checkCommandPermissions(command, config, sessionShellAllowlist);
            if (!allAllowed) {
                // If it's a hard denial, this is a non-recoverable security error.
                if (isHardDenial) {
                    throw new Error(`${this.commandName} cannot be run. ${blockReason || 'A shell command in this custom command is explicitly blocked in your config settings.'}`);
                }
                // Add each soft denial disallowed command to the set for confirmation.
                disallowedCommands.forEach((uc) => commandsToConfirm.add(uc));
            }
            commandsToExecute.push({ fullMatch: match[0], command });
        }
        // If any commands require confirmation, throw a special error to halt the
        // pipeline and trigger the UI flow.
        if (commandsToConfirm.size > 0) {
            throw new ConfirmationRequiredError('Shell command confirmation required', Array.from(commandsToConfirm));
        }
        // Execute all commands (only runs if no confirmation was needed).
        let processedPrompt = prompt;
        for (const { fullMatch, command } of commandsToExecute) {
            const { result } = ShellExecutionService.execute(command, config.getTargetDir(), () => { }, // No streaming needed.
            new AbortController().signal);
            const executionResult = await result;
            processedPrompt = processedPrompt.replace(fullMatch, executionResult.output);
        }
        return processedPrompt;
    }
}
//# sourceMappingURL=shellProcessor.js.map