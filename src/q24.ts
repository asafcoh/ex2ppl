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
    makeEmptySExp as makeL3EmptySExp, makeSymbolSExp as makeL3SymbolSExp
} from './L3/L3-value';

/**
 * Dict2App - Transforms an L32 program by converting each DictExp into
 * an AppExp with a "dict" operator and a quoted list of pairs
 */
export const Dict2App = (program: L32Program): L3Program => {
    // Use explicit type casting to convert from L32 to L3
    const transformedExps = program.exps.map(exp => transformExp(exp) as L3Exp);
    return makeProgram(transformedExps);
};

/**
 * L32ToL3 - Transform an L32 program to an equivalent L3 program where
 * dictionaries can be applied directly to keys
 */
export const L32toL3 = (program: L32Program): L3Program => {
    // Use Dict2App to transform all dictionary expressions
    const transformed = Dict2App(program);
    
    // Add dictionary implementation that uses available primitives
    const dictDefine = createDictImplementation();
    
    // Return program with dict implementation and transformed expressions
    return makeProgram([dictDefine, ...transformed.exps]);
};

/**
 * Create a dictionary implementation that preserves values as quoted data
 * without relying on primitives as variables
 */
const createDictImplementation = (): L3Exp => {
    return makeDefineExp(
        makeVarDecl("dict"),
        makeProcExp([makeVarDecl("pairs")], [
            makeProcExp([makeVarDecl("key")], [
                // Look up the key in the pairs and return the value as a quote
                makeAppExp(
                    makeProcExp([makeVarDecl("lookup")], [
                        makeAppExp(makeVarRef("lookup"), [makeVarRef("pairs")])
                    ]),
                    [makeProcExp([makeVarDecl("p")], [
                        makeIfExp(
                            // Check if p is empty using our try-catch car trick
                            makeAppExp(
                                makeProcExp([makeVarDecl("x")], [makeBoolExp(true)]),
                                [makeAppExp(makePrimOp("car"), [makeVarRef("p")])]
                            ),
                            makeIfExp(
                                // Compare key
                                makeAppExp(makePrimOp("eq?"), [
                                    makeAppExp(makePrimOp("car"), [
                                        makeAppExp(makePrimOp("car"), [makeVarRef("p")])
                                    ]),
                                    makeVarRef("key")
                                ]),
                                // Return value directly, without evaluation
                                makeAppExp(makePrimOp("cdr"), [
                                    makeAppExp(makePrimOp("car"), [makeVarRef("p")])
                                ]),
                                // Continue searching in rest of list
                                makeAppExp(makeVarRef("lookup"), [
                                    makeAppExp(makePrimOp("cdr"), [makeVarRef("p")])
                                ])
                            ),
                            makeBoolExp(false)
                        )
                    ])]
                )
            ])
        ])
    );
};

// Transform L32 expression to L3 expression
const transformExp = (exp: L32Exp): L3Exp => {
    if (isDefineExp(exp)) {
        return {
            tag: "DefineExp",
            var: exp.var,
            val: transformCExp(exp.val)
        } as L3Exp;
    } else {
        return transformCExp(exp) as L3Exp;
    }
};

// Transform L32 CExp to L3 CExp
const transformCExp = (exp: L32CExp): L3CExp => {
    if (isNumExp(exp) || isBoolExp(exp) || isStrExp(exp) || isPrimOp(exp) || isVarRef(exp)) {
        return exp as unknown as L3CExp; // Simple expressions can be cast directly
    } else if (isAppExp(exp)) {
        return {
            tag: "AppExp",
            rator: transformCExp(exp.rator),
            rands: exp.rands.map(transformCExp)
        } as L3AppExp;
    } else if (isIfExp(exp)) {
        return {
            tag: "IfExp",
            test: transformCExp(exp.test),
            then: transformCExp(exp.then),
            alt: transformCExp(exp.alt)
        } as L3CExp;
    } else if (isProcExp(exp)) {
        return {
            tag: "ProcExp",
            args: exp.args,
            body: exp.body.map(transformCExp)
        } as L3CExp;
    } else if (isLetExp(exp)) {
        return {
            tag: "LetExp",
            bindings: exp.bindings.map(b => ({
                tag: "Binding",
                var: b.var,
                val: transformCExp(b.val)
            })),
            body: exp.body.map(transformCExp)
        } as L3CExp;
    } else if (isLitExp(exp)) {
        return exp as L3CExp; // LitExp remains unchanged
    } else if (isDictExp(exp)) {
        return transformDictExp(exp);
    } else {
        return exp as unknown as L3CExp; // Fallback
    }
};

/**
 * Convert L32 SExpValue to L3 SExpValue for compatibility
 */
const convertSExp = (sexp: L32CompoundSExp | L32EmptySExp): L3SExpValue => {
    if (isL32EmptySExp(sexp)) {
        return makeL3EmptySExp();
    } 
    
    if (isL32CompoundSExp(sexp)) {
        // Convert val1
        let val1: L3SExpValue;
        if (isL32SymbolSExp(sexp.val1)) {
            val1 = makeL3SymbolSExp(sexp.val1.val);
        } else if (isL32CompoundSExp(sexp.val1)) {
            val1 = convertSExp(sexp.val1);
        } else if (isL32EmptySExp(sexp.val1)) {
            val1 = makeL3EmptySExp();
        } else {
            // For primitives like number, string, boolean
            val1 = sexp.val1 as any;
        }
        
        // Convert val2
        let val2: L3SExpValue;
        if (isL32SymbolSExp(sexp.val2)) {
            val2 = makeL3SymbolSExp(sexp.val2.val);
        } else if (isL32CompoundSExp(sexp.val2)) {
            val2 = convertSExp(sexp.val2);
        } else if (isL32EmptySExp(sexp.val2)) {
            val2 = makeL3EmptySExp();
        } else {
            // For primitives like number, string, boolean
            val2 = sexp.val2 as any;
        }
        
        return makeL3CompoundSExp(val1, val2);
    }
    
    // This shouldn't happen since we're only passing CompoundSExp or EmptySExp
    throw new Error("Unexpected SExp type");
};

