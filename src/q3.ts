import { Exp, Program, isAppExp, isBoolExp, isDefineExp, isIfExp, isNumExp, isPrimOp, isProcExp, isStrExp, isVarRef,isProgram } from './L3/L3-ast';
import { Result, makeOk, bind, mapResult } from './shared/result';

/*
Purpose: Transform L2 AST to JavaScript program string
Signature: l2ToJS(l2AST)
Type: [EXP | Program] => Result<string>
*/

export const l2ToJS = (exp: Exp | Program): Result<string> => {
    if (isNumExp(exp)) return makeOk(exp.val.toString());
    if (isStrExp(exp)) return makeOk(`"${exp.val}"`);
    if (isBoolExp(exp)) return makeOk(exp.val ? "true" : "false");
    if (isVarRef(exp)) return makeOk(exp.var);

    // Handle primitive operator as value
    if (isPrimOp(exp)) {
        const typePredicates: Record<string, string> = {
            "number?": "number",
            "boolean?": "boolean",
            "string?": "string"
        };

        if (exp.op in typePredicates) {
            const jsType = typePredicates[exp.op];
            return makeOk(`((x) => typeof(x) === '${jsType}')`);
        }

        return makeOk(convertPrimOp(exp.op));
    }

    // if expression
    if (isIfExp(exp)) {
        return bind(l2ToJS(exp.test), (testJS) =>
            bind(l2ToJS(exp.then), (thenJS) =>
                bind(l2ToJS(exp.alt), (altJS) => {
                    // Handle negation for single variable
                    if (isVarRef(exp.test)) {
                        return makeOk(`((!${testJS}) ? ${thenJS} : ${altJS})`);
                    }
                    return makeOk(`(${testJS} ? ${thenJS} : ${altJS})`);
                })
            )
        );
    }

    // lambda expression
    if (isProcExp(exp)) {
        const params = exp.args.map(p => p.var).join(",");
        return bind(mapResult(l2ToJS, exp.body), (bodyJS: string[]) =>
            makeOk(`((${params}) => ${bodyJS.length > 1 ?
                `{\n${bodyJS.slice(0, -1).join(";\n")};\nreturn ${bodyJS[bodyJS.length - 1]};\n}` :
                bodyJS[0]})`)
        );
    }

    // application expression
    if (isAppExp(exp)) {
        if (isPrimOp(exp.rator)) {
            const op = exp.rator.op;

            return bind(mapResult(l2ToJS, exp.rands), (randsJS: string[]) => {
                // Handle not
                if (op === "not") {
                    return makeOk(`(!${randsJS[0]})`);
                }

                // Handle eq?
                if (op === "eq?") {
                    return makeOk(`(${randsJS[0]} === ${randsJS[1]})`);
                }

                // Handle type predicates
                const typePredicates: Record<string, string> = {
                    "number?": "number",
                    "boolean?": "boolean",
                    "string?": "string"
                };

                if (op in typePredicates) {
                    const jsType = typePredicates[op];
                    return makeOk(`((x) => typeof(x) === '${jsType}')(${randsJS[0]})`);
                }

                // Regular infix operators like +, *, /
                const jsOp = convertPrimOp(op);
                return makeOk(`(${randsJS.join(` ${jsOp} `)})`);
            });
        } else {
            // Regular function call
            return bind(l2ToJS(exp.rator), (ratorJS: string) =>
                bind(mapResult(l2ToJS, exp.rands), (randsJS: string[]) =>
                    makeOk(`${ratorJS}(${randsJS.join(",")})`)
                )
            );
        }
    }
    if (isDefineExp(exp)) {
        return bind(l2ToJS(exp.val), (valJS: string) =>
            makeOk(`const ${exp.var.var} = ${valJS}`));
    }

    // define expression
    if (isProgram(exp)) {
        return bind(mapResult(l2ToJS, exp.exps), (expsJS: string[]) => {
            const withSemis = expsJS.map((line, i) =>
                i === expsJS.length - 1 ? line : `${line};`
            );
            return makeOk(withSemis.join("\n"));
        });
    }
    
    return makeOk("Not fully implemented");
}

// Helper function to convert primitive operators to JavaScript
const convertPrimOp = (op: string): string => {
    const opMap: Record<string, string> = {
        "+": "+", "-": "-", "*": "*", "/": "/",
        "=": "===", ">": ">", "<": "<",
        "not": "!", "and": "&&", "or": "||",
        "eq?": "==="
    };
    return opMap[op] || op;
};