import {
    Program, Exp, CExp, isDefineExp, isCExp, makeProgram, makeDefineExp,
    isNumExp, isBoolExp, isStrExp, isPrimOp, isVarRef, isAppExp, isIfExp,
    isProcExp, isLitExp, isLetExp, isDictExp,
    makeAppExp, makeIfExp, makeProcExp, makeLetExp, makeBinding, makeVarDecl,
    makeLitExp, makePrimOp, makeVarRef, Binding, DictExp,AppExp
} from './L32/L32-ast';

import { makeSymbolSExp, makeEmptySExp } from './L3/L3-value';
import { makeBoolExp, makeNumExp } from './L32/L32-ast';
import { map } from 'ramda';

/*
 * Convert a single CExp from L32 to L3
 */
const L32CExpToL3 = (e: CExp): CExp =>
    isNumExp(e) ? e :
    isBoolExp(e) ? e :
    isStrExp(e) ? e :
    isPrimOp(e) ? e :
    isVarRef(e) ? e :
    isLitExp(e) ? e :
    isIfExp(e) ? makeIfExp(
        L32CExpToL3(e.test),
        L32CExpToL3(e.then),
        L32CExpToL3(e.alt)) :
    isAppExp(e) ? makeAppExp(
        L32CExpToL3(e.rator),
        map(L32CExpToL3, e.rands)) :
    isProcExp(e) ? makeProcExp(
        e.args,
        map(L32CExpToL3, e.body)) :
    isLetExp(e) ? makeLetExp(
        map((b: Binding) => makeBinding(b.var.var, L32CExpToL3(b.val)), e.bindings),
        map(L32CExpToL3, e.body)) :
    isDictExp(e) ? dictToProcApp(e) :
    e;

/*
 * Convert DictExp to AppExp form that uses the dict primitive correctly
 */

export const dictToProcApp = (dict: DictExp): CExp => {
    const isConsLikePair = (val: CExp): val is AppExp =>
        isAppExp(val) &&
        isPrimOp(val.rator) &&
        val.rator.op === "cons" &&
        val.rands.length === 2 &&
        isLitExp(val.rands[0]) &&
        typeof val.rands[0].val === "string";

    const pairsList: AppExp[] = dict.pairs.map(pair => {
        const val = pair.val;

        if (isConsLikePair(val)) {
            const keyLit = val.rands[0];
            const key = isLitExp(keyLit) && typeof keyLit.val === "string"
                ? keyLit.val
                : pair.key; // fallback key if needed

            const value = val.rands[1];
            return makeAppExp(
                makePrimOp("cons"),
                [makeLitExp(makeSymbolSExp(key)), L32CExpToL3(value)]
            );
        } else {
            return makeAppExp(
                makePrimOp("cons"),
                [makeLitExp(makeSymbolSExp(pair.key)), L32CExpToL3(val)]
            );
        }
    });

    return makeAppExp(
        makePrimOp("dict"),
        [makeLitExp(makeEmptySExp()), ...pairsList]
    );
};



/*
 * Convert Exp (DefineExp | CExp)
 */
const L32ExpToL3 = (exp: Exp): Exp =>
    isDefineExp(exp) ? makeDefineExp(exp.var, L32CExpToL3(exp.val)) :
    isCExp(exp) ? L32CExpToL3(exp) :
    exp;

/*
 * Transform entire program from L32 to L3
 */
export const L32toL3 = (prog: Program): Program =>
    makeProgram(map(L32ExpToL3, prog.exps));

/*
 * Alias for compatibility
 */
export const Dict2App = L32toL3;
