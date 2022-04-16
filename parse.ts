import * as fs from "fs/promises";
import axios from "axios";


const box = axios.create({
    baseURL: 'http://localhost:8090',
    auth: {
        username: 'root',
        password: 'secret',
    },
});

const loadAllSchema = async () => {
    const exist = await fs.stat('./schema.json').catch(() => false);
    if (exist) {
        return require("./schema.json");
    }
    const resp = await box.post("/rpc", {
        method: "relatient/zen-all-symbols",
    });

    const data = resp.data.result;
    await fs.writeFile('schema.json', JSON.stringify(data, null, 2))
    return data;
}

const capitalize = (str: string): string => `${str.charAt(0).toUpperCase()}${str.slice(1)}`;


const excludeSymbols = [
    "hl7-fhir-r4-core.value-set.",
    "hl7-fhir-r4-core.search.",
    "aidbox/service",
    "zen/validation-fn",
    "hl7-fhir-r4-core.structuredefinition",
    "zenbox.api"
]

const zenConfirms: Record<string, string> = {}
const zenPrimitives: Record<string, string> = {}

const findConfirms = (schema: any, confirms: any) => [...new Set(confirms.map((c: string) => {
    const el = schema[c];
    if (!el) {
        console.log('Confirms missed', c);
        return null
    }
    if (zenConfirms[c]) {
        return zenConfirms[c]
    }
    const name = el["zen.fhir/type"] || el["resourceType"] || el['zen/name'].split('/')[1] || `any-${c}`

    zenConfirms[c] = name;
    return name;
}))]
    .filter(Boolean);

const parseZenVector = (schema: any, vector: any) => {
    if (!vector.every['type'] && vector.every['confirms']) {
        if (vector.every?.['zen.fhir/reference']?.refers) {
            const refers = findConfirms(schema, vector.every['zen.fhir/reference']?.refers);
            return refers?.length ? `Reference<${refers.join(' | ')}>` : `Reference`
        }
        return findConfirms(schema, vector.every['confirms']).join(' | ')
    }else if (vector.every.type === 'zen/map'){
        if (vector.every.keys){
            return parseZenMap(schema, vector.every.keys, vector.every?.require);
        }
        return "any"
        }
    if (vector.every?.type === 'zen/string'){
        return "string"
    }
    if (vector.every?.type === 'zen/datetime'){
        return "dateTime"
    }
    console.log("11111",vector)
    return "";
}


const parseZenMap = (schema: any, keys: any, required: string[] = []) => {
    return Object.fromEntries(Object.entries<any>(keys).map(([key, value]): [string, any] => {
        if (!value['type'] && value['confirms']) {
            if (value['zen.fhir/reference']?.refers) {
                const refers =  findConfirms(schema, value['zen.fhir/reference']?.refers);
                return [key in required ? key : `${key}?`, {
                    type: refers?.length ? `Reference<${refers.join(' | ')}>` : `Reference`,
                    desc: value["zen/desc"]
                }]
            }
            return [key in required ? key : `${key}?`, {
                type: findConfirms(schema, value['confirms']).join(' | '),
                desc: value["zen/desc"]
            }]
        } else if (value['type']) {
            if (value['type'] === 'zen/vector') {
                const type = parseZenVector(schema, value);
                const baseTypes = findConfirms(schema, value.every.confirms);
                if (baseTypes.length === 1){
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
            if (value['type'] === 'zen/string'){
                return [key in required ? key : `${key}?`, {
                    type: "string",
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/map'){
                if(value['confirms']) {
                    const baseTypes = findConfirms(schema, value.confirms);
                    if (value['validation-type'] === 'open'){
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
                console.log("map", value)
                return [key in required ? key : `${key}?`, {
                    type: "map-any",
                    desc: value["zen/desc"]
                }]
            }
            console.log("any type", key, value)

        }
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
    const schema = await loadAllSchema();
    const filteredSchema = Object.fromEntries(Object.entries<any>(schema)
        .filter(([key, value]) => !excludeSymbols.some((symbol) => key.startsWith(symbol))
        ));
    const result: any = []

    for (const [key, value] of Object.entries<any>(filteredSchema).splice(9, 1)) {
        if (value['zen.fhir/profileUri']){
            continue;
        }
        console.log(key,value);

        if (value['zen/tags']?.includes('zenbox/rpc')) {
            const [namespace, name] = key.split('/');
            const paramsType = value?.params?.type;
            const type = {
                desc: value["zen/desc"] || null,
                name: `Rpc${capitalize(namespace.split(".").reverse()[0])}${name.split('-').map(n => capitalize(n)).join("")}`,
                def: {
                    method: key,
                    params: rpcParamsType(paramsType, value?.params?.['validation-type'])
                }
            }
            result.push(type);
        } else {
            let name;
            if (value?.['zen/name']?.startsWith('fhir/')){
                name = value['zen/name'].split('/')[1];
            } else {
                name = value["zen.fhir/type"] || value["resourceType"];
            }
            if (!name) {
                console.log("Name missed for ", key)
            }
            const required = value['require'];
            const type = {
                desc: value["zen/desc"] || null,
                name,
                extends: value['confirms'] ? findConfirms(filteredSchema, value['confirms']).join(' | ') : [],
                defs: parseZenMap(filteredSchema, value.keys, required)
            }
            result.push(type);
            console.dir(type, {depth: 5})
            process.exit(1)
        }
    }
    console.log(result);
}

if (require.main === module) {
    const start = Date.now();
    // if (!process.env.USE_CACHE) {
    //     console.log(
    //         "Cache is disabled. Use `make generate-aidbox-types USE_CACHE=1` to cache aidbox requests and speed up types generation",
    //     );
    // }
    console.log("Generating types…");
    parseZenSchema();
    // getSchemas();

}
