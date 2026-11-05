
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { QuickshellTypeIndex } from '../quickshell/typeIndex';

const QML_ROOT = '/usr/lib/qt6/qml';

interface QmlComponent {
    name: string;
    module: string;
}

function readQmldir(moduleName: string): string | undefined {
    const directory = path.join(
        QML_ROOT,
        ...moduleName.split('.')
    );

    try {
        return fs.readFileSync(
            path.join(directory, 'qmldir'),
            'utf8'
        );
    } catch {
        return undefined;
    }
}

function getImportedModules(
    document: vscode.TextDocument
): Set<string> {
    const modules = new Set<string>();
    const queue: string[] = [];

    const importRegex =
        /^\s*import\s+(Quickshell(?:\.[\w]+)*)\b/gm;

    for (const match of document.getText().matchAll(importRegex)) {
        queue.push(match[1]);
    }

    while (queue.length > 0) {
        const moduleName = queue.shift()!;

        if (modules.has(moduleName)) {
            continue;
        }

        modules.add(moduleName);

        const qmldir = readQmldir(moduleName);
        if (!qmldir) {
            continue;
        }

        // Resolve modules made available by default imports.
        for (const match of qmldir.matchAll(
            /^\s*default\s+import\s+(Quickshell(?:\.[\w]+)*)/gm
        )) {
            queue.push(match[1]);
        }
    }

    return modules;
}

export function registerQuickshellCompletions(
    context: vscode.ExtensionContext,
    typeIndex: QuickshellTypeIndex
): void {
    const provider =
        vscode.languages.registerCompletionItemProvider(
            { language: 'qml', scheme: 'file' },
            {
                provideCompletionItems(document, position) {
                    const line = document.lineAt(position.line);
                    const prefix = line.text.substring(
                        0,
                        position.character
                    );


                    if (!/^\s*[A-Z]\w*$/.test(prefix)) {
                        return [];
                    }

                    const modules = getImportedModules(document);
                    const components = typeIndex.getTypes().filter(
                        component => modules.has(component.module)
                    );


                    return components.map(component => {
                        const item = new vscode.CompletionItem(
                            component.name,
                            vscode.CompletionItemKind.Class
                        );

                        item.detail = `${component.module} · Quickshell`;

                        const docs = new vscode.MarkdownString();

                        docs.appendMarkdown(
                            `### ${component.name}\n\n`
                        );

                        docs.appendMarkdown(
                            `**Module :** \`${component.module}\`\n\n`
                        );

                        if (component.properties.length > 0) {
                            docs.appendMarkdown('**Propriétés :**\n\n');

                            for (const property of component.properties) {
                                docs.appendMarkdown(
                                    `- \`${property.name}\` : \`${property.type ?? 'unknown'}\`\n`
                                );
                            }
                        }

                        if (component.methods.length > 0) {
                            docs.appendMarkdown('\n**Méthodes :**\n\n');

                            for (const method of component.methods) {
                                docs.appendMarkdown(
                                    `- \`${method.name}()\`\n`
                                );
                            }
                        }

                        if (component.signals.length > 0) {
                            docs.appendMarkdown('\n**Signaux :**\n\n');

                            for (const signal of component.signals) {
                                docs.appendMarkdown(
                                    `- \`${signal.name}\`\n`
                                );
                            }
                        }

                        item.documentation = docs;

                        item.insertText = new vscode.SnippetString(
                            `${component.name} {\n\t$0\n}`
                        );

                        return item;
                    });

                }
            }
        );

    context.subscriptions.push(provider);
}
