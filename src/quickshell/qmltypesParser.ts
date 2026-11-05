
export interface QmlMember {
    name: string;
    type?: string;
}

export interface ParsedQmlType {
    internalName: string;
    exports: string[];
    creatable: boolean;
    properties: QmlMember[];
    methods: QmlMember[];
    signals: QmlMember[];
}

interface QmlBlock {
    kind: string;
    body: string;
}

function extractBlocks(
    source: string,
    kind: string
): QmlBlock[] {
    const blocks: QmlBlock[] = [];
    const regex = new RegExp(`\\b${kind}\\s*\\{`, 'g');

    let match: RegExpExecArray | null;

    while ((match = regex.exec(source)) !== null) {
        const start = regex.lastIndex;
        let depth = 1;
        let end = start;

        let inString = false;
        let escaped = false;

        for (let i = start; i < source.length; i++) {
            const char = source[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (char === '\\') {
                    escaped = true;
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (char === '"') {
                inString = true;
            } else if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;

                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }

        if (depth !== 0) {
            continue;
        }

        blocks.push({
            kind,
            body: source.slice(start, end)
        });

        regex.lastIndex = end + 1;
    }

    return blocks;
}

function getString(
    body: string,
    field: string
): string | undefined {
    const regex = new RegExp(
        `\\b${field}\\s*:\\s*"([^"]*)"`
    );

    return regex.exec(body)?.[1];
}

function getBoolean(
    body: string,
    field: string
): boolean | undefined {
    const regex = new RegExp(
        `\\b${field}\\s*:\\s*(true|false)`
    );

    const value = regex.exec(body)?.[1];

    return value === undefined
        ? undefined
        : value === 'true';
}

function getExports(body: string): string[] {
    const match = /\bexports\s*:\s*\[([^\]]*)\]/.exec(body);

    if (!match) {
        return [];
    }

    return [...match[1].matchAll(/"([^"]+)"/g)]
        .map(entry => entry[1]);
}

function getMembers(
    body: string,
    kind: string
): QmlMember[] {
    return extractBlocks(body, kind)
        .map(block => ({
            name: getString(block.body, 'name') ?? '',
            type: getString(block.body, 'type')
        }))
        .filter(member => member.name.length > 0);
}

export function parseQmltypes(
    source: string
): ParsedQmlType[] {
    return extractBlocks(source, 'Component')
        .map(block => {
            const body = block.body;

            return {
                internalName: getString(body, 'name') ?? '',
                exports: getExports(body),
                creatable:
                    getBoolean(body, 'isCreatable') !== false,
                properties: getMembers(body, 'Property'),
                methods: getMembers(body, 'Method'),
                signals: getMembers(body, 'Signal')
            };
        })
        .filter(type =>
            type.internalName.length > 0 &&
            type.exports.length > 0
        );
}
