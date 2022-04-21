import { ExampleScenario } from "./generated-types";
import * as fs from "fs/promises";
import axios from "axios";
import merge from "./merge";
import prettier from "prettier";

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
  //   await fs.writeFile("./symbols.json", JSON.stringify(finalResult));
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
  "hl7-fhir-r4-core.DiagnosticReport-geneticsAnalysis/schema",
  "hl7-fhir-r4-core.DiagnosticReport-geneticsReferences/schema",
  "hl7-fhir-r4-core.allergyintolerance-substanceExposureRisk/schema",
  "hl7-fhir-r4-core.capabilitystatement-search-parameter-combination/schema",
  "hl7-fhir-r4-core.codesystem-alternate/schema",
  "hl7-fhir-r4-core.codesystem-history/schema",
  "hl7-fhir-r4-core.codesystem-otherName/schema",
  "hl7-fhir-r4-core.codesystem-usage/schema",
  "hl7-fhir-r4-core.condition-dueTo/schema",
  "hl7-fhir-r4-core.condition-occurredFollowing/schema",
  "hl7-fhir-r4-core.cqf-measureInfo/schema",
  "hl7-fhir-r4-core.cqf-relativeDateTime/schema",
  "hl7-fhir-r4-core.devicerequest-patientInstruction/schema",
  "hl7-fhir-r4-core.elementdefinition-allowedUnits/schema",
  "hl7-fhir-r4-core.elementdefinition-bestpractice/schema",
  "hl7-fhir-r4-core.elementdefinition-inheritedExtensibleValueSet/schema",
  "hl7-fhir-r4-core.elementdefinition-maxValueSet/schema",
  "hl7-fhir-r4-core.elementdefinition-minValueSet/schema",
  "hl7-fhir-r4-core.family-member-history-genetics-parent/schema",
  "hl7-fhir-r4-core.family-member-history-genetics-sibling/schema",
  "hl7-fhir-r4-core.familymemberhistory-abatement/schema",
  "hl7-fhir-r4-core.geolocation/schema",
  "hl7-fhir-r4-core.goal-acceptance/schema",
  "hl7-fhir-r4-core.goal-relationship/schema",
  "hl7-fhir-r4-core.hla-genotyping-results-glstring/schema",
  "hl7-fhir-r4-core.hla-genotyping-results-haploid/schema",
  "hl7-fhir-r4-core.maxValue/schema",
  "hl7-fhir-r4-core.minValue/schema",
  "hl7-fhir-r4-core.oauth-uris/schema",
  "hl7-fhir-r4-core.observation-geneticsAllele/schema",
  "hl7-fhir-r4-core.observation-geneticsAminoAcidChange/schema",
  "hl7-fhir-r4-core.observation-geneticsAncestry/schema",
  "hl7-fhir-r4-core.observation-geneticsPhaseSet/schema",
  "hl7-fhir-r4-core.observation-geneticsVariant/schema",
  "hl7-fhir-r4-core.patient-animal/schema",
  "hl7-fhir-r4-core.patient-citizenship/schema",
  "hl7-fhir-r4-core.patient-nationality/schema",
  "hl7-fhir-r4-core.patient-proficiency/schema",
  "hl7-fhir-r4-core.procedure-directedBy/schema",
  "hl7-fhir-r4-core.questionnaire-constraint/schema",
  "hl7-fhir-r4-core.relative-date/schema",
  "hl7-fhir-r4-core.servicerequest-geneticsItem/schema",
  "hl7-fhir-r4-core.specimen-processingTime/schema",
  "hl7-fhir-r4-core.timing-daysOfCycle/schema",
  "hl7-fhir-r4-core.translation/schema",
  "hl7-fhir-r4-core.valueset-expand-group/schema",
  "hl7-fhir-r4-core.valueset-otherName/schema",
  "hl7-fhir-r4-core.valueset-usage/schema",
];
const schema: Record<string, any> = {};
const zenConfirms: Record<string, string> = {};
const primitiveTypes: Record<string, any> = {};

const findConfirms = async (confirms: any = []) => {
  const result = new Set();
  for (const confirm of confirms) {
    if (confirm !== "zenbox/Resource") {
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
      if (el["fhir/polymorphic"]) {
        continue;
      } else if (zenConfirms[confirm]) {
        result.add(zenConfirms[confirm]);
      } else {
        const name =
          el["zen.fhir/type"] ||
          el["resourceType"] ||
          el["zen/name"].split("/")[1] ||
          `any-${confirm}`;
        const newName = name.includes("-")
          ? name.split("-").map(capitalize).join("")
          : name;
        zenConfirms[confirm] = newName;
        result.add(newName);
      }
    }
  }

  return Array.from(result);
};

