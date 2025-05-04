import {
    Program, Exp, CExp, isDefineExp, isCExp, makeProgram, makeDefineExp,
    isNumExp, isBoolExp, isStrExp, isPrimOp, isVarRef, isAppExp, isIfExp,
    isProcExp, isLitExp, isLetExp, isDictExp,
    makeAppExp, makeIfExp, makeProcExp, makeLetExp, makeBinding, makeVarDecl,
    makeLitExp, makePrimOp, makeVarRef, Binding, DictExp
} from './L32/L32-ast';

import { makeSymbolSExp } from './L3/L3-value';
import { makeBoolExp } from './L32/L32-ast';
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
 * Convert DictExp to AppExp form
 */
const dictToProcApp = (dict: DictExp): CExp => {
    const param = makeVarDecl("k");

    const makeIfChain = (pairs: { key: string; val: CExp }[]): CExp => {
        if (pairs.length === 0)
            return makeBoolExp(false); // default fallback

        const [pair, ...rest] = pairs;
        return makeIfExp(
            makeAppExp(makePrimOp("eq?"), [makeVarRef("k"), makeLitExp(makeSymbolSExp(pair.key))]),
            L32CExpToL3(pair.val),
            makeIfChain(rest)
        );
    };

    return makeAppExp(
        makeProcExp([param], [makeIfChain(dict.pairs)]),
        [] // the key will be passed in later as the operand
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
