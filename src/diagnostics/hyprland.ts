
import * as vscode from 'vscode';
import { execFile } from 'node:child_process';

export function createHyprlandDiagnostics() {
    const collection =
        vscode.languages.createDiagnosticCollection('Hyprland Studio');

    async function checkConfig() {
        collection.clear();

        execFile('hyprctl', ['configerrors'], (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(
                    `Hyprland diagnostics failed: ${stderr || error.message}`
                );
                return;
            }

            const output = stdout.trim();

            if (!output || output === 'ok') {
                vscode.window.showInformationMessage(
                    'No Hyprland configuration errors!'
                );
                return;
            }

            const regex = /^(.+?\.lua):(\d+):\s*(.+)$/gm;

            const diagnosticsByFile =
                new Map<string, vscode.Diagnostic[]>();

            for (const match of output.matchAll(regex)) {
                const [, file, line, message] = match;

                const lineNumber = Math.max(0, Number(line) - 1);

                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(lineNumber, 0, lineNumber, 1000),
                    message,
                    vscode.DiagnosticSeverity.Error
                );

                diagnostic.source = 'Hyprland Studio';

                const existing = diagnosticsByFile.get(file) ?? [];
                existing.push(diagnostic);
                diagnosticsByFile.set(file, existing);
            }

            for (const [file, diagnostics] of diagnosticsByFile) {
                collection.set(
                    vscode.Uri.file(file),
                    diagnostics
                );
            }

            if (diagnosticsByFile.size > 0) {
                vscode.commands.executeCommand(
                    'workbench.actions.view.problems'
                );
            } else {
                vscode.window.showWarningMessage(
                    `Hyprland reported errors:\n${output}`
                );
            }
        });
    }

    return { collection, checkConfig };
}