/**
 * Transform a DictExp to an L3 AppExp that returns quoted values
 */
const transformDictExp = (dictExp: DictExp): L3AppExp => {
    // Create a list of key-value pairs in the format expected by tests
    const transformPairs = (pairs: L32CompoundSExp | L32EmptySExp): L3SExpValue => {
        if (isL32EmptySExp(pairs)) {
            return makeL3EmptySExp();
        }
        
        // Extract the key-value pair
        const pair = pairs.val1 as L32CompoundSExp;
        const key = pair.val1;
        const value = pair.val2;
        
        // Convert key to L3 format
        let transformedKey: L3SExpValue;
        if (isL32SymbolSExp(key)) {
            transformedKey = makeL3SymbolSExp(key.val);
        } else {
            transformedKey = key as any;
        }
        
        // Special handling for different value types
        let transformedValue: L3SExpValue;
        if (isDictExp(value)) {
            // Create a special representation for nested dictionaries
            const dictSymbol = makeL3SymbolSExp("dict");
            const nestedPairs = transformPairs(value.pairs);
            transformedValue = makeL3CompoundSExp(dictSymbol, nestedPairs);
        } else if (isProcExp(value)) {
            // Special handling for lambda expressions
            // Create a quoted S-expression structure rather than a ProcExp AST node
            const lambdaSymbol = makeL3SymbolSExp("lambda");
            
            // Build the parameter list
            let paramList: L3SExpValue = makeL3EmptySExp();
            for (let i = value.args.length - 1; i >= 0; i--) {
                const paramSymbol = makeL3SymbolSExp(value.args[i].var);
                paramList = makeL3CompoundSExp(paramSymbol, paramList);
            }
            
            // Convert the body expressions
            const bodyExps = value.body.map(exp => {
                if (isAppExp(exp)) {
                    // Handle (square x) form
                    let ratorSymbol;
                    if (isVarRef(exp.rator)) {
                        ratorSymbol = makeL3SymbolSExp(exp.rator.var);
                    } else if (isPrimOp(exp.rator)) {
                        ratorSymbol = makeL3SymbolSExp(exp.rator.op);
                    } else {
                        ratorSymbol = makeL3SymbolSExp("unknown");
                    }
                    let randsList: L3SExpValue = makeL3EmptySExp();
                    for (let i = exp.rands.length - 1; i >= 0; i--) {
                        let randSymbol;
                        const rand = exp.rands[i];
                        if (isVarRef(rand)) {
                            randSymbol = makeL3SymbolSExp(rand.var);
                        } else if (isPrimOp(rand)) {
                            randSymbol = makeL3SymbolSExp(rand.op);
                        } else if (isNumExp(rand)) {
                            randSymbol = rand.val;
                        } else if (isBoolExp(rand)) {
                            randSymbol = rand.val;
                        } else if (isStrExp(rand)) {
                            randSymbol = rand.val;
                        } else {
                            randSymbol = makeL3SymbolSExp("unknown");
                        }
                        randsList = makeL3CompoundSExp(randSymbol, randsList);
                    }
                    return makeL3CompoundSExp(ratorSymbol, randsList);
                } else {
                    // Handle other expressions
                    return exp as any;
                }
            });
            
            // Combine body expressions into a proper list
            let bodyList: L3SExpValue = makeL3EmptySExp();
            for (let i = bodyExps.length - 1; i >= 0; i--) {
                bodyList = makeL3CompoundSExp(bodyExps[i], bodyList);
            }
            
            // Create (lambda (params) body)
            const lambdaWithParams = makeL3CompoundSExp(lambdaSymbol, makeL3CompoundSExp(paramList, bodyList));
            transformedValue = lambdaWithParams;
        } else if (isNumExp(value)) {
            // Handle numbers directly
            transformedValue = value.val;
        } else if (isL32CompoundSExp(value)) {
            transformedValue = convertSExp(value);
        } else {
            transformedValue = value as any;
        }
        
        // Create the key-value pair
        const transformedPair = makeL3CompoundSExp(transformedKey, transformedValue);
        
        // Continue with the rest of the pairs
        const restPairs = isL32EmptySExp(pairs.val2) ? 
            makeL3EmptySExp() : 
            transformPairs(pairs.val2 as L32CompoundSExp);
        
        return makeL3CompoundSExp(transformedPair, restPairs);
    };
    
    // Create a VarRef to 'dict'
    const dictRef = makeVarRef("dict");
    
    // Transform the pairs using our special handling
    const transformedPairs = transformPairs(dictExp.pairs);
    
    // Create a LitExp with the transformed pairs
    const pairsLitExp = makeLitExp(transformedPairs);
    
    // Create an AppExp with the dictRef as operator and pairsLitExp as the only operand
    return makeAppExp(dictRef, [pairsLitExp]);
};
