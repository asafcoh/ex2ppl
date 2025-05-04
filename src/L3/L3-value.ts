// ===========================================================
// L32-value.ts — Value type definition for L3 / L32

import { isPrimOp, CExp, PrimOp, VarDecl } from './L3-ast';
import { isNumber, isArray, isString } from '../shared/type-predicates';
import { append } from 'ramda';

// ========================================================
// Value & Functional

export type Value = SExpValue;
export type Functional = PrimOp | Closure;

export const isFunctional = (x: any): x is Functional =>
    isPrimOp(x) || isClosure(x);

// ========================================================
// Closure

export type Closure = {
    tag: "Closure";
    params: VarDecl[];
    body: CExp[];
};
export const makeClosure = (params: VarDecl[], body: CExp[]): Closure =>
    ({ tag: "Closure", params, body });
export const isClosure = (x: any): x is Closure =>
    typeof x === "object" && x !== null && x.tag === "Closure";

// ========================================================
// SExpValue Types

export type CompoundSExp = {
    tag: "CompoundSexp";
    val1: SExpValue;
    val2: SExpValue;
};
export type EmptySExp = {
    tag: "EmptySExp";
};
export type SymbolSExp = {
    tag: "SymbolSExp";
    val: string;
};

export type SExpValue =
    | number
    | boolean
    | string
    | PrimOp
    | Closure
    | SymbolSExp
    | EmptySExp
    | CompoundSExp;

// ========================================================
// Constructors

export const makeCompoundSExp = (val1: SExpValue, val2: SExpValue): CompoundSExp =>
    ({ tag: "CompoundSexp", val1, val2 });

export const makeEmptySExp = (): EmptySExp =>
    ({ tag: "EmptySExp" });

export const makeSymbolSExp = (val: string): SymbolSExp =>
    ({ tag: "SymbolSExp", val });

// ========================================================
// Type Guards

export const isCompoundSExp = (x: any): x is CompoundSExp =>
    typeof x === "object" && x !== null && x.tag === "CompoundSexp";

export const isEmptySExp = (x: any): x is EmptySExp =>
    typeof x === "object" && x !== null && x.tag === "EmptySExp";

export const isSymbolSExp = (x: any): x is SymbolSExp =>
    typeof x === "object" && x !== null && x.tag === "SymbolSExp";

export const isSExpValue = (x: any): x is SExpValue =>
    typeof x === "number" ||
    typeof x === "boolean" ||
    typeof x === "string" ||
    isPrimOp(x) ||
    isClosure(x) ||
    isSymbolSExp(x) ||
    isCompoundSExp(x) ||
    isEmptySExp(x);

// ========================================================
// Printing

export type LitSExp = number | boolean | string | SymbolSExp | EmptySExp | CompoundSExp;

export const closureToString = (c: Closure): string =>
    `<Closure ${c.params.map(p => p.var).join(" ")} ${c.body}>`;

export const compoundSExpToArray = (
    cs: CompoundSExp,
    res: string[]
): string[] | { s1: string[]; s2: string } =>
    isEmptySExp(cs.val2)
        ? append(valueToString(cs.val1), res)
        : isCompoundSExp(cs.val2)
        ? compoundSExpToArray(cs.val2, append(valueToString(cs.val1), res))
        : ({ s1: append(valueToString(cs.val1), res), s2: valueToString(cs.val2) });

export const compoundSExpToString = (
    cs: CompoundSExp,
    css = compoundSExpToArray(cs, [])
): string =>
    Array.isArray(css)
        ? `(${css.join(" ")})`
        : `(${css.s1.join(" ")} . ${css.s2})`;

export const valueToString = (val: Value): string =>
    typeof val === "number"
        ? val.toString()
        : val === true
        ? "#t"
        : val === false
        ? "#f"
        : typeof val === "string"
        ? `"${val}"`
        : isClosure(val)
        ? closureToString(val)
        : isPrimOp(val)
        ? val.op
        : isSymbolSExp(val)
        ? val.val
        : isEmptySExp(val)
        ? "'()"
        : isCompoundSExp(val)
        ? compoundSExpToString(val)
        : `unknown-value`;
