import * as fs from "fs/promises";
import axios from "axios";
import merge from "./merge";

const box = axios.create({
  baseURL: "http://localhost:8090",
  auth: {
    username: "root",
    password: "secret",
  },
});

const loadSymbols = async () => {
  const exist = await fs.stat("./symbols.json").catch(() => false);
  if (exist) {
    return JSON.parse((await fs.readFile("./symbols.json")).toString());
  }
  const {
    data: { result: ns },
  } = await box.post("/rpc", {
    method: "aidbox.zen/namespaces",
    params: {},
  });
  const namespaces = ns.filter(
    (namespace: string) =>
      !excludeNamespaces.some((symbol) => symbol.test(namespace))
  );

  const symbols: string[] = [];
  for (const namespace of namespaces) {
    const {
      data: { result },
    } = await box.post(
      "/rpc",
      `{
            :method aidbox.zen/symbols
            :params { :ns ${namespace}}
        }`,
      { headers: { "Content-Type": "application/edn" } }
    );
    result.map((r: any) => symbols.push(`${namespace}/${r.name}`));
  }
  const finalResult = symbols.filter(
    (s) => !excludedTags.some((exc) => s.startsWith(exc))
  );
  await fs.writeFile("./symbols.json", JSON.stringify(finalResult));
  return finalResult;
};

const capitalize = (str: string): string =>
  `${str.charAt(0).toUpperCase()}${str.slice(1)}`;

const excludeNamespaces = [
  /^aidbox/,
  /^zenbox.api/,
  /^fhir/,
  /^zen$/,
  /zenbox/,
  /zen.fhir/,
];

const excludedTags = [
  "hl7-fhir-r4-core.11179-objectClass/schema",
  "hl7-fhir-r4-core.11179-objectClassProperty/schema",
  "hl7-fhir-r4-core.11179-permitted-value-conceptmap/schema",
  "hl7-fhir-r4-core.11179-permitted-value-valueset/schema",
  "hl7-fhir-r4-core.DiagnosticReport-geneticsAssessedCondition/schema",
  "hl7-fhir-r4-core.DiagnosticReport-geneticsFamilyMemberHistory/schema",
  "hl7-fhir-r4-core.search.",
  "hl7-fhir-r4-core.value-set.",
];
const schema: Record<string, any> = {};
const zenConfirms: Record<string, string> = {};

const findConfirms = async (confirms: any = []) => {
  const result = new Set();
  for (const confirm of confirms) {
    if (confirm === "zenbox/Resource") {
      continue;
    }
    let el = schema[confirm];
    if (!el) {
      const {
        data: {
          result: { model: definition },
        },
      } = await box.post(
        "/rpc",
        `{
            :method aidbox.zen/symbol
            :params { :name ${confirm}}
        }`,
        { headers: { "Content-Type": "application/edn" } }
      );
      schema[confirm] = definition;
      el = definition;
    }

    if (zenConfirms[confirm]) {
      result.add(zenConfirms[confirm]);
    }
    const name =
      el["zen.fhir/type"] ||
      el["resourceType"] ||
      el["zen/name"].split("/")[1] ||
      `any-${confirm}`;

    zenConfirms[confirm] = name;
    result.add(name);
  }
  return Array.from(result);
};

const parseZenVector = async (vector: any): Promise<any> => {
  if (!vector.every["type"] && vector.every["confirms"]) {
    if (vector.every?.["zen.fhir/reference"]?.refers) {
      const refers = await findConfirms(
        vector.every["zen.fhir/reference"]?.refers
      );
      return refers?.length
        ? `Reference<'${refers.join("' | '")}'>`
        : `Reference`;
    }
    return (await findConfirms(vector.every["confirms"])).join(" | ");
  } else if (vector.every.type === "zen/map") {
    if (vector.every.keys) {
      return await parseZenMap(vector.every.keys, vector.every?.require);
    }
    return "'vector-any'";
  }
  if (vector.every?.type === "zen/string") {
    return "string";
  }
  if (vector.every?.type === "zen/datetime") {
    return "dateTime";
  }
  if (!vector.every?.type && !vector.every?.confirms) {
    return "'vector-any'";
  }
  return "'vector-any'";
};

