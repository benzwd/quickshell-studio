
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    Trace
} from 'vscode-languageclient/node';
import { prepareQmlEnvironment } from '../quickshell/importEnvironment';

let client: LanguageClient | undefined;

export async function startQmlClient(
    context: vscode.ExtensionContext
): Promise<void> {
    const qmlImports = prepareQmlEnvironment(context);
    if (client) {
        return;
    }

    const serverOptions: ServerOptions = {
        command: '/usr/lib/qt6/bin/qmlls',
        args: [
            '--bare',
            '-I',
            qmlImports
        ],
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'qml' }
        ],
        outputChannelName: 'Quickshell Language Server',
        traceOutputChannel: vscode.window.createOutputChannel(
            'Quickshell LSP Trace',
            { log: true }
        )
    };

    client = new LanguageClient(
        'quickshellLanguageServer',
        'Quickshell Language Server',
        serverOptions,
        clientOptions
    );

    client.setTrace(Trace.Verbose);

    try {
        await client.start();
    } catch (error) {
        client = undefined;
        vscode.window.showErrorMessage(
            `Failed to start qmlls: ${String(error)}`
        );
    }
}

export async function stopQmlClient(): Promise<void> {
    if (client) {
        const runningClient = client;
        client = undefined;
        await runningClient.stop();
    }
}
