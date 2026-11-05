
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as crypto from 'node:crypto';

const SYSTEM_QML_ROOT = '/usr/lib/qt6/qml';
const CACHE_VERSION = 1;

function getQuickshellSignature(directory: string): string {
    const hash = crypto.createHash('sha256');

    hash.update(`cache-version:${CACHE_VERSION}\n`);

    function scan(current: string): void {
        const entries = fs.readdirSync(current, {
            withFileTypes: true
        }).sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
            const file = path.join(current, entry.name);
            const relative = path.relative(directory, file);

            if (entry.isDirectory()) {
                scan(file);
            } else if (entry.isFile() &&
                (entry.name === 'qmldir' ||
                 entry.name.endsWith('.qmltypes'))) {
                hash.update(relative);
                hash.update('\0');
                hash.update(fs.readFileSync(file));
                hash.update('\0');
            }
        }
    }

    scan(directory);

    return hash.digest('hex');
}


function patchWindowTypes(content: string): string {
    const panelStart = content.indexOf('name: "PanelWindowInterface"');

    if (panelStart === -1) {
        throw new Error('PanelWindowInterface introuvable');
    }

    const nextComponent = content.indexOf(
        '\n    Component {',
        panelStart
    );

    const end = nextComponent === -1
        ? content.length
        : nextComponent;

    const panelBlock = content.slice(panelStart, end);

    if (!panelBlock.includes('isCreatable: false')) {
        throw new Error('Déclaration isCreatable introuvable');
    }

    content =
        content.slice(0, panelStart) +
        panelBlock.replace('isCreatable: false', 'isCreatable: true') +
        content.slice(end);

    const opaqueMargins =
        'Component { isTypeOpaque: true; name: "Margins"; accessSemantics: "value" }';

    const correctedMargins = `Component {
        name: "Margins"
        accessSemantics: "value"
        Property { name: "left"; type: "int" }
        Property { name: "right"; type: "int" }
        Property { name: "top"; type: "int" }
        Property { name: "bottom"; type: "int" }
    }`;

    if (!content.includes(opaqueMargins)) {
        throw new Error('Déclaration opaque Margins introuvable');
    }

    return content.replace(opaqueMargins, correctedMargins);
}


function syncQtModules(root: string): void {
    const modules = fs.readdirSync(SYSTEM_QML_ROOT)
        .filter(name => name !== 'Quickshell');

    const expected = new Set(modules);

    for (const name of fs.readdirSync(root)) {
        const link = path.join(root, name);

        if (
            name === 'Quickshell' ||
            name === '.quickshell-signature'
        ) {
            continue;
        }

        if (
            fs.lstatSync(link).isSymbolicLink() &&
            !expected.has(name)
        ) {
            fs.unlinkSync(link);
        }
    }

    for (const name of modules) {
        const link = path.join(root, name);
        const target = path.join(SYSTEM_QML_ROOT, name);

        let valid = false;

        try {
            valid =
                fs.lstatSync(link).isSymbolicLink() &&
                fs.readlinkSync(link) === target &&
                fs.existsSync(link);
        } catch {
        }

        if (valid) {
            continue;
        }

        fs.rmSync(link, { recursive: true, force: true });
        fs.symlinkSync(target, link, 'dir');
    }
}


export function prepareQmlEnvironment(
    context: vscode.ExtensionContext
): string {
    const root = path.join(
        context.globalStorageUri.fsPath,
        'qml-imports'
    );

    const source = path.join(SYSTEM_QML_ROOT, 'Quickshell');
    const destination = path.join(root, 'Quickshell');
    
    fs.mkdirSync(root, { recursive: true });

    const signatureFile = path.join(root, '.quickshell-signature');
    const currentSignature = getQuickshellSignature(source);

    const cachedSignature = fs.existsSync(signatureFile)
        ? fs.readFileSync(signatureFile, 'utf8').trim()
        : null;

    const windowTypesFile = path.join(
        destination,
        '_Window',
        'quickshell-window.qmltypes'
    );

    const qtModulesValid = fs.readdirSync(SYSTEM_QML_ROOT)
        .filter(name => name !== 'Quickshell')
        .every(name => {
            const link = path.join(root, name);
            const target = path.join(SYSTEM_QML_ROOT, name);

            try {
                return fs.lstatSync(link).isSymbolicLink() &&
                    fs.readlinkSync(link) === target &&
                    fs.existsSync(link);
            } catch {
                return false;
            }
        });

    const cacheValid =
    cachedSignature === currentSignature &&
    fs.existsSync(windowTypesFile) &&
    fs.existsSync(path.join(destination, 'qmldir'));

    if (cacheValid) {
        syncQtModules(root);
        return root;
    }

    if (cacheValid) {
        return root;
    }

    fs.rmSync(signatureFile, { force: true });
    fs.rmSync(destination, { recursive: true, force: true });

    fs.cpSync(source, destination, {
        recursive: true,
        dereference: true
    });

    function removePrefer(directory: string): void {
        for (const entry of fs.readdirSync(directory, {
            withFileTypes: true
        })) {
            const file = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                removePrefer(file);
            } else if (entry.name === 'qmldir') {
                const content = fs.readFileSync(file, 'utf8');

                fs.writeFileSync(
                    file,
                    content.replace(
                        /^\s*prefer\s+.*$/gm,
                        ''
                    )
                );
            }
        }
    }

    removePrefer(destination);

    const windowTypes = path.join(
        destination,
        '_Window',
        'quickshell-window.qmltypes'
    );

    const content = fs.readFileSync(windowTypes, 'utf8');

    fs.writeFileSync(
        windowTypes,
        patchWindowTypes(content)
    );

    syncQtModules(root);

    fs.writeFileSync(
        signatureFile,
        currentSignature,
        'utf8'
    );

    return root;
}
