
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parseQmltypes } from './qmltypesParser';
import type { QmlMember } from './qmltypesParser';

export interface QmlType {
    name: string;
    internalName: string;
    module: string;
    creatable: boolean;
    properties: QmlMember[];
    methods: QmlMember[];
    signals: QmlMember[];
}

export class QuickshellTypeIndex {
    private readonly types = new Map<string, QmlType>();

    constructor(
        private readonly qmlRoot = '/usr/lib/qt6/qml'
    ) {}

    public build(): void {
        this.types.clear();

        const root = path.join(this.qmlRoot, 'Quickshell');

        this.scanDirectory(root);
    }

    public getTypes(): QmlType[] {
        return [...this.types.values()];
    }

    public getType(
        module: string,
        name: string
    ): QmlType | undefined {
        return this.types.get(`${module}/${name}`);
    }

    private scanDirectory(directory: string): void {
        if (!fs.existsSync(directory)) {
            return;
        }

        for (const entry of fs.readdirSync(directory, {
            withFileTypes: true
        })) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                this.scanDirectory(fullPath);
            } else if (entry.name.endsWith('.qmltypes')) {
                this.parseTypeFile(fullPath);
            }
        }
    }

   
    private parseTypeFile(filePath: string): void {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsedTypes = parseQmltypes(content);

        for (const type of parsedTypes) {
            for (const exported of type.exports) {
                const match =
                    /^(Quickshell(?:\.[\w]+)*)\/([A-Za-z]\w*)\s+[\d.]+$/
                        .exec(exported);

                if (!match) {
                    continue;
                }

                const [, module, name] = match;
                const key = `${module}/${name}`;

                this.types.set(key, {
                    name,
                    internalName: type.internalName,
                    module,
                    creatable: type.creatable,
                    properties: type.properties,
                    methods: type.methods,
                    signals: type.signals
                });
            }
        }
    }

}
