import { 
    AppExp as L3AppExp, CExp as L3CExp, Exp as L3Exp, LitExp as L3LitExp, 
    makeAppExp, makeLitExp, makeProgram, makeVarRef, Program as L3Program, 
    makeProcExp, makeBinding, makeLetExp, makeIfExp, makeDefineExp, 
    makeVarDecl, makeBoolExp, makePrimOp
} from './L3/L3-ast';
import { 
    DictExp, isAppExp, isBoolExp, isDefineExp, isDictExp, isIfExp, 
    isLetExp, isLitExp, isNumExp, isPrimOp, isProcExp, isStrExp, 
    isVarRef, Binding, Program as L32Program, Exp as L32Exp,
    CExp as L32CExp, AppExp as L32AppExp, makePrimOp as L32makePrimOp
} from './L32/L32-ast';
import { 
    CompoundSExp as L32CompoundSExp, 
    EmptySExp as L32EmptySExp,
    SymbolSExp as L32SymbolSExp,
    SExpValue as L32SExpValue,
    isCompoundSExp as isL32CompoundSExp,
    isEmptySExp as isL32EmptySExp,
    isSymbolSExp as isL32SymbolSExp
} from './L32/L32-value';
import {
    SExpValue as L3SExpValue, makeCompoundSExp as makeL3CompoundSExp,
    makeEmptySExp as makeL3EmptySExp, makeSymbolSExp as makeL3SymbolSExp,
    isCompoundSExp,
    isEmptySExp,
} from './L3/L3-value'





const dictToAppExp = (dictExp: DictExp): L3AppExp => {
    const convertPair = (pair: L32CompoundSExp): L3SExpValue => {
        const key = pair.val1;
        const val = pair.val2;

        const l3Key = isL32SymbolSExp(key) ? makeL3SymbolSExp(key.val) : key as any;
        const l3Val = cexpToSExpValue(val as L32CExp);

        return makeL3CompoundSExp(l3Key, l3Val);
    };

    const convertPairsList = (pairs: L32CompoundSExp | L32EmptySExp): L3SExpValue => {
        if (isL32EmptySExp(pairs)) return makeL3EmptySExp();

        const current = pairs.val1 as L32CompoundSExp;
        const convertedCurrent = convertPair(current);
        const convertedRest = convertPairsList(pairs.val2 as L32CompoundSExp | L32EmptySExp);
        return makeL3CompoundSExp(convertedCurrent, convertedRest);
    };

    const quotedPairs = makeLitExp(convertPairsList(dictExp.pairs));
    return makeAppExp(makeVarRef("dict"), [quotedPairs]);
};

const cexpToSExpValue = (cexp: L32CExp): L3SExpValue => {
    if (isNumExp(cexp)) {
        return cexp.val; // מספרים לא עטופים
    } else if (isBoolExp(cexp)) {
        return cexp.val; // גם בוליאני
    } else if (isStrExp(cexp)) {
        return cexp.val; // מחרוזת כמות שהיא
    } else if (isVarRef(cexp)) {
        return makeL3SymbolSExp(cexp.var); // משתנה ← לסימבול
    } else if (isPrimOp(cexp)) {
        return makeL3SymbolSExp(cexp.op); // אופרטור ← לסימבול
    }else if (isLitExp(cexp)) {
        return convertSExp(cexp.val);
    }else {
        return convertCExpToQuotedSExp(cexp);
    }
};
const convertSExp = (sexp: L32SExpValue): L3SExpValue => {
    if (typeof sexp === 'number' || typeof sexp === 'boolean' || typeof sexp === 'string') {
        return sexp;
    }

    if (isL32SymbolSExp(sexp)) {
        return makeL3SymbolSExp(sexp.val);
    }

    if (isL32EmptySExp(sexp)) {
        return makeL3EmptySExp();
    }

    if (isL32CompoundSExp(sexp)) {
        const val1 = typeof sexp.val1 === "number" || typeof sexp.val1 === "boolean" || typeof sexp.val1 === "string" || isL32SymbolSExp(sexp.val1) || isL32EmptySExp(sexp.val1)
            ? convertSExp(sexp.val1)
            : convertCExpToQuotedSExp(sexp.val1 as L32CExp);

        const val2 = typeof sexp.val2 === "number" || typeof sexp.val2 === "boolean" || typeof sexp.val2 === "string" || isL32SymbolSExp(sexp.val2) || isL32EmptySExp(sexp.val2)
            ? convertSExp(sexp.val2)
            : convertCExpToQuotedSExp(sexp.val2 as L32CExp);

        return makeL3CompoundSExp(val1, val2);
    }

    throw new Error("Invalid SExpValue input");
};

//part B
export const defineDict = (): L3Exp =>
    makeDefineExp(
        makeVarDecl("dict"),
        makeProcExp([makeVarDecl("pairs")], [
            makeProcExp([makeVarDecl("key")], [
                makeAppExp(
                    makeAppExp(
                        makeProcExp([makeVarDecl("f")], [
                            makeAppExp(makeVarRef("f"), [makeVarRef("f")])
                        ]),
                        [makeProcExp([makeVarDecl("f")], [
                            makeProcExp([makeVarDecl("p")], [
                                makeIfExp(
                                    makeAppExp(makePrimOp("eq?"), [
                                        makeAppExp(makePrimOp("car"), [
                                            makeAppExp(makePrimOp("car"), [makeVarRef("p")])
                                        ]),
                                        makeVarRef("key")
                                    ]),
                                    makeAppExp(makePrimOp("cdr"), [
                                        makeAppExp(makePrimOp("car"), [makeVarRef("p")])
                                    ]),
                                    makeAppExp(
                                        makeAppExp(makeVarRef("f"), [makeVarRef("f")]),
                                        [makeAppExp(makePrimOp("cdr"), [makeVarRef("p")])]
                                    )
                                )
                            ])
                        ])]
                    ),
                    [makeVarRef("pairs")]
                )
            ])
        ])
    );
