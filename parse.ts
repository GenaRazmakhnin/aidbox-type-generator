import * as fs from "fs/promises";
import axios from "axios";
import merge from "./merge";

const box = axios.create({
    baseURL: 'http://localhost:8090',
    auth: {
        username: 'root',
        password: 'secret',
    },
});


const loadSymbols = async () => {
    const exist = await fs.stat('./symbols.json').catch(() => false);
    if (exist) {
        return JSON.parse((await fs.readFile('./symbols.json')).toString())
    }
    const {data: {result: ns}} = await box.post("/rpc", {
        method: "aidbox.zen/namespaces",
        params: {}
    })
    const namespaces = ns.filter((namespace: string) => !excludeNamespaces.some((symbol) => symbol.test(namespace)))

    const symbols: string[] = [];
    for (const namespace of namespaces) {
        const {data: {result}} = await box.post("/rpc", `{
            :method aidbox.zen/symbols
            :params { :ns ${namespace}}
        }`, {headers: {"Content-Type": "application/edn"}});
        result.map((r: any) => symbols.push(`${namespace}/${r.name}`))
    }
    await fs.writeFile('./symbols.json', JSON.stringify(symbols));
    return symbols;
}

const capitalize = (str: string): string => `${str.charAt(0).toUpperCase()}${str.slice(1)}`;


const excludeNamespaces = [
    /^aidbox/,
    /^zenbox.api/,
    /^fhir/,
    /^zen$/,
    /zenbox/,
    /zen.fhir/
]

const excludedTags = [];
const schema: Record<string, any> = {};


const zenConfirms: Record<string, string> = {}

const findConfirms = async (confirms: any) => {
    const result = new Set()
    for (const confirm of confirms) {
        if (confirm === 'zenbox/Resource') {
            continue;
        }
        let el = schema[confirm];
        if (!el) {
            const {data: {result: {model: definition}}} = await box.post("/rpc", `{
            :method aidbox.zen/symbol
            :params { :name ${confirm}}
        }`, {headers: {"Content-Type": "application/edn"}});
            schema[confirm] = definition;
            el = definition
        }

        if (zenConfirms[confirm]) {
            result.add(zenConfirms[confirm])
        }
        const name = el["zen.fhir/type"] || el["resourceType"] || el['zen/name'].split('/')[1] || `any-${confirm}`

        zenConfirms[confirm] = name;
        result.add(name);
    }
    return Array.from(result);
}

const parseZenVector = async (vector: any) => {
    if (!vector.every['type'] && vector.every['confirms']) {
        if (vector.every?.['zen.fhir/reference']?.refers) {
            const refers = await findConfirms(vector.every['zen.fhir/reference']?.refers);
            return refers?.length ? `Reference<${refers.join(' | ')}>` : `Reference`
        }
        return (await findConfirms(vector.every['confirms'])).join(' | ')
    } else if (vector.every.type === 'zen/map') {
        if (vector.every.keys) {
            return await parseZenMap(vector.every.keys, vector.every?.require);
        }
        return "any"
    }
    if (vector.every?.type === 'zen/string') {
        return "string"
    }
    if (vector.every?.type === 'zen/datetime') {
        return "dateTime"
    }
    if (!vector.every?.type && !vector.every?.confirms) {
        return "any"
    }
    return "any";
}