const parseZenMap = async (
  keys: any,
  required: string[] = []
): Promise<any> => {
  const result = [];
  for (const [key, value] of Object.entries<any>(keys)) {
    if (!value["type"] && value["confirms"]) {
      if (value["zen.fhir/reference"]?.refers) {
        const refers = await findConfirms(value["zen.fhir/reference"]?.refers);
        result.push([
          key in required ? key : `${key}?`,
          {
            type: refers?.length
              ? `Reference<'${refers.join("' | '")}'>`
              : `Reference`,
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }
      result.push([
        key in required ? key : `${key}?`,
        {
          type: (await findConfirms(value["confirms"])).join(" | "),
          desc: value["zen/desc"],
        },
      ]);
      continue;
    } else if (value["type"]) {
      if (value["type"] === "zen/vector") {
        const type = await parseZenVector(value);
        const baseTypes = await findConfirms(value.every?.confirms);
        if (baseTypes.length < 1 && typeof type === "string") {
          result.push([
            key in required ? key : `${key}?`,
            {
              type: `Array<${type}>`,
              desc: value.every?.["zen/desc"],
            },
          ]);
          continue;
        }
        if (baseTypes.length === 1 && typeof type === "string") {
          result.push([
            key in required ? key : `${key}?`,
            {
              type: `Array<${type}>`,
              desc: value.every?.["zen/desc"],
            },
          ]);
          continue;
        }
        result.push([
          key in required ? key : `${key}?`,
          {
            array: true,
            baseTypes: baseTypes?.length ? baseTypes : null,
            subType: type,
            desc: value.every?.["zen/desc"],
          },
        ]);
        continue;
      }

      if (value["type"] === "zen/string") {
        result.push([
          key in required ? key : `${key}?`,
          {
            type: "string",
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }
      if (value["type"] === "zen/boolean") {
        result.push([
          key in required ? key : `${key}?`,
          {
            type: "boolean",
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }
      if (value.type === "zen/datetime") {
        result.push([
          key in required ? key : `${key}?`,
          {
            type: "dateTime",
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }
      if (value.type === "zen/date") {
        result.push([
          key in required ? key : `${key}?`,
          {
            type: "date",
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }

      if (value["type"] === "zen/integer") {
        result.push([
          key in required ? key : `${key}?`,
          {
            type: "integer",
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }
      if (value["type"] === "zen/number") {
        result.push([
          key in required ? key : `${key}?`,
          {
            type: value?.confirms ? value.confirms[0].split("/")[1] : "number",
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }
      if (value["type"] === "zen/any") {
        result.push([
          key in required ? key : `${key}?`,
          {
            type: `Record<string,any>`,
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }
      if (value["type"] === "zen/set") {
        console.log(key, value);
        result.push([
          key in required ? key : `${key}?`,
          {
            array: true,
            type: "any",
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }
      if (value["type"] === "zen/map") {
        if (value["validation-type"] === "open") {
          if (value["validation-type"] === "open") {
            result.push([
              key in required ? key : `${key}?`,
              {
                type: `any`,
                desc: value["zen/desc"],
              },
            ]);
            continue;
          }
        }
        if (value["confirms"]) {
          const baseTypes = await findConfirms(value.confirms);
          if (value["validation-type"] === "open") {
            result.push([
              key in required ? key : `${key}?`,
              {
                type: `${baseTypes.join(" & ")} & any`,
                desc: value["zen/desc"],
              },
            ]);
            continue;
          }

          if (value?.keys) {
            result.push([
              key in required ? key : `${key}?`,
              {
                baseTypes: baseTypes,
                subType: await parseZenMap(value["keys"], value["require"]),
                desc: value["zen/desc"],
              },
            ]);
            continue;
          }
          result.push([
            key in required ? key : `${key}?`,
            {
              type: "any",
              desc: value["zen/desc"],
            },
          ]);
          continue;
        }
        if (value?.keys) {
          result.push([
            key in required ? key : `${key}?`,
            {
              type: await parseZenMap(value["keys"], value["require"]),
              desc: value["zen/desc"],
            },
          ]);
          continue;
        }
        if (value?.values?.type === "zen/any") {
          result.push([
            key in required ? key : `${key}?`,
            {
              type: `Record<string,any>`,
              desc: value["zen/desc"],
            },
          ]);
          continue;
        }
        if (value?.values?.keys) {
          result.push([
            key in required ? key : `${key}?`,
            {
              type: await parseZenMap(
                value.values.keys,
                value.values?.["require"]
              ),
              desc: value["zen/desc"],
            },
          ]);
          continue;
        }
        console.log("map", value);
        result.push([
          key in required ? key : `${key}?`,
          {
            type: "'map-any'",
            desc: value["zen/desc"],
          },
        ]);
        continue;
      }
    }
    //TODO: process this later
    if (value["fhir/polymorphic"]) {
      result.push([
        key in required ? key : `${key}?`,
        {
          type: "'map-any'",
          desc: value["zen/desc"],
        },
      ]);
      continue;
    }
    if (value["validation-type"] === "open") {
      result.push([
        key in required ? key : `${key}?`,
        {
          type: "any",
          desc: value["zen/desc"],
        },
      ]);
      continue;
    }
    if (!value["type"]) {
      result.push([
        key in required ? key : `${key}?`,
        {
          type: "any",
          desc: value["zen/desc"],
        },
      ]);
      continue;
    }
    console.log("any type", key, value);
    process.exit(1);
    return [key, { type: "any" }];
  }
  return Object.fromEntries(result);
};

const rpcParamsType = (type: string, validationType?: string) => {
  switch (type) {
    case "zen/map":
      return validationType === "open" ? "Record<string,any>" : "need-map";
    default:
      return "rpc-any";
  }
};

const getPrimitiveTypes = (type: string): string => {
  switch (type) {
    case "zen/string":
      return "string";
    case "zen/boolean":
      return "boolean";
    case "zen/date":
      return "string";
    case "zen/datetime":
      return "string";
    case "zen/number":
      return "number";
    case "zen/integer":
      return "number";
    default:
      console.log(type);
      process.exit(1);
  }
};

const parseZenSchema = async () => {
  const symbols: string[] = await loadSymbols();
  const result: any = [];
  for (const symbol of symbols) {
    const {
      data: {
        result: { model: definition },
      },
    } = await box.post(
      "/rpc",
      `{
            :method aidbox.zen/symbol
            :params { :name ${symbol}}
        }`,
      { headers: { "Content-Type": "application/edn" } }
    );

    schema[symbol] = definition;
    let type;

    if (definition["zen/tags"].includes("zen.fhir/search")) {
      continue;
    }
    if (definition["zen/tags"]?.includes("zenbox/rpc")) {
      const [namespace, name] = symbol.split("/");
      const paramsType = definition?.params?.type;
      type = {
        desc: definition["zen/desc"] || null,
        name: `Rpc${capitalize(namespace.split(".").reverse()[0])}${name
          .split("-")
          .map((n) => capitalize(n))
          .join("")}`,
        def: {
          method: symbol,
          params: rpcParamsType(
            paramsType,
            definition?.params?.["validation-type"]
          ),
        },
      };
    } else {
      const name =
        definition["zen.fhir/type"] ||
        definition["resourceType"] ||
        definition["zen/name"].split("/")[1];
      if (!name) {
        console.log("Name missed for ", symbol);
      }
      const required = definition["require"];

      const confirms = await findConfirms(definition["confirms"]);

      if (
        definition["zen/tags"].includes("zen.fhir/structure-schema") &&
        definition["type"] &&
        definition["type"] !== "zen/map"
      ) {
        const newName = definition["zen/name"]
          .split("/")[0]
          .split(".")
          .reverse()[0];
        const inlineType = getPrimitiveTypes(definition["type"]);
        type = {
          desc: definition["zen/desc"] || null,
          name: newName,
          type: inlineType,
        };
      } else if (
        definition["zen/tags"].includes("zen.fhir/structure-schema") &&
        !definition["type"]
      ) {
        if (!definition["zen/name"].split(".")[1].includes("-")) {
          if (confirms.join(", ") !== name) {
            type = {
              desc: definition["zen/desc"] || null,
              name,
              extends: definition["confirms"] ? confirms.join(", ") : [],
            };
          } else {
            const newName = definition["zen/name"]
              .split("/")[0]
              .split(".")
              .reverse()[0];
            type = {
              desc: definition["zen/desc"] || null,
              name: newName,
              extends: definition["confirms"] ? confirms.join(", ") : [],
            };
          }
        }
      } else if (
        definition["zen/tags"].includes("zenbox/persistent") &&
        (definition["validation-type"] === "open" ||
          definition["values"]?.type === "zen/any")
      ) {
        type = {
          desc: definition["zen/desc"] || null,
          name,
          extends: definition["confirms"] ? confirms.join(", ") : [],
          defs: {
            "[key:string]?": "any",
          },
        };
      } else {
        type = {
          desc: definition["zen/desc"] || null,
          name,
          extends: definition["confirms"] ? confirms.join(", ") : [],
          defs: await parseZenMap(definition.keys, required),
        };
      }
    }
    result.push(type);
  }

  await fs.writeFile("./types.json", JSON.stringify(result, null, 2));
};

const writeNestedType = (defs: any) => {
  let type = "";
  for (const [key, value] of Object.entries<any>(defs)) {
    if (value.desc) {
      type += ` /*${value.desc.replace(/\r?\n|\r/, "")}*/\n`;
    }
    if (typeof value.type === "string") {
      type += ` ${key}: ${value.type};\n `;
    } else if (value?.array) {
      if (value?.baseTypes && value.baseTypes.join(" | ") === value?.subType) {
        type += ` ${key}: Array<${value.subType}>;\n`;
      } else {
        type += ` ${key}: Array<${
          value?.baseTypes && value.baseTypes.join(" & ") + " & "
        } {\n${writeNestedType(value.subType)}}>;\n`;
      }
    } else if (value?.baseTypes) {
      type += ` ${key}: ${
        value.baseTypes.join(" & ") + " & "
      } {\n${writeNestedType(value.subType)}};\n`;
    } else {
      type += ` ${key}: {\n`;
      type += ` ${writeNestedType(value.type)}`;
      type += `}\n`;
    }
  }
  return type;
};

const writeTypes = async () => {
  let types =
    "export interface Reference<T = string> {\n id: string;\n resourceType: T;\n display?:string;\n}\n\n";
  const schema: any[] = JSON.parse(
    (await fs.readFile("./types.json")).toString()
  );
  for (const element of schema
    .filter((s) => !s?.name?.startsWith("Rpc"))
    .filter(Boolean)) {
    if (element.desc) {
      types += `/*${element.desc.replace(/\r?\n|\r/, "")}*/\n`;
    }
    if (element.type) {
      types += `export type ${element.name} = ${element.type};\n`;
    } else if (!element.defs && !element.type) {
      types += `export interface ${element.name} ${
        element.extends && "extends " + element.extends
      } {}\n`;
    } else {
      console.log(
        typeof element.extends === "string" || element.extends?.length > 0
      );
      types += `export interface ${element.name} ${
        (typeof element.extends === "string" && element.extends !== "") ||
        element.extends?.length > 0
          ? "extends " + element.extends
          : ""
      } {\n`;
      if ("[key:string]?" in element.defs) {
        types += `[key: string]: any\n`;
      } else {
        types += writeNestedType(element.defs);
      }
      types += " }\n\n";
    }
  }
  await fs.writeFile("generated-types.ts", types);
  // process.exit(1);
};

if (require.main === module) {
  const start = Date.now();
  console.log("Generating types…");
  //   parseZenSchema();
  writeTypes();
}
