import { isPrimOp, CExp, PrimOp, VarDecl } from './L32-ast';
import { isNumber, isArray, isString } from '../shared/type-predicates';
import { append } from 'ramda';

// ===========================================
// Value type

export type DictValue = {
    tag: "DictValue";
    map: { [key: string]: Value };
};

export type Value = SExpValue | DictValue;

export type Functional = PrimOp | Closure;
export const isFunctional = (x: any): x is Functional => isPrimOp(x) || isClosure(x);

// ===========================================
// Closure

export type Closure = {
    tag: "Closure";
    params: VarDecl[];
    body: CExp[];
};
export const makeClosure = (params: VarDecl[], body: CExp[]): Closure =>
    ({ tag: "Closure", params, body });
export const isClosure = (x: any): x is Closure => x.tag === "Closure";

// ===========================================
// SExp

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

export const isSExp = (x: any): x is SExpValue =>
        typeof x === 'string' ||
        typeof x === 'boolean' ||
        typeof x === 'number' ||
        isSymbolSExp(x) ||
        isCompoundSExp(x) ||
        isEmptySExp(x) ||
        isPrimOp(x) ||
        isClosure(x);
    
export const isSExpValue = isSExp;  // ✔ זה מוסיף תמיכה בשם שהטסטים מחפשים

export const makeCompoundSExp = (val1: SExpValue, val2: SExpValue): CompoundSExp =>
    ({ tag: "CompoundSexp", val1, val2 });

export const isCompoundSExp = (x: any): x is CompoundSExp => x.tag === "CompoundSexp";

export const makeEmptySExp = (): EmptySExp => ({ tag: "EmptySExp" });
export const isEmptySExp = (x: any): x is EmptySExp => x.tag === "EmptySExp";

export const makeSymbolSExp = (val: string): SymbolSExp =>
    ({ tag: "SymbolSExp", val });

export const isSymbolSExp = (x: any): x is SymbolSExp => x.tag === "SymbolSExp";

// ===========================================
// Dict

export const makeDictValue = (map: { [key: string]: Value }): DictValue =>
    ({ tag: "DictValue", map });

export const isDictValue = (val: any): val is DictValue =>
    val !== null && typeof val === "object" && val.tag === "DictValue";

// ===========================================
// Printable form for values

export const closureToString = (c: Closure): string =>
    `<Closure ${c.params} ${c.body}>`;

export const compoundSExpToArray = (
    cs: CompoundSExp,
    res: string[]
): string[] | { s1: string[]; s2: string } =>
    isEmptySExp(cs.val2)
        ? append(valueToString(cs.val1), res)
        : isCompoundSExp(cs.val2)
        ? compoundSExpToArray(cs.val2, append(valueToString(cs.val1), res))
        : { s1: append(valueToString(cs.val1), res), s2: valueToString(cs.val2) };

export const compoundSExpToString = (
    cs: CompoundSExp,
    css = compoundSExpToArray(cs, [])
): string =>
    isArray(css)
        ? `(${css.join(' ')})`
        : `(${css.s1.join(' ')} . ${css.s2})`;

const dictToString = (dict: DictValue): string =>
    `#dict(${Object.entries(dict.map)
        .map(([k, v]) => `(${k} ${valueToString(v)})`)
        .join(' ')})`;

export const valueToString = (val: Value): string =>
    isNumber(val)
        ? val.toString()
        : val === true
        ? '#t'
        : val === false
        ? '#f'
        : isString(val)
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
        : isDictValue(val)
        ? dictToString(val)
        : `${val}`;

