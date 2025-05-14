// Abstract Syntax Tree (AST)
import {
    Program, Exp, CExp, Binding, DictExp,
    isDefineExp, isCExp, isNumExp, isBoolExp, isStrExp, isPrimOp,
    isVarRef, isAppExp, isIfExp, isProcExp, isLitExp, isLetExp, isDictExp,
    makeProgram, makeDefineExp, makeAppExp, makeIfExp,
    makeProcExp, makeLetExp, makeBinding, makeVarDecl,
    makeLitExp, makeVarRef
} from './L32/L32-ast';

// S-Expression Values
import {
    isEmptySExp, isCompoundSExp, isSymbolSExp,
    makeEmptySExp, makeCompoundSExp, makeSymbolSExp,SExpValue
} from "./L3/L3-value";

import { map } from 'ramda';

/*
 * === Part A ===
 * Dict2App: convert only DictExp → AppExp(dict '((a . v1) ...))
 */
export const Dict2App = (exp: CExp): CExp =>
    isDictExp(exp) ? dictToApp(exp) :
    isIfExp(exp) ? makeIfExp(Dict2App(exp.test), Dict2App(exp.then), Dict2App(exp.alt)) :
    isAppExp(exp) ? makeAppExp(Dict2App(exp.rator), map(Dict2App, exp.rands)) :
    isProcExp(exp) ? makeProcExp(exp.args, map(Dict2App, exp.body)) :
    isLetExp(exp) ? makeLetExp(
        map((b: Binding) => makeBinding(b.var.var, Dict2App(b.val)), exp.bindings),
        map(Dict2App, exp.body)) :
    exp;

/*
 * === Helper: convert CExp → SExpValue with quote wrapping ===
 */
const convertSExpValue = (val: any): SExpValue => {
    if (typeof val === "number" || typeof val === "boolean" || typeof val === "string") {
        return val;
    }
    if (isSymbolSExp(val)) return makeSymbolSExp(val.val);
    if (isEmptySExp(val)) return makeEmptySExp();
    if (isCompoundSExp(val)) {
        return makeCompoundSExp(
            convertSExpValue(val.val1),
            convertSExpValue(val.val2)
        );
    }
    // כאמצעי מנע – נחזיר סימבול של שגיאה
    return makeSymbolSExp("unsupported");
};

const convertCExpToSExp = (e: CExp): SExpValue => {
    if (isNumExp(e)) return e.val;
    if (isBoolExp(e)) return e.val;
    if (isStrExp(e)) return e.val;
    if (isVarRef(e)) return makeSymbolSExp(e.var);
    if (isPrimOp(e)) return makeSymbolSExp(e.op);
    if (isLitExp(e)) return convertSExpValue(e.val);


    if (isProcExp(e))
        return makeCompoundSExp(
            makeSymbolSExp("lambda"),
            makeCompoundSExp(
                makeListCompound(e.args.map(a => makeSymbolSExp(a.var))),
                makeListCompound(e.body.map(convertCExpToSExp))
            )
        );

    if (isAppExp(e))
        return makeCompoundSExp(
            convertCExpToSExp(e.rator),
            makeListCompound(e.rands.map(convertCExpToSExp))
        );

    return makeSymbolSExp("unsupported");
};

const cexpToQuotedSExp = (cexp: CExp): SExpValue =>
    makeCompoundSExp(makeSymbolSExp("quote"), convertCExpToSExp(cexp));

const makeListCompound = (xs: SExpValue[]): SExpValue =>
    xs.length === 0 ? makeEmptySExp() : makeCompoundSExp(xs[0], makeListCompound(xs.slice(1)));

const dictToApp = (dict: DictExp): CExp => {
    const pairList = dict.pairs.map(pair =>
        makeCompoundSExp(
            makeSymbolSExp(pair.key),   // keys must be symbols
            cexpToQuotedSExp(pair.val)  // values must be quoted
        )
    );

    return makeAppExp(
        makeVarRef("dict"),
        [makeLitExp(makeListCompound(pairList))]
    );
};

/*
 * === Part B ===
 * L32toL3: converts full program, including dict access (get ...)
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
    isAppExp(e)
        ? isDictExp(e.rator) && e.rands.length === 1
            ? makeAppExp(makeVarRef("get"), [dictToApp(e.rator), L32CExpToL3(e.rands[0])])
            : makeAppExp(L32CExpToL3(e.rator), map(L32CExpToL3, e.rands)) :
    isProcExp(e) ? makeProcExp(e.args, map(L32CExpToL3, e.body)) :
    isLetExp(e) ? makeLetExp(
        map((b: Binding) => makeBinding(b.var.var, L32CExpToL3(b.val)), e.bindings),
        map(L32CExpToL3, e.body)) :
    isDictExp(e) ? dictToApp(e) :
    e;

const L32ExpToL3 = (exp: Exp): Exp =>
    isDefineExp(exp) ? makeDefineExp(exp.var, L32CExpToL3(exp.val)) :
    isCExp(exp) ? L32CExpToL3(exp) :
    exp;

export const L32toL3 = (prog: Program): Program =>
    makeProgram(map(L32ExpToL3, prog.exps));
