import * as vscode from 'vscode';
import { QuickshellTypeIndex, QmlType } from '../quickshell/typeIndex';

function createDocumentation(type: QmlType): vscode.MarkdownString {
    const docs = new vscode.MarkdownString();

    docs.appendMarkdown(`### ${type.name}\n\n`);
    docs.appendMarkdown(`**Module :** \`${type.module}\`\n\n`);

    if (type.properties.length > 0) {
        docs.appendMarkdown('**Propriétés**\n\n');

        for (const property of type.properties) {
            docs.appendMarkdown(
                `- \`${property.name}\`: \`${property.type ?? 'unknown'}\`\n`
            );
        }
    }

    if (type.methods.length > 0) {
        docs.appendMarkdown('\n**Méthodes**\n\n');

        for (const method of type.methods) {
            docs.appendMarkdown(`- \`${method.name}()\`\n`);
        }
    }

    if (type.signals.length > 0) {
        docs.appendMarkdown('\n**Signaux**\n\n');

        for (const signal of type.signals) {
            docs.appendMarkdown(`- \`${signal.name}\`\n`);
        }
    }

    return docs;
}


function findParentType(
    document: vscode.TextDocument,
    position: vscode.Position,
    typeIndex: QuickshellTypeIndex,
    importedModules: Set<string>
): QmlType | undefined {
    const text = document.getText();
    const offset = document.offsetAt(position);

    const stack: Array<{
        type?: QmlType;
    }> = [];

    const regex = /([A-Za-z_]\w*)\s*\{|[{}]/g;

    for (const match of text.matchAll(regex)) {
        if (match.index >= offset) {
            break;
        }

        if (match[0] === '}') {
            stack.pop();
            continue;
        }

        if (match[0] === '{') {
            stack.push({});
            continue;
        }

        const name = match[1];

        const type = typeIndex.getTypes().find(
            candidate =>
                candidate.name === name &&
                importedModules.has(candidate.module)
        );

        stack.push({ type });
    }

    for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].type) {
            return stack[i].type;
        }
    }

    return undefined;
}


export function registerQuickshellHover(
    context: vscode.ExtensionContext,
    typeIndex: QuickshellTypeIndex
): void {
    const provider = vscode.languages.registerHoverProvider(
        { language: 'qml', scheme: 'file' },
        {
            provideHover(document, position) {
                const range = document.getWordRangeAtPosition(position);

                if (!range) {
                    return undefined;
                }

                const word = document.getText(range);

                const importedModules = new Set(
                    [...document.getText().matchAll(
                        /^\s*import\s+(Quickshell(?:\.[\w]+)*)\b/gm
                    )].map(match => match[1])
                );

                if (importedModules.has('Quickshell')) {
                    importedModules.add('Quickshell._Window');
                }


                const type = typeIndex.getTypes().find(
                    candidate =>
                        candidate.name === word &&
                        importedModules.has(candidate.module)
                );

                if (type) {
                    return new vscode.Hover(
                        createDocumentation(type),
                        range
                    );
                }

                const parentType = findParentType(
                    document,
                    position,
                    typeIndex,
                    importedModules
                );

                if (!parentType) {
                    return undefined;
                }

                const property = parentType.properties.find(
                    candidate => candidate.name === word
                );

                if (!property) {
                    return undefined;
                }

                const docs = new vscode.MarkdownString();

                docs.appendMarkdown(`### ${property.name}\n\n`);
                docs.appendMarkdown(
                    `**Type :** \`${property.type ?? 'unknown'}\`\n\n`
                );
                docs.appendMarkdown(
                    `**Composant :** \`${parentType.name}\`\n\n`
                );
                docs.appendMarkdown(
                    `**Module :** \`${parentType.module}\``
                );

                return new vscode.Hover(docs, range);
            }
        }
    );

    context.subscriptions.push(provider);
}
