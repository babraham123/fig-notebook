/**
 * Used by both widget and iframe
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
  display?: Obj;
}

export interface Code {
  language: string;
  code: string;
  testCode: string;
}

export interface NodeQuery {
  selector: string;
  id?: string;
}

export type StatusType = "READY";

export type CommandType = "RUN" | "FORMAT" | "TEST" | "QUERY" | "INTROSPECT";

export interface IFrameMessage {
  status?: StatusType;
  command?: CommandType;
  code?: Code;
  inputs?: Obj[];
  result?: Result;
  nodeQuery?: NodeQuery;
  nodes?: any[];
  debug?: string;
}
