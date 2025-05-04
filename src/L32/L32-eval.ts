// ===========================================================
// L32-eval.ts

import { map } from "ramda";
import { isCExp, isLetExp, isDictExp, DictExp } from "./L32-ast";
import {
    BoolExp, CExp, Exp, IfExp, LitExp, NumExp, PrimOp, ProcExp, Program,
    StrExp, VarDecl, isAppExp, isBoolExp, isDefineExp, isIfExp, isLitExp,
    isNumExp, isPrimOp, isProcExp, isStrExp, isVarRef
} from "./L32-ast";
import {
    makeBoolExp, makeLitExp, makeNumExp, makeProcExp, makeStrExp
} from "./L32-ast";
import { parseL32Exp } from "./L32-ast";
import { applyEnv, makeEmptyEnv, makeEnv, Env } from "./L32-env";
import { isClosure, makeClosure, Closure, Value, makeDictValue, isDictValue } from "./L32-value";
import { first, rest, isEmpty, List, isNonEmptyList } from '../shared/list';
import { isBoolean, isNumber, isString } from "../shared/type-predicates";
import { Result, makeOk, makeFailure, bind, mapResult, mapv } from "../shared/result";
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
    isDictExp(exp) ? (
        bind(
            mapResult(
                (pair) => bind(L32applicativeEval(pair.val, env), (v: Value) =>
                    makeOk([pair.key, v] as [string, Value])
                ),
                exp.pairs
            ),
            (entries: [string, Value][]) => makeOk(makeDictValue(Object.fromEntries(entries)))
        )
    ) :
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
    isDictValue(proc) ?
        (args.length === 1 && typeof args[0] === "object" && "val" in args[0]) ?
            (proc.map[args[0].val] !== undefined ?
                makeOk(proc.map[args[0].val]) :
                makeFailure(`Key '${args[0].val}' not found`)) :
            makeFailure("Dict access requires a symbol key") :
    makeFailure(`Bad procedure ${format(proc)}`);

    const valueToLitExp = (v: Value): NumExp | BoolExp | StrExp | LitExp | PrimOp | ProcExp => {
        if (isNumber(v)) return makeNumExp(v);
        if (isBoolean(v)) return makeBoolExp(v);
        if (isString(v)) return makeStrExp(v);
        if (isPrimOp(v)) return v;
        if (isClosure(v)) return makeProcExp(v.params, v.body);
    
        // טיפול במקרה השגוי:
        if (isDictValue(v)) {
            throw new Error("Cannot quote a dictionary value");
        }
    
        return makeLitExp(v);
    };

const applyClosure = (proc: Closure, args: Value[], env: Env): Result<Value> => {
    const vars = map((v: VarDecl) => v.var, proc.params);
    const body = renameExps(proc.body);
    const litArgs = map(valueToLitExp, args);
    return evalSequence(substitute(body, vars, litArgs), env);
};

export const evalSequence = (seq: List<Exp>, env: Env): Result<Value> =>
    isNonEmptyList<Exp>(seq) ? 
        isDefineExp(first(seq)) ? evalDefineExps(first(seq), rest(seq), env) :
        evalCExps(first(seq), rest(seq), env) :
    makeFailure("Empty sequence");

const evalCExps = (first: Exp, rest: Exp[], env: Env): Result<Value> =>
    isCExp(first) && isEmpty(rest) ? L32applicativeEval(first, env) :
    isCExp(first) ? bind(L32applicativeEval(first, env), _ => 
                            evalSequence(rest, env)) :
    makeFailure("Never");

const evalDefineExps = (def: Exp, exps: Exp[], env: Env): Result<Value> =>
    isDefineExp(def) ? bind(L32applicativeEval(def.val, env), (rhs: Value) => 
                                evalSequence(exps, makeEnv(def.var.var, rhs, env))) :
    makeFailure(`Unexpected in evalDefine: ${format(def)}`);

export const evalL32program = (program: Program): Result<Value> =>
    evalSequence(program.exps, makeEmptyEnv());

export const evalParse = (s: string): Result<Value> =>
    bind(p(s), (sexp: Sexp) => 
        bind(parseL32Exp(sexp), (exp: Exp) =>
            evalSequence([exp], makeEmptyEnv())));
