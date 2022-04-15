import * as fs from "fs/promises";
import axios from "axios";

const primitives = [
    "base64Binary",
    "boolean",
    "canonical",
    "code",
    "date",
    "dateTime",
    "decimal",
    "id",
    "instant",
    "integer",
    "integer64",
    "markdown",
    "oid",
    "positiveInt",
    "string",
    "time",
    "unsignedInt",
    "uri",
    "url",
    "uuid",
];

const types = "intrface Reference<T> { resourceType: T, id: string }";

const box = axios.create({
    baseURL: 'http://localhost:8765',
    auth: {
        username: 'root',
        password: 'secret',
    },
});


const getZenSymbolDef = async (symbol : string) => {
    const resp = await box.post("/rpc", {
        method: "aidbox.zen/symbol",
        params: { name: symbol },
    });

    const result = resp.data.result;

    return result;
}

const getZenSymbolDefsByTag = async(tag: string) => {
    const resp = await box.post("/rpc", {
        method: "aidbox.zen/tagged-symbols",
        params: { tag: tag }
    });

    const result = resp.data.result;

    return result;
}

const findSymbolDeps = (symbol: any) => {
    let deps:any = [];
    const finder = (reducedSymbol : any) => {
        if (reducedSymbol.confirms) {
            deps = deps.concat(reducedSymbol.confirms);
        }
        Object.values(reducedSymbol).map( (val: any) => {
            if (Array.isArray(val)) {
                return val.map(finder);
            } else if (val === null) {
                return;
            } else if (typeof val === "object") {
                return finder(val);
            }
        })
    };
    finder(symbol);
    return [... new Set(deps)];
}

const collectSymbolDeps = async (symbols: any) => {
    let collected = symbols;
    let deps: any = Object.values(symbols).map(findSymbolDeps);
    deps = [... new Set(deps.flat())];

    deps = deps.filter((dep:any) => !collected[dep]);

    if(deps.length === 0) {
        return collected;
    }

    for (const dep of deps) {
        const symbol = await getZenSymbolDef(dep);
        collected[dep] = symbol;
    }

    collectSymbolDeps(collected);
}

const getFhirTypeFromSymbol = (symbol:string) => {
    if (symbol.startsWith('zen.fhir')) {
        return symbol.split('/')[1];
    }
    const ns = symbol.split('/')[0];
    const nsParts = ns.split('.')
    const type = nsParts[nsParts.length - 1];
    return type;
}


const generateInterface = (symbolName:any, symbolDef:any) => {
    const type = getFhirTypeFromSymbol(symbolName);
    if (symbolDef.type == "zen/map") {
        let str = `export interface ${type} { \n`;
        const fields = symbolDef.keys;
        for (const key of Object.keys(fields)) {
            str = str + `${key}: `
            if (fields[key].confirms) {
                str = str + fields[key].confirms.map(getFhirTypeFromSymbol).join(" & ")
                str = str + ';\n'
            } else if (fields[key].type === 'zen/vector') {
                str = str + `Array<`;
                str = str + fields[key].every.confirms.map(getFhirTypeFromSymbol).join(" & ");
                str = str + `>;\n`;
            }
        }
        console.log(str)
    }
}

const getSchemas = async () => {
    let zsd = await getZenSymbolDefsByTag('zen.fhir/base-schema');
    await collectSymbolDeps(zsd);

    generateInterface('hl7-fhir-r4-core.Patient/schema', zsd['hl7-fhir-r4-core.Patient/schema'])

    const res3 = await box.post("/rpc", {
        method: "aidbox.zen/tagged-symbols",
        params: { tag: "zen.fhir/structure-schema" },
    });

    const zenPrimitives = Object.values(res3.data.result).filter((item: any) => {
        return primitives.some((i) => item["zen.fhir/type"] === i) && !item.confirms;
    });

    const res = await box.post("/rpc", {
        method: "aidbox.zen/tagged-symbols",
        params: { tag: "zen.fhir/base-schema" },
    });

    // console.dir(test, { depth: 10 });
    // console.log(test.length);

    // const response = res.data.result.map((item: any) => item["zen.fhir/type"]);
    // console.dir(response, { depth: 10 });
    //
    // const res2 = await box.post("/rpc", {
    //   method: "aidbox.zen/tagged-symbols",
    //   params: { tag: "zen.fhir/profile-schema" },
    // });
    //
    // const response2 = res2.data.result.map((item: any) => item["zen.fhir/type"]);
    // console.dir(response2, { depth: 10 });

    const response = Object.values(res.data.result).find((item: any) => item["zen.fhir/type"] === "Patient");
    // console.dir(response, { depth: 10 });

    const str = `export interface Patient { ${Object.entries(parseSchema(response.keys))
        .map(([key, value]) => `${key}: ${value}`)
        .join(",/n")} }`;

    fs.writeFile("./test-types.ts", str);
};

const parseSchema = (keys: any) => {
    if (!keys) return undefined;

    const item = Object.entries(keys).map(([key, value]: any) => {
        return parseSingleAttribute(key, value);
    });

    return item.reduce((acc: any, i: any) => ({ ...acc, ...i }), {});
};

const zenPrimitivesToTS = {
    "hl7-fhir-r4-core.boolean/schema": "boolean",
};

const parseSingleAttribute = (name: string, value: any) => {
    name === "active" && true; // console.log(value.confirms);
    const primitive = value.confirms?.map((i: string) => zenPrimitivesToTS[i]).shift();

    name === "active" && true; // console.log(primitive);
    if (primitive) {
        return { [name]: primitive };
    }

    if (value.confirms?.includes("zen.fhir/Reference")) {
        return { [name]: mapReferenceToType(value) };
    }
    //
    // if (value.confirms?.includes("hl7-fhir-r4-core.CodeableConcept/schema")) {
    //   return { [name]: "hl7-fhir-r4-core.CodeableConcept/schema" };
    // }
    //
    // if (value.confirms?.includes("hl7-fhir-r4-core.Identifier/schema")) {
    //   return { [name]: "hl7-fhir-r4-core.Identifier/schema" };
    // }
    //
    // if (value.confirms?.includes("hl7-fhir-r4-core.ContactPoint/schema")) {
    //   return { [name]: "hl7-fhir-r4-core.ContactPoint/schema" };
    // }
    //
    // if (value.confirms?.includes("hl7-fhir-r4-core.Address/schema")) {
    //   return { [name]: "hl7-fhir-r4-core.ContactPoint/schema" };
    // }
    //
    // if (value.type === "zen/vector") {
    //   return { [name]: parseVectorAttribute(parseSchema(value.every.keys)) };
    // }
};

const parseVectorAttribute = (attribute: any) => {
    return `Array<${JSON.stringify(attribute)}>`;
};

const mapReferenceToType = (reference: any) => {
    const names = reference["zen.fhir/reference"].refers;
    return names.map((i: string) => `Reference<${i}>`).join(" | ");
};

if (require.main === module) {
    const start = Date.now();
    if (!process.env.USE_CACHE) {
        console.log(
            "Cache is disabled. Use `make generate-aidbox-types USE_CACHE=1` to cache aidbox requests and speed up types generation",
        );
    }
    console.log("Generating types…");
    getSchemas();
    // main()
    //   .then(() => {
    //     console.log(`Done in ${Date.now() - start}ms`);
    //   })
    //   .catch((err) => {
    //     console.error(err?.isAxiosError ? err.response.data : err);
    //   });
}
