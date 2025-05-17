import { 
    AppExp, CExp, Exp, LitExp, makeAppExp, makeLitExp, makeProgram, 
    makeVarRef, Program, makeProcExp, makeBinding, makeLetExp,
    makeIfExp, makeDefineExp, makeVarDecl, makeBoolExp
} from './L3/L3-ast';
import { 
    DictExp, isAppExp, isBoolExp, isDefineExp, isDictExp, isIfExp, 
    isLetExp, isLitExp, isNumExp, isPrimOp, isProcExp, isStrExp, 
    isVarRef, Binding 
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
 *
 * @param program - The L32 program to transform
 * @returns - An L3 program with dictionaries converted to applications
 */
export const Dict2App = (program: Program): Program => {
    const transformedExps = program.exps.map(transformExp);
    return makeProgram(transformedExps);
};

/**
 * L32ToL3 - Transform an L32 program to an equivalent L3 program where
 * dictionaries can be applied directly to keys
 * 
 * @param program - The L32 program to transform
 * @returns - An L3 program with equivalent dictionary functionality
 */
export const L32ToL3 = (program: Program): Program => {
    // First transform all dictionary expressions
    const transformedExps = program.exps.map(transformExp);
    
    // Create dictionary implementation function
    const dictDefine = createDictImplementation();
    
    // Return program with dict implementation and transformed expressions
    return makeProgram([dictDefine, ...transformedExps]);
};

/**
 * Create the dictionary implementation function
 * 
 * Equivalent to:
 * (define dict
 *   (lambda (pairs)
 *     (lambda (key)
 *       (letrec ((lookup
 *                  (lambda (p)
 *                    (if (null? p) 
 *                        #f
 *                        (if (eq? (caar p) key)
 *                            (cdar p)
 *                            (lookup (cdr p)))))))
 *         (lookup pairs)))))
 */
const createDictImplementation = (): Exp => {
    // Parameters
    const pairsParam = makeVarDecl("pairs");
    const keyParam = makeVarDecl("key");
    const lookupPairsParam = makeVarDecl("p");
    
    // Inner function body: checks if current pair's key matches
    const checkCurrentPair = makeIfExp(
        // Test: (eq? (caar p) key)
        makeAppExp(
            makeVarRef("eq?"),
            [
                makeAppExp(makeVarRef("car"), [makeAppExp(makeVarRef("car"), [makeVarRef("p")])]),
                makeVarRef("key")
            ]
        ),
        // Then: (cdar p) - return the value
        makeAppExp(makeVarRef("cdr"), [makeAppExp(makeVarRef("car"), [makeVarRef("p")])]),
        // Else: (lookup (cdr p)) - recursive call with rest of list
        makeAppExp(makeVarRef("lookup"), [makeAppExp(makeVarRef("cdr"), [makeVarRef("p")])])
    );

    // Lookup function body: checks if list is empty first
    const lookupBody = makeIfExp(
        // Test: (null? p)
        makeAppExp(makeVarRef("null?"), [makeVarRef("p")]),
        // Then: #f - return false if key not found
        makeBoolExp(false),
        // Else: Check the current pair
        checkCurrentPair
    );

    // Define the lookup function
    const lookupFunction = makeProcExp([lookupPairsParam], [lookupBody]);
    
    // Create the binding for lookup in letrec
    const lookupBinding = makeBinding("lookup", lookupFunction);
    
    // Inner lambda body: (letrec ((lookup ...)) (lookup pairs))
    const innerLambdaBody = makeLetExp(
        [lookupBinding], 
        [makeAppExp(makeVarRef("lookup"), [makeVarRef("pairs")])]
    );
    
    // Inner lambda: (lambda (key) ...)
    const innerLambda = makeProcExp([keyParam], [innerLambdaBody]);
    
    // Outer lambda: (lambda (pairs) (lambda (key) ...))
    const outerLambda = makeProcExp([pairsParam], [innerLambda]);
    
    // Define expression: (define dict (lambda (pairs) ...))
    return makeDefineExp(makeVarDecl("dict"), outerLambda);
};

// Transform any expression (Exp)
const transformExp = (exp: Exp): Exp => {
    if (isDefineExp(exp)) {
        return {
            tag: "DefineExp",
            var: exp.var,
            val: transformCExp(exp.val)
        };
    } else {
        return transformCExp(exp);
    }
};

// Transform a CExp
const transformCExp = (exp: CExp): CExp => {
    if (isNumExp(exp) || isBoolExp(exp) || isStrExp(exp) || isPrimOp(exp) || isVarRef(exp)) {
        return exp; // Atomic expressions remain unchanged
    } else if (isAppExp(exp)) {
        return {
            tag: "AppExp",
            rator: transformCExp(exp.rator),
            rands: exp.rands.map(transformCExp)
        };
    } else if (isIfExp(exp)) {
        return {
            tag: "IfExp",
            test: transformCExp(exp.test),
            then: transformCExp(exp.then),
            alt: transformCExp(exp.alt)
        };
    } else if (isProcExp(exp)) {
        return {
            tag: "ProcExp",
            args: exp.args,
            body: exp.body.map(transformCExp)
        };
    } else if (isLetExp(exp)) {
        return {
            tag: "LetExp",
            bindings: exp.bindings.map(b => ({
                tag: "Binding",
                var: b.var,
                val: transformCExp(b.val)
            })),
            body: exp.body.map(transformCExp)
        };
    } else if (isLitExp(exp)) {
        return exp; // LitExp remains unchanged
    } else if (isDictExp(exp)) {
        return transformDictExp(exp);
    } else {
        return exp; // Fallback
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

// Transform a DictExp to an AppExp
const transformDictExp = (dictExp: DictExp): AppExp => {
    // Create a VarRef to 'dict'
    const dictRef = makeVarRef("dict");
    
    // Convert L32 pairs to L3 SExpValue
    const convertedPairs = convertSExp(dictExp.pairs);
    
    // Create a LitExp with the converted pairs
    const pairsLitExp = makeLitExp(convertedPairs);
    
    // Create an AppExp with the dictRef as operator and pairsLitExp as the only operand
    return makeAppExp(dictRef, [pairsLitExp]);
};
