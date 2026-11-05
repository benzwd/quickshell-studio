
import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import { utimes } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHyprlandDiagnostics } from './diagnostics/hyprland';
import {
    startQmlClient,
    stopQmlClient
} from './language/qmlClient';

import {
    registerQuickshellCompletions
} from './completion/quickshellComponents';
import { QuickshellTypeIndex } from './quickshell/typeIndex';
import { registerQuickshellHover } from './hover/quickshellHover';

export function activate(context: vscode.ExtensionContext) {
    
    vscode.window.showInformationMessage(
        'Hyprland Studio: extension activated!'
    );
    const typeIndex = new QuickshellTypeIndex();
    typeIndex.build();

    registerQuickshellCompletions(context, typeIndex);
    registerQuickshellCompletions(context, typeIndex);
    registerQuickshellHover(context, typeIndex);

    void startQmlClient(context);

    vscode.window.showInformationMessage(
        `Quickshell Studio: ${typeIndex.getTypes().length} types indexés`
    );

    console.log(
        '[Quickshell Studio] Indexed types:',
        typeIndex.getTypes().length
    );

    console.log(
        '[Quickshell Studio] PanelWindow:',
        typeIndex.getType('Quickshell._Window', 'PanelWindow')
    );

    const hyprlandDiagnostics = createHyprlandDiagnostics();

    const reloadHyprland = vscode.commands.registerCommand(
        'hyprland-studio.reloadHyprland',
        () => {
            execFile('hyprctl', ['reload'], (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(
                        `Hyprland reload failed: ${stderr || error.message}`
                    );
                    return;
                }

                vscode.window.showInformationMessage(
                    'Hyprland reloaded successfully !'
                );
            });
        }
    );

    const reloadQuickshell = vscode.commands.registerCommand(
        'hyprland-studio.reloadQuickshell',
        async () => {
            const shellPath = join(
                homedir(),
                '.config',
                'quickshell',
                'shell.qml'
            );

            try {
                const now = new Date();

                await utimes(shellPath, now, now);

                vscode.window.showInformationMessage(
                    'Quickshell reload triggered !'
                );
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Quickshell reload failed: ${String(error)}`
                );
            }
        }
    );

    const checkHyprlandConfig = vscode.commands.registerCommand(
        'hyprland-studio.checkHyprlandConfig',
        hyprlandDiagnostics.checkConfig
    );


    context.subscriptions.push(
        reloadHyprland,
        reloadQuickshell,
        hyprlandDiagnostics.collection,
        checkHyprlandConfig
    );
}

export async function deactivate(): Promise<void> {
    await stopQmlClient();
}