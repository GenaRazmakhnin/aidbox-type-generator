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

const getSchemas = async () => {
    const box = axios.create({
        baseURL: 'http://localhost:8888',
        auth: {
            username: 'root',
            password: 'secret',
        },
    });

    const res3 = await box.post("/rpc", {
        method: "aidbox.zen/tagged-symbols",
        params: { tag: "zen.fhir/structure-schema" },
    });

    const zenPrimitives = res3.data.result.filter((item: any) => {
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

    const response = res.data.result.find((item: any) => item["zen.fhir/type"] === "Patient");
    console.dir(response, { depth: 10 });

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
    name === "active" && console.log(value.confirms);
    const primitive = value.confirms?.map((i: string) => zenPrimitivesToTS[i]).shift();

    name === "active" && console.log(primitive);
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