const parseZenVector = async (
  vector: any,
  resourceName: string
): Promise<any> => {
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
      return await parseZenMap(
        vector.every.keys,
        vector.every?.require,
        resourceName
      );
    }
    return "'vector-any'";
  } else if (vector.every?.type === "zen/string") {
    return "string";
  } else if (vector.every?.type === "zen/datetime") {
    return "dateTime";
  } else if (!vector.every?.type && !vector.every?.confirms) {
    return "'vector-any'";
  } else {
    return "'vector-any'";
  }
};

const wrapKey = (key: string) => (key.includes("-") ? `'${key}'` : key);

const parseZenMap = async (
  keys: any,
  required: string[] = [],
  resourceName: string
): Promise<any> => {
  const result = [];
  for (const [key, value] of Object.entries<any>(keys)) {
    if (!key.startsWith("_")) {
      if (!value["type"] && value["confirms"]) {
        if (value["zen.fhir/reference"]?.refers) {
          const refers = await findConfirms(
            value["zen.fhir/reference"]?.refers
          );
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              type: refers?.length
                ? `Reference<'${refers.join("' | '")}'>`
                : `Reference`,
              desc: value["zen/desc"],
            },
          ]);
        } else {
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              type:
                (await findConfirms(value["confirms"])).join(" | ") ||
                "'confirms-any'",
              desc: value["zen/desc"],
            },
          ]);
        }
      } else if (value["type"]) {
        if (value["type"] === "zen/vector") {
          const type = await parseZenVector(value, resourceName);
          const baseTypes = await findConfirms(value.every?.confirms);
          if (baseTypes.length < 1 && typeof type === "string") {
            result.push([
              required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
              {
                type: `Array<${type}>`,
                desc: value.every?.["zen/desc"],
              },
            ]);
          } else if (baseTypes.length === 1 && typeof type === "string") {
            result.push([
              required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
              {
                type: `Array<${type}>`,
                desc: value.every?.["zen/desc"],
              },
            ]);
          } else {
            result.push([
              required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
              {
                array: true,
                baseTypes: baseTypes?.length ? baseTypes : null,
                subType: type,
                desc: value.every?.["zen/desc"],
              },
            ]);
          }
        } else if (value["type"] === "zen/string") {
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              type: "string",
              desc: value["zen/desc"],
            },
          ]);
        } else if (value["type"] === "zen/boolean") {
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              type: "boolean",
              desc: value["zen/desc"],
            },
          ]);
        } else if (value.type === "zen/datetime") {
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              type: "dateTime",
              desc: value["zen/desc"],
            },
          ]);
        } else if (value.type === "zen/date") {
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              type: "date",
              desc: value["zen/desc"],
            },
          ]);
        } else if (value["type"] === "zen/integer") {
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              type: "integer",
              desc: value["zen/desc"],
            },
          ]);
        } else if (value["type"] === "zen/number") {
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              type: value?.confirms
                ? value.confirms[0].split("/")[1]
                : "number",
              desc: value["zen/desc"],
            },
          ]);
        } else if (value["type"] === "zen/any") {
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              type: `Record<string,any>`,
              desc: value["zen/desc"],
            },
          ]);
        } else if (value["type"] === "zen/set") {
          result.push([
            required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
            {
              array: true,
              type: "any",
              desc: value["zen/desc"],
            },
          ]);
        } else if (value["type"] === "zen/map") {
          if (value["validation-type"] === "open") {
            if (value["validation-type"] === "open") {
              result.push([
                required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
                {
                  type: `any`,
                  desc: value["zen/desc"],
                },
              ]);
            }
          } else if (value["confirms"]) {
            const baseTypes = await findConfirms(value.confirms);
            if (value["validation-type"] === "open") {
              result.push([
                required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
                {
                  type: `${baseTypes.join(" & ")} & any`,
                  desc: value["zen/desc"],
                },
              ]);
            } else if (value?.keys) {
              result.push([
                required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
                {
                  baseTypes: baseTypes,
                  subType: await parseZenMap(
                    value["keys"],
                    value["require"],
                    resourceName
                  ),
                  desc: value["zen/desc"],
                },
              ]);
            } else {
              result.push([
                required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
                {
                  type: "any",
                  desc: value["zen/desc"],
                },
              ]);
            }
          } else if (value?.keys) {
            result.push([
              required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
              {
                type: await parseZenMap(
                  value["keys"],
                  value["require"],
                  resourceName
                ),
                desc: value["zen/desc"],
              },
            ]);
          } else if (value?.values?.type === "zen/any") {
            result.push([
              required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
              {
                type: `Record<string,any>`,
                desc: value["zen/desc"],
              },
            ]);
          } else if (value?.values?.keys) {
            result.push([
              required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
              {
                type: await parseZenMap(
                  value.values.keys,
                  value.values?.["require"],
                  resourceName
                ),
                desc: value["zen/desc"],
              },
            ]);
          } else {
            console.log("map", value);
            result.push([
              required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
              {
                type: "'map-any'",
                desc: value["zen/desc"],
              },
            ]);
          }
        }
      } else if (value["fhir/polymorphic"]) {
        result.push([
          required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
          {
            type: "'map-any'",
            desc: value["zen/desc"],
          },
        ]);
      } else if (value["validation-type"] === "open") {
        result.push([
          required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
          {
            type: "any",
            desc: value["zen/desc"],
          },
        ]);
      } else if (!value["type"]) {
        result.push([
          required.includes(key) ? wrapKey(key) : `${wrapKey(key)}?`,
          {
            type: "any",
            desc: value["zen/desc"],
          },
        ]);
      } else {
        console.log("any type", key, value);
        process.exit(1);
        return [key, { type: "any" }];
      }
    }
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

