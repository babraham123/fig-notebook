/**
 * Used by both widget and iframe modules
 */

export type ObjType = "TEXT" | "JSON" | "CSV" | "SVG" | "BINARY" | "ERROR" | "UNDEFINED";
// BINARY = base64 encoded
// ERROR = formatted msg and stack

export interface Obj {
  type: ObjType;
  data: string;
}

export const EMPTY_OBJ: Obj = {
  type: "UNDEFINED",
  data: "",
};

export interface ErrorLike {
  name: string;
  stack: string;
  message: string;
}

export interface Result {
  output: Obj;
  inputsHash: string;
  codeHash: string;
}

export type Language = "JS" | "PY";

export interface Code {
  language: Language;
  code: string;
  testCode: string;
}

export interface NodeQuery {
  selector: string;
  id?: string;
}

export type StatusType = "READY" | "SUCCESS" | "FAILURE";

export type CommandType = "STATUS" | "SAVE" | "RUN" | "FORMAT" | "TEST" | "QUERY";
// future: "INTROSPECT"

export interface IFrameMessage {
  type: CommandType;
  status?: StatusType;
  code?: Code;
  inputs?: Obj[];
  result?: Result;
  nodeQuery?: NodeQuery;
  nodes?: any[];
  debug?: string;
}
