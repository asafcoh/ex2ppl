import { reduce } from "ramda";
import { PrimOp } from "./L32-ast";
import {
    isCompoundSExp,
    isEmptySExp,
    isSymbolSExp,
    makeCompoundSExp,
    makeEmptySExp,
    makeDictValue,
    CompoundSExp,
    EmptySExp,
    Value,
    SExpValue,
    isSExpValue,
    isDictValue
} from "./L32-value";
import { List, allT, first, isNonEmptyList, rest } from '../shared/list';
import { isBoolean, isNumber, isString } from "../shared/type-predicates";
import { Result, makeOk, makeFailure } from "../shared/result";
import { format } from "../shared/format";
import { DictValue, SymbolSExp } from "./L32-value";
import { bindPrim, dictLookup } from "./L32-eval"; // ⬅️ ייבוא חשוב!



export const applyPrimitive = (proc: PrimOp, args: Value[]): Result<Value> =>
    proc.op === "+" ? (allT(isNumber, args) ? makeOk(reduce((x, y) => x + y, 0, args)) :
        makeFailure(`+ expects numbers only: ${format(args)}`)) :
    proc.op === "-" ? minusPrim(args) :
    proc.op === "*" ? (allT(isNumber, args) ? makeOk(reduce((x, y) => x * y, 1, args)) :
        makeFailure(`* expects numbers only: ${format(args)}`)) :
    proc.op === "/" ? divPrim(args) :
    proc.op === ">" ? makeOk(args[0] > args[1]) :
    proc.op === "<" ? makeOk(args[0] < args[1]) :
    proc.op === "=" ? makeOk(args[0] === args[1]) :
    proc.op === "not" ? makeOk(!args[0]) :
    proc.op === "and" ? (isBoolean(args[0]) && isBoolean(args[1]) ? makeOk(args[0] && args[1]) :
        makeFailure(`Arguments to "and" not booleans: ${format(args)}`)) :
    proc.op === "or" ? (isBoolean(args[0]) && isBoolean(args[1]) ? makeOk(args[0] || args[1]) :
        makeFailure(`Arguments to "or" not booleans: ${format(args)}`)) :
    proc.op === "eq?" ? makeOk(eqPrim(args)) :
    proc.op === "string=?" ? makeOk(args[0] === args[1]) :
    proc.op === "cons" ? makeOk(consPrim(args[0], args[1])) :
    proc.op === "car" ? carPrim(args[0]) :
    proc.op === "cdr" ? cdrPrim(args[0]) :
    proc.op === "list" ? listPrim(args) :
    proc.op === "pair?" ? makeOk(isPairPrim(args[0])) :
    proc.op === "number?" ? makeOk(typeof args[0] === 'number') :
    proc.op === "boolean?" ? makeOk(typeof args[0] === 'boolean') :
    proc.op === "symbol?" ? makeOk(isSymbolSExp(args[0])) :
    proc.op === "string?" ? makeOk(isString(args[0])) :

    // === תוספות עבור Q23/Q24 ===
    proc.op === "dict" ? 
    makeOk(makeDictValue(makeEmptySExp())) :

    proc.op === "get" ?
    args.length === 2 && isDictValue(args[0]) && isSymbolSExp(args[1])
        ? dictLookup(args[0].pairs, args[1])
        : makeFailure("get expects a dict and a symbol") :

    proc.op === "bind" ?
    args.length === 3 && isDictValue(args[0]) && isSymbolSExp(args[1])
        ? dictBind(args[0], args[1], args[2])
        : args.length === 2
            ? bindPrim(args)
            : makeFailure("bind expects either (Result, lambda) or (dict, symbol, value)") :

    proc.op === "dict?" ?
    args.length === 1
        ? makeOk(isDictValue(args[0]))
        : makeFailure("dict? expects 1 argument") :

    proc.op === "is-error?" ?
    args.length === 1
        ? makeOk((args[0] as any)?.tag === "Failure")
        : makeFailure("is-error? expects 1 argument") :

makeFailure(`Bad primitive op: ${format(proc.op)}`);


const minusPrim = (args: Value[]): Result<number> => {
    const x = args[0], y = args[1];
    return (isNumber(x) && isNumber(y)) ? makeOk(x - y) :
        makeFailure(`Type error: - expects numbers ${format(args)}`);
};

const divPrim = (args: Value[]): Result<number> => {
    const x = args[0], y = args[1];
    return (isNumber(x) && isNumber(y)) ? makeOk(x / y) :
        makeFailure(`Type error: / expects numbers ${format(args)}`);
};

const eqPrim = (args: Value[]): boolean => {
    const [x, y] = args;
    return (isSymbolSExp(x) && isSymbolSExp(y)) ? x.val === y.val :
        (isEmptySExp(x) && isEmptySExp(y)) ? true :
        (isNumber(x) && isNumber(y)) ? x === y :
        (isString(x) && isString(y)) ? x === y :
        (isBoolean(x) && isBoolean(y)) ? x === y :
        false;
};

const carPrim = (v: Value): Result<Value> =>
    isCompoundSExp(v) ? makeOk(v.val1) :
        makeFailure(`Car: param is not compound ${format(v)}`);

const cdrPrim = (v: Value): Result<Value> =>
    isCompoundSExp(v) ? makeOk(v.val2) :
        makeFailure(`Cdr: param is not compound ${format(v)}`);

const consPrim = (v1: Value, v2: Value): CompoundSExp =>
    isSExpValue(v1) && isSExpValue(v2)
         ? makeCompoundSExp(v1, v2)
          : (() => { throw new Error("cons: arguments must be SExpValues") })();
        

const isPairPrim = (v: Value): boolean =>
    isCompoundSExp(v);

/**
 * Converts a list of Value to a proper S-expression list (CompoundSExp or EmptySExp).
 * Only works if all values are SExpValue.
 */
export const listPrim = (vals: List<Value>): Result<CompoundSExp | EmptySExp> => {
    if (!allT(isSExpValue, vals)) {
        return makeFailure("list: all arguments must be SExpValues");
    }
    const castedVals = vals as List<SExpValue>;
    return makeOk(buildSExpList(castedVals));
};

const buildSExpList = (vals: List<SExpValue>): CompoundSExp | EmptySExp =>
    isNonEmptyList(vals)
        ? makeCompoundSExp(first(vals) as SExpValue, buildSExpList(rest(vals) as List<SExpValue>))
        : makeEmptySExp();

const dictBind = (dict: DictValue, key: SymbolSExp, val: Value): Result<DictValue> => {
    // Create new pair
    const newPair = makeCompoundSExp(key, val as SExpValue);
    // Add to front of list (this will shadow any existing entries with same key)
    const newPairs = makeCompoundSExp(newPair, dict.pairs);
    return makeOk(makeDictValue(newPairs));
};