const normalizeConfirms = (confirms: any, name: string) => {
  if (confirms?.length === 0) {
    return {};
  } else if (confirms.length === 1 && confirms[0] === name) {
    return {};
  } else {
    const cleared = confirms.filter((c: string) => c !== name);
    return confirms?.length === 0 ? {} : { extends: cleared };
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

    if (definition["zen/tags"].includes("zen.fhir/profile-schema")) {
      continue;
    }

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
      if (
        definition["zen/tags"].length === 1 &&
        definition["zen/tags"][0] === "zen/schema"
      ) {
        if (!definition["confirms"]?.includes("zenbox/Resource")) {
          const subName = symbol
            .split("/")[1]
            .split("-")
            .map(capitalize)
            .join("");

          type = {
            desc: definition["zen/desc"] || null,
            name: subName,
            defs:
              definition["type"] === "zen/map"
                ? await parseZenMap(
                    definition["keys"],
                    definition["require"],
                    subName
                  )
                : "'schema-any'",
          };
        }
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
          primitiveTypes[newName] = inlineType;
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
                ...normalizeConfirms(confirms, name),
              };
            } else {
              const newName = definition["zen/name"]
                .split("/")[0]
                .split(".")
                .reverse()[0];
              type = {
                desc: definition["zen/desc"] || null,
                name: newName,
                ...normalizeConfirms(confirms, newName),
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
            ...normalizeConfirms(confirms, name),
            defs: {
              "[key:string]?": "any",
            },
          };
        } else {
          type = {
            desc: definition["zen/desc"] || null,
            name,
            ...normalizeConfirms(confirms, name),
            defs: await parseZenMap(definition.keys, required, name),
          };
        }
      }
    }
    result.push(type);
  }

  const finalResult = result
    .filter(Boolean)
    .reduce((acc: Record<string, any>, el: any) => {
      const { name, ...rest } = el;
      if (acc[name]) {
        return { ...acc, [name]: merge(acc[name], rest) };
      }
      return { ...acc, [name]: rest };
    }, {});

  await fs.writeFile("./types.json", JSON.stringify(finalResult, null, 2));
};

const writeNestedType = (defs: any) => {
  let type = "";
  for (const [key, value] of Object.entries<any>(defs)) {
    if (value.desc) {
      type += ` /* ${value.desc.replace(/\r?\n|\r/, "")} */\n`;
    }
    if (typeof value.type === "string") {
      type += ` ${key}: ${value.type};\n `;
    } else if (value?.array) {
      if (value?.baseTypes && value.baseTypes.join(" | ") === value?.subType) {
        type += ` ${key}: Array<${value.subType}>;\n`;
      } else {
        type += ` ${key}: Array<${
          value?.baseTypes ? value.baseTypes.join(" & ") + " & " : ""
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

  for (const [name, element] of Object.entries(schema)) {
    if (name.startsWith("Rpc") || name === "boolean" || name === "string") {
      continue;
    }
    if (element.desc) {
      types += `/* ${element.desc.replace(/\r?\n|\r/, "")} */\n`;
    }
    if (element.type) {
      types += `export type ${name} = ${element.type};\n`;
    } else if (!element.defs && !element.type) {
      if (element.extends?.length === 1 && primitiveTypes[element.extends[0]]) {
        types += `export type ${name} = ${
          primitiveTypes[element.extends[0]]
        };\n`;
      } else {
        types += `export interface ${name} ${
          element.extends ? "extends " + element.extends : ""
        } {}\n`;
      }
    } else {
      types += `export interface ${name} ${
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
};

if (require.main === module) {
  const start = Date.now();
  console.log("Generating types…");
  parseZenSchema()
    .then(() => writeTypes())
    .then(() => console.log("Generating type finished"));
}
