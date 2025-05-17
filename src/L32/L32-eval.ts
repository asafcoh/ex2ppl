// ===========================================================
// L32-eval.ts

import { map } from "ramda";
import { isCExp, isLetExp, isDictExp } from "./L32-ast";
import {
    BoolExp, CExp, Exp, IfExp, LitExp, NumExp, PrimOp, ProcExp, Program,
    StrExp, VarDecl, isAppExp, isBoolExp, isDefineExp, isIfExp, isLitExp,
    isNumExp, isPrimOp, isProcExp, isStrExp, isVarRef
} from "./L32-ast";
import {
    makeBoolExp, makeLitExp, makeNumExp, makeProcExp, makeStrExp,DictExp
} from "./L32-ast";
import { parseL32Exp } from "./L32-ast";
import { applyEnv, makeEmptyEnv, makeEnv, Env } from "./L32-env";
import {
    isClosure, makeClosure, Closure, Value,SExpValue, isEmptySExp,SymbolSExp,isCompoundSExp,
    makeDictValue, isDictValue, isSymbolSExp, CompoundSExp, EmptySExp, makeEmptySExp, makeCompoundSExp
} from "./L32-value";
import { first, rest, isEmpty, List, isNonEmptyList } from '../shared/list';
import { isBoolean, isNumber, isString } from "../shared/type-predicates";
import { Result, makeOk, makeFailure, bind, mapResult, isFailure } from "../shared/result";
import { renameExps, substitute } from "./substitute";
import { applyPrimitive } from "./evalPrimitive";
import { parse as p } from "../shared/parser";
import { Sexp } from "s-expression";
import { format } from "../shared/format";


// ========================================================
// Eval functions

const L32applicativeEval = (exp: CExp, env: Env): Result<Value> =>
    isNumExp(exp) ? makeOk(exp.val) : 
    isBoolExp(exp) ? makeOk(exp.val) :
    isStrExp(exp) ? makeOk(exp.val) :
    isPrimOp(exp) ? makeOk(exp) :
    isVarRef(exp) ? applyEnv(env, exp.var) :
    isLitExp(exp) ? makeOk(exp.val) :
    isIfExp(exp) ? evalIf(exp, env) :
    isProcExp(exp) ? evalProc(exp, env) :
    isAppExp(exp) ? bind(L32applicativeEval(exp.rator, env), (rator: Value) =>
                        bind(mapResult(param => L32applicativeEval(param, env), exp.rands), (rands: Value[]) =>
                            L32applyProcedure(rator, rands, env))) :
    isLetExp(exp) ? makeFailure('"let" not supported (yet)') :
    isDictExp(exp) ? evalDictExp(exp, env) :
    makeFailure(`Unknown expression type: ${format(exp)}`);

export const isTrueValue = (x: Value): boolean =>
    !(x === false);

const evalIf = (exp: IfExp, env: Env): Result<Value> =>
    bind(L32applicativeEval(exp.test, env), (test: Value) => 
        isTrueValue(test) ? L32applicativeEval(exp.then, env) : 
        L32applicativeEval(exp.alt, env));

const evalProc = (exp: ProcExp, env: Env): Result<Closure> =>
    makeOk(makeClosure(exp.args, exp.body));

const L32applyProcedure = (proc: Value, args: Value[], env: Env): Result<Value> =>
    isPrimOp(proc) ? applyPrimitive(proc, args) :
    isClosure(proc) ? applyClosure(proc, args, env) :
    isDictValue(proc)
        ? (args.length === 1 && isSymbolSExp(args[0]))
            ? dictLookup(proc.pairs, args[0])
            : makeFailure("Dict access requires a symbol key")
        : makeFailure(`Bad procedure ${format(proc)}`);

export const dictLookup = (pairs: CompoundSExp | EmptySExp, key: SymbolSExp): Result<Value> => {
    if (isEmptySExp(pairs)) {
        return makeFailure(`Key '${key.val}' not found`);
    }
    
    if (isCompoundSExp(pairs)) {
        const pair = pairs.val1;
        if (isCompoundSExp(pair) && isSymbolSExp(pair.val1)) {
            if (pair.val1.val === key.val) {
                return makeOk(pair.val2);
            }
        }
        
        return dictLookup(pairs.val2 as CompoundSExp | EmptySExp, key);
    }
    
    return makeFailure("Invalid dictionary structure");
};

