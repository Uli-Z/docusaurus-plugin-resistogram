/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { CommandContext } from '../../ui/commands/types.js';
import { IPromptProcessor } from './types.js';
export declare class ConfirmationRequiredError extends Error {
    commandsToConfirm: string[];
    constructor(message: string, commandsToConfirm: string[]);
}
/**
 * Finds all instances of shell command injections (`!{...}`) in a prompt,
 * executes them, and replaces the injection site with the command's output.
 *
 * This processor ensures that only allowlisted commands are executed. If a
 * disallowed command is found, it halts execution and reports an error.
 */
export declare class ShellProcessor implements IPromptProcessor {
    private readonly commandName;
    /**
     * A regular expression to find all instances of `!{...}`. The inner
     * capture group extracts the command itself.
     */
    private static readonly SHELL_INJECTION_REGEX;
    /**
     * @param commandName The name of the custom command being executed, used
     *   for logging and error messages.
     */
    constructor(commandName: string);
    process(prompt: string, context: CommandContext): Promise<string>;
}