export const L32toL3 = (program: L32Program): L3Program => {
    const transformedExps = program.exps.map(transformExp);
    return makeProgram([defineDict(), ...transformedExps]);
};


const transformExp = (exp: L32Exp): L3Exp => {
    if (isDefineExp(exp)) {
        return makeDefineExp(exp.var, transformCExp(exp.val));
    } else {
        return transformCExp(exp);
    }
};


const transformCExp = (exp: L32CExp): L3CExp => {
    if (isNumExp(exp) || isBoolExp(exp) || isStrExp(exp) || isVarRef(exp) || isPrimOp(exp)) {
        return exp as L3CExp;
    } else if (isAppExp(exp)) {
        return makeAppExp(transformCExp(exp.rator), exp.rands.map(transformCExp));
    } else if (isIfExp(exp)) {
        return makeIfExp(transformCExp(exp.test), transformCExp(exp.then), transformCExp(exp.alt));
    } else if (isProcExp(exp)) {
        return makeProcExp(exp.args, exp.body.map(transformCExp));
    } else if (isLetExp(exp)) {
        return makeLetExp(
            exp.bindings.map(b => makeBinding(b.var.var, transformCExp(b.val))),
            exp.body.map(transformCExp)
        );
    } else if (isLitExp(exp)) {
        return exp as L3CExp;
    } else if (isDictExp(exp)) {
        return dictToAppExp(exp);  // ⬅️ השלב החשוב
    } else {
        return exp as L3CExp; // fallback
    }
};


const convertCExpToQuotedSExp = (exp: L32CExp): L3SExpValue => {
    if (isAppExp(exp)) {
        return listToCompoundSExp([
            convertCExpToQuotedSExp(exp.rator),
            ...exp.rands.map(convertCExpToQuotedSExp)
        ]);
    }

    if (isIfExp(exp)) {
        return listToCompoundSExp([
            makeL3SymbolSExp("if"),
            convertCExpToQuotedSExp(exp.test),
            convertCExpToQuotedSExp(exp.then),
            convertCExpToQuotedSExp(exp.alt)
        ]);
    }

    if (isProcExp(exp)) {
        const args = listToCompoundSExp(exp.args.map(a => makeL3SymbolSExp(a.var)));
        const body = exp.body.map(convertCExpToQuotedSExp);
        return listToCompoundSExp([
            makeL3SymbolSExp("lambda"),
            args,
            ...body
        ]);
    }

    if (isLetExp(exp)) {
        const bindings = listToCompoundSExp(
            exp.bindings.map(b =>
                listToCompoundSExp([
                    makeL3SymbolSExp(b.var.var),
                    convertCExpToQuotedSExp(b.val)
                ])
            )
        );

        const body = exp.body.map(convertCExpToQuotedSExp);
        return listToCompoundSExp([
            makeL3SymbolSExp("let"),
            bindings,
            ...body
        ]);
    }

    if (isLitExp(exp)) {
        return convertSExp(exp.val); // כמו קודם
    }

    if (isNumExp(exp) || isBoolExp(exp) || isStrExp(exp)) {
        return exp.val;
    }

    if (isVarRef(exp)) {
        return makeL3SymbolSExp(exp.var);
    }

    if (isPrimOp(exp)) {
        return makeL3SymbolSExp(exp.op);
    }
    if (isDictExp(exp)) {
        const convertPair = (pair: L32CompoundSExp): L3SExpValue => {
            const key = isL32SymbolSExp(pair.val1)
                ? makeL3SymbolSExp(pair.val1.val)
                : convertCExpToQuotedSExp(pair.val1 as L32CExp);
    
            const val = convertCExpToQuotedSExp(pair.val2 as L32CExp);
            return makeL3CompoundSExp(key, makeL3CompoundSExp(val, makeL3EmptySExp()));
        };
    
        const convertPairsList = (pairs: L32CompoundSExp | L32EmptySExp): L3SExpValue[] => {
            if (isL32EmptySExp(pairs)) return [];
            const current = convertPair(pairs.val1 as L32CompoundSExp);
            const rest = convertPairsList(pairs.val2 as L32CompoundSExp | L32EmptySExp);
            return [current, ...rest];
        };
    
        const dictItems = convertPairsList(exp.pairs);
        return listToCompoundSExp([
            makeL3SymbolSExp("dict"),
            ...dictItems
        ]);
    }

    return makeL3SymbolSExp("unsupported");
};



export const convertSExpToList = (sexp: L3SExpValue): L3SExpValue[] => {
    const list: L3SExpValue[] = [];
    let curr = sexp;

    while (isCompoundSExp(curr)) {
        list.push(curr.val1);
        curr = curr.val2;
    }

    if (!isEmptySExp(curr)) {
        throw new Error("Expected proper list structure in convertSExpToList");
    }

    return list;
};


const listToCompoundSExp = (items: L3SExpValue[]): L3SExpValue =>
    items.reduceRight((acc, curr) => makeL3CompoundSExp(curr, acc), makeL3EmptySExp());



