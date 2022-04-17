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
    "aidbox/",
    "hl7-fhir-r4-core.structuredefinition",
    "zenbox.api",
    "fhir.compartment",
    "aidbox.",
    "zenbox/",
    "zen/",
    "zen.fhir/nested-schema",
    "fhir/complex-type",
    "zen.fhir/profile-schema",
    "fhir/primitive-type",
    "zen.fhir/base-schema",
    //TODO: need process this type
    "zen.fhir/value-set",
    "fhir.bulk.export/bulk-export-status"
]


const zenConfirms: Record<string, string> = {}

const findConfirms = (schema: any, confirms: any) => [...new Set(confirms?.map((c: string) => {
    if(c === 'zenbox/Resource'){
        return null;
    }
    const el = schema[c];
    if (!el) {
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
    if (!vector.every?.type && !vector.every?.confirms){
        return "any"
    }
    return "any";
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
                const baseTypes = findConfirms(schema, value.every?.confirms);
                if (baseTypes.length < 1 && typeof type === 'string'){
                    return [key in required ? key : `${key}?`, {
                        type: `Array<${type}>`,
                        desc: value.every?.["zen/desc"]
                    }]
                }
                if (baseTypes.length === 1 && typeof type === 'string'){
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
            if (value['type'] === 'zen/boolean'){
                return [key in required ? key : `${key}?`, {
                    type: "boolean",
                    desc: value["zen/desc"]
                }]
            }
            if (value.type === 'zen/datetime'){
                return [key in required ? key : `${key}?`, {
                    type: "dateTime",
                    desc: value["zen/desc"]
                }]
            }
            if (value.type === 'zen/date'){
                return [key in required ? key : `${key}?`, {
                    type: "date",
                    desc: value["zen/desc"]
                }]
            }

            if (value['type'] === 'zen/integer'){
                return [key in required ? key : `${key}?`, {
                    type: "integer",
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/number'){
                return [key in required ? key : `${key}?`, {
                    type: value?.confirms ? value.confirms[0].split('/')[1] : "number",
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/any'){
                return [key in required ? key : `${key}?`, {
                    type: `Record<string,any>`,
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/set'){
                return [key in required ? key : `${key}?`, {
                    type: "any",
                    desc: value["zen/desc"]
                }]
            }
            if (value['type'] === 'zen/map'){
                if (value['validation-type'] === 'open'){
                    if (value['validation-type'] === 'open'){
                        return [key in required ? key : `${key}?`, {
                            type: `any`,
                            desc: value["zen/desc"]
                        }]
                    }
                }
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
                if (value?.values?.type === 'zen/any'){
                    return [key in required ? key : `${key}?`, {
                        type: `Record<string,any>`,
                        desc: value["zen/desc"]
                    }]
                }
                if (value?.values?.keys){
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
        if (!value['type']){
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


const rpcParamsType = (schema:any, type: string, validationType?: string) => {
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
    const result: any = Object.entries<any>(filteredSchema).map(([key,value]) => {
        if (value['zen/tags'].includes('fhir/primitive-type')){
           return {
               desc: value["zen/desc"] || null,
               name: value['zen/name'].split('/')[1],
               primitive: value['type'] === 'zen/map' ?  `Record<string,any>` : value['type'].split('/')[1]
           }
        }

        if (value['zen.fhir/profileUri'] && value['zen/tags']?.includes('zen.fhir/structure-schema')){
            return null;
        }
        if (value['zen/tags'].includes('zen.fhir/search')){
            return null;
        }
        if (value['zen/tags'].includes('zen/primitive')){
            return null;
        }

        if (value['zen/tags']?.includes('zenbox/rpc')) {
            const [namespace, name] = key.split('/');
            const paramsType = value?.params?.type;

            return {
                desc: value["zen/desc"] || null,
                name: `Rpc${capitalize(namespace.split(".").reverse()[0])}${name.split('-').map(n => capitalize(n)).join("")}`,
                def: {
                    method: key,
                    params: rpcParamsType(filteredSchema, paramsType, value?.params?.['validation-type'])
                }
            }
        } else {
            let name;
            if (value?.['zen/name']?.startsWith('fhir/')){
                name = value['zen/name'].split('/')[1];
            } else {
                name = value["zen.fhir/type"] || value["resourceType"] || value['zen/name'].split('/')[1];
            }
            if (!name) {
                console.log("Name missed for ", key)
            }
            const required = value['require'];
            let type;

            if (value['zen/tags'].includes('zenbox/persistent') && ( value['validation-type'] === 'open' || value['values']?.type === 'zen/any')){
                type = {
                    desc: value["zen/desc"] || null,
                    name,
                    extends: value['confirms'] ? findConfirms(filteredSchema, value['confirms']).join(' | ') : [],
                    defs: {
                        "[key:string]?":'any'
                    }
                }
            } else {
                type = {
                    desc: value["zen/desc"] || null,
                    name,
                    extends: value['confirms'] ? findConfirms(filteredSchema, value['confirms']).join(' | ') : [],
                    defs: parseZenMap(filteredSchema, value.keys, required)
                }
            }
            return type;
        }
    }).filter(Boolean)

    await fs.writeFile('./types.json', JSON.stringify(result, null ,2))
}

if (require.main === module) {
    const start = Date.now();
    console.log("Generating types…");
    parseZenSchema();

}