const parseZenMap = async (keys: any, required: string[] = []) => {
    const result = [];
    for (const [key,value] of  Object.entries<any>(keys)) {
        if (!value['type'] && value['confirms']) {
            if (value['zen.fhir/reference']?.refers) {
                const refers = await findConfirms(value['zen.fhir/reference']?.refers);
                result.push([key in required ? key : `${key}?`, {
                    type: refers?.length ? `Reference<${refers.join(' | ')}>` : `Reference`,
                    desc: value["zen/desc"]
                }])
                continue;
            }
            result.push([key in required ? key : `${key}?`, {
                type: findConfirms(schema, value['confirms']).join(' | '),
                desc: value["zen/desc"]
            }])
            continue;
        } else if (value['type']) {
            if (value['type'] === 'zen/vector') {
                const type = parseZenVector(schema, value);
                const baseTypes = findConfirms(schema, value.every?.confirms);
                if (baseTypes.length < 1 && typeof type === 'string') {
                    return [key in required ? key : `${key}?`, {
                        type: `Array<${type}>`,
                        desc: value.every?.["zen/desc"]
                    }]
                }
                if (baseTypes.length === 1 && typeof type === 'string') {
                    return [key in required ? key : `${key}?`, {
                        type: `Array<${type}>`,
                        desc: value.every?.["zen/desc"]
                    }]
                }
                return [key in required ? key : `${key}?`, {
                    array: true,
                    baseTypes: baseTypes,
                    subType: type,
                    desc: value.every?.["zen/desc"]
                }]
            }

            if (value['type'] === 'zen/string') {
                return [key in required ? key : `${key}?`, {
                    type: "string",
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/boolean') {
                return [key in required ? key : `${key}?`, {
                    type: "boolean",
                    desc: value["zen/desc"]
                }]
            }
            if (value.type === 'zen/datetime') {
                return [key in required ? key : `${key}?`, {
                    type: "dateTime",
                    desc: value["zen/desc"]
                }]
            }
            if (value.type === 'zen/date') {
                return [key in required ? key : `${key}?`, {
                    type: "date",
                    desc: value["zen/desc"]
                }]
            }

            if (value['type'] === 'zen/integer') {
                return [key in required ? key : `${key}?`, {
                    type: "integer",
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/number') {
                return [key in required ? key : `${key}?`, {
                    type: value?.confirms ? value.confirms[0].split('/')[1] : "number",
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/any') {
                return [key in required ? key : `${key}?`, {
                    type: `Record<string,any>`,
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/set') {
                return [key in required ? key : `${key}?`, {
                    type: "any",
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/map') {
                if (value['validation-type'] === 'open') {
                    if (value['validation-type'] === 'open') {
                        return [key in required ? key : `${key}?`, {
                            type: `any`,
                            desc: value["zen/desc"]
                        }]
                    }
                }
                if (value['confirms']) {
                    const baseTypes = findConfirms(schema, value.confirms);
                    if (value['validation-type'] === 'open') {
                        return [key in required ? key : `${key}?`, {
                            type: `${baseTypes.join(' & ')} & any`,
                            desc: value["zen/desc"]
                        }]
                    }

                    if (value?.keys) {
                        return [key in required ? key : `${key}?`, {
                            baseTypes: baseTypes,
                            subType: parseZenMap(schema, value['keys'], value['require']),
                            desc: value["zen/desc"]
                        }]
                    }
                    return [key in required ? key : `${key}?`, {
                        type: "any",
                        desc: value["zen/desc"]
                    }]

                }
                if (value?.keys) {
                    return [key in required ? key : `${key}?`, {
                        type: parseZenMap(schema, value['keys'], value['require']),
                        desc: value["zen/desc"]
                    }]
                }
                if (value?.values?.type === 'zen/any') {
                    return [key in required ? key : `${key}?`, {
                        type: `Record<string,any>`,
                        desc: value["zen/desc"]
                    }]
                }
                if (value?.values?.keys) {
                    return [key in required ? key : `${key}?`, {
                        type: parseZenMap(schema, value.values.keys, value.values?.['require']),
                        desc: value["zen/desc"]
                    }]
                }
                console.log("map", value)
                return [key in required ? key : `${key}?`, {
                    type: "map-any",
                    desc: value["zen/desc"]
                }]
            }

        }
        //TODO: process this later
        if (value['fhir/polymorphic']) {
            return [key in required ? key : `${key}?`, {
                type: "map-any",
                desc: value["zen/desc"]
            }]
        }
        if (value['validation-type'] === 'open') {
            return [key in required ? key : `${key}?`, {
                type: "any",
                desc: value["zen/desc"]
            }]
        }
        if (!value['type']) {
            return [key in required ? key : `${key}?`, {
                type: "any",
                desc: value["zen/desc"]
            }]
        }
        console.log("any type", key, value)
        process.exit(1);
        return [key, {type: "any"}]
    }))
}


const rpcParamsType = (type: string, validationType?: string) => {
    switch (type) {
        case "zen/map":
            return validationType === "open" ? "Record<string,any>" : "need-map"
        default:
            return "rpc-any"
    }
}

const parseZenSchema = async () => {
    const symbols: string[] = await loadSymbols();
    for (const symbol of symbols.splice(13, 1)) {
        const {data: {result: {model: definition}}} = await box.post("/rpc", `{
            :method aidbox.zen/symbol
            :params { :name ${symbol}}
        }`, {headers: {"Content-Type": "application/edn"}});
        schema[symbol] = definition;
        console.log(symbol, definition);
        if (definition['zen.fhir/profileUri'] && definition['zen/tags']?.includes('zen.fhir/structure-schema')) {
            continue;
        }
        if (definition['zen/tags']?.includes('zenbox/rpc')) {
            const [namespace, name] = symbol.split('/');
            const paramsType = definition?.params?.type;
            const type =
                {
                    desc: definition["zen/desc"] || null,
                    name: `Rpc${capitalize(namespace.split(".").reverse()[0])}${name.split('-').map(n => capitalize(n)).join("")}`,
                    def: {
                        method: symbol,
                        params: rpcParamsType(paramsType, definition?.params?.['validation-type'])
                    }
                }
            console.log(type)
        } else {
            let name;
            if (definition?.['zen/name']?.startsWith('fhir/')) {
                name = definition['zen/name'].split('/')[1];
            } else {
                name = definition["zen.fhir/type"] || definition["resourceType"] || definition['zen/name'].split('/')[1];
            }
            if (!name) {
                console.log("Name missed for ", symbol)
            }
            const required = definition['require'];
            let type;

            const confirms = await findConfirms(definition['confirms']);

            if (definition['zen/tags'].includes('zenbox/persistent') && (definition['validation-type'] === 'open' || definition['values']?.type === 'zen/any')) {
                type = {
                    desc: definition["zen/desc"] || null,
                    name,
                    extends: definition['confirms'] ? confirms.join(' | ') : [],
                    defs: {
                        "[key:string]?": 'any'
                    }
                }
            } else {

                type = {
                    desc: definition["zen/desc"] || null,
                    name,
                    extends: definition['confirms'] ? confirms.join(' | ') : [],
                    defs: parseZenMap( definition.keys, required)
                }
            }
            console.log(type);
        }
        process.exit(1)


        // if (value['zen/tags'].includes('fhir/primitive-type')) {
        //     return {
        //         desc: value["zen/desc"] || null,
        //         name: value['zen/name'].split('/')[1],
        //         primitive: value['type'] === 'zen/map' ? `Record<string,any>` : value['type'].split('/')[1]
        //     }
        // }
        //

        // if (value['zen/tags'].includes('zen.fhir/search')) {
        //     return null;
        // }
        // if (value['zen/tags'].includes('zen/primitive')) {
        //     return null;
        // }
        //
        // if (value['zen/tags']?.includes('zenbox/rpc')) {
        //     const [namespace, name] = key.split('/');
        //     const paramsType = value?.params?.type;
        //
        //     return {
        //         desc: value["zen/desc"] || null,
        //         name: `Rpc${capitalize(namespace.split(".").reverse()[0])}${name.split('-').map(n => capitalize(n)).join("")}`,
        //         def: {
        //             method: key,
        //             params: rpcParamsType(filteredSchema, paramsType, value?.params?.['validation-type'])
        //         }
        //     }
        // } else {
        //     let name;
        //     if (value?.['zen/name']?.startsWith('fhir/')) {
        //         name = value['zen/name'].split('/')[1];
        //     } else {
        //         name = value["zen.fhir/type"] || value["resourceType"] || value['zen/name'].split('/')[1];
        //     }
        //     if (!name) {
        //         console.log("Name missed for ", key)
        //     }
        //     const required = value['require'];
        //     let type;
        //
        //     if (value['zen/tags'].includes('zenbox/persistent') && (value['validation-type'] === 'open' || value['values']?.type === 'zen/any')) {
        //         type = {
        //             desc: value["zen/desc"] || null,
        //             name,
        //             extends: value['confirms'] ? findConfirms(filteredSchema, value['confirms']).join(' | ') : [],
        //             defs: {
        //                 "[key:string]?": 'any'
        //             }
        //         }
        //     } else {
        //         type = {
        //             desc: value["zen/desc"] || null,
        //             name,
        //             extends: value['confirms'] ? findConfirms(filteredSchema, value['confirms']).join(' | ') : [],
        //             defs: parseZenMap(filteredSchema, value.keys, required)
        //         }
        //     }
        //     return type;
        // }
    }


    // await fs.writeFile('./types.json', JSON.stringify(result, null ,2))
}

if (require.main === module) {
    const start = Date.now();
    console.log("Generating types…");
    parseZenSchema();
}