const valueToLitExp = (v: Value): NumExp | BoolExp | StrExp | LitExp | PrimOp | ProcExp => {
    if (isNumber(v)) return makeNumExp(v);
    if (isBoolean(v)) return makeBoolExp(v);
    if (isString(v)) return makeStrExp(v);
    if (isPrimOp(v)) return v;
    if (isClosure(v)) return makeProcExp(v.params, v.body);
    if (isDictValue(v)) throw new Error("Cannot quote a dictionary value");
    return makeLitExp(v);
};

const applyClosure = (proc: Closure, args: Value[], env: Env): Result<Value> => {
    const vars = map((v: VarDecl) => v.var, proc.params);
    const body = renameExps(proc.body);
    const litArgs = map(valueToLitExp, args);
    return evalSequence(substitute(body, vars, litArgs), env);
};

export const evalSequence = (seq: List<Exp>, env: Env): Result<Value> => {
    if (!isNonEmptyList<Exp>(seq)) {
        return makeFailure("Empty sequence");
    }

    const firstExp = first(seq);    // seq כבר NonEmptyList<Exp>
    const restExps = rest(seq);     // לכן גם אלו בטוחים טיפוסית

    return isDefineExp(firstExp)
        ? evalDefineExps(firstExp, restExps, env)
        : evalCExps(firstExp, restExps, env);
};

const evalCExps = (first: Exp, rest: Exp[], env: Env): Result<Value> =>
    isCExp(first) && isEmpty(rest)
        ? L32applicativeEval(first, env)
        : isCExp(first)
            ? bind(L32applicativeEval(first, env), _ =>
                evalSequence(rest, env))
            : makeFailure("Unexpected expression");

const evalDefineExps = (def: Exp, exps: Exp[], env: Env): Result<Value> =>
    isDefineExp(def)
        ? bind(L32applicativeEval(def.val, env), (rhs: Value) =>
            evalSequence(exps, makeEnv(def.var.var, rhs, env)))
        : makeFailure(`Unexpected in evalDefine: ${format(def)}`);

const makePrimEnv = (): Env => {
            const primNames = ["dict", "get", "bind", "dict?", "is-error?"];
            const primVals = primNames.map((name): PrimOp => ({ tag: "PrimOp", op: name }));
            
            return primNames.reduceRight<Env>(
                (acc, name, i) => makeEnv(name, primVals[i], acc),
                makeEmptyEnv()
            );
        };
        
export const evalL32program = (program: Program): Result<Value> =>
            evalSequence(program.exps, makePrimEnv());

export const evalParse = (s: string): Result<Value> =>
    bind(p(s), (sexp: Sexp) => 
        bind(parseL32Exp(sexp), (exp: Exp) =>
            evalSequence([exp], makeEmptyEnv())));
// =====================
// Bind primitive (משמש את הבדיקה bind v (lambda ...))
export const bindPrim = (args: Value[]): Result<Value> => {
    if (args.length !== 2) {
        return makeFailure("bind expects two arguments");
    }

    const [firstVal, secondVal] = args;

    // אם הראשון הוא Failure – מחזירים אותו
    if ((firstVal as any)?.tag === "Failure") {
        return makeFailure((firstVal as any).message ?? "Unknown error");
    }

    // אם השני הוא Closure – ממשים אותו על הערך
    if (isClosure(secondVal)) {
        return L32applyProcedure(secondVal, [firstVal], makeEmptyEnv());
    }

    return makeFailure("bind expects a value and a lambda closure");
};

const evalDictExp = (exp: DictExp, env: Env): Result<Value> => {
    // Start with empty list
    let resultPairs: CompoundSExp | EmptySExp = makeEmptySExp();
    let currentPairs = exp.pairs;
    
    // Process each pair in the list
    while (isCompoundSExp(currentPairs)) {
        const pair = currentPairs.val1;
        if (isCompoundSExp(pair)) {
            const key = pair.val1;
            const valExp = pair.val2;
            
            if (isSymbolSExp(key) && isCExp(valExp)) {
                // Evaluate the expression
                const valResult = L32applicativeEval(valExp as CExp, env);
                if (isFailure(valResult)) {
                    return valResult;
                }
                
                // Check if we have a valid SExpValue or handle DictValue
                const val = valResult.value;
                if (isDictValue(val)) {
                    // One option: Wrap the dictionary in a LitExp (treating it as a literal)
                    return makeFailure("Cannot store dictionaries as dictionary values directly");
                    // Alternative: If you want to allow this, you'll need to modify your type system
                }
                
                // Add to the beginning of resultPairs
                const newPair = makeCompoundSExp(key, val as SExpValue);
                resultPairs = makeCompoundSExp(newPair, resultPairs);
            }
        }
        
        currentPairs = currentPairs.val2 as CompoundSExp | EmptySExp;
    }
    
    return makeOk(makeDictValue(resultPairs));
};