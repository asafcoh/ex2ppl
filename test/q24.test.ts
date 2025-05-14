
import { expect } from 'chai';
import { all, map } from "ramda";
import { evalL32program, evalParse } from '../src/L32/L32-eval';
import { Value } from "../src/L32/L32-value";
import { Result, bind, makeOk } from "../src/shared/result";
import {
    Binding, CExp, Exp, isAppExp, isAtomicExp, isDefineExp, isDictExp,
    isIfExp, isLetExp, isLitExp, isProcExp, isProgram,
    parseL32, Program
} from "../src/L32/L32-ast";
import { L32toL3 } from "../src/q24";
import { makeSymbolSExp } from '../src/L3/L3-value';

// 🔍 Prints a failure context
const expectWithPrint = <T>(actual: Result<T>, expected: Result<T>, message: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.log("❌ Test failed: " + message);
        console.log("Expected:", expected);
        console.log("Actual:  ", actual);
    }
    expect(actual).to.deep.equal(expected);
};

const noDictExp = (e: Program | Exp): boolean =>
    isAtomicExp(e) ? true :
    isLitExp(e) ? true :
    isIfExp(e) ? noDictExp(e.test) && noDictExp(e.then) && noDictExp(e.alt) :
    isProcExp(e) ? all((b) => noDictExp(b), e.body) :
    isAppExp(e) ? noDictExp(e.rator) &&
        all((rand) => noDictExp(rand), e.rands) :
    isDefineExp(e) ? noDictExp(e.val) :
    isLetExp(e) ? all((val: CExp) => noDictExp(val), map((b: Binding) => b.val, e.bindings)) &&
        all((b) => noDictExp(b), e.body) :
    isDictExp(e) ? false :
    isProgram(e) ? all((e) => noDictExp(e), e.exps) :
    true;

const evalP = (x: string): Result<Value> =>
    bind(parseL32(x), (prog) =>
        evalL32program(L32toL3(prog)));

const noDict = (x: string): Result<boolean> =>
    bind(parseL32(x), (prog) =>
        makeOk(noDictExp(L32toL3(prog))));

describe('Q24 Tests', () => {

    it("Q24 test 1", () => {
        const input = `(L32 ((dict (a 1) (b 2)) 'a))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 1");
        expectWithPrint(evalP(input), makeOk(1), "evalP 1");
    });

    it("Q24 test 2", () => {
        const input = `(L32 ((dict (a 1) (b 2)) 'a))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 2");
        expectWithPrint(evalP(input), makeOk(1), "evalP 2");
    });

    it("Q24 test 3", () => {
        const input = `(L32 ((dict (a 1) (b #f)) 'b))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 3");
        expectWithPrint(evalP(input), makeOk(false), "evalP 3");
    });

    it("Q24 test 4", () => {
        const input = `(L32 ((dict (a "z") (b #f)) 'a))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 4");
        expectWithPrint(evalP(input), makeOk("z"), "evalP 4");
    });

    it("Q24 test 5", () => {
        const input = `(L32 ((dict (a "z") (b 'red)) 'b))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 5");
        expectWithPrint(evalP(input), makeOk(makeSymbolSExp("red")), "evalP 5");
    });

    it("Q24 test 6", () => {
        const input = `(L32 ((dict (a "z") (b +)) 'b))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 6");
        expectWithPrint(evalP(input), makeOk(makeSymbolSExp("+")), "evalP 6");
    });

    it("Q24 test 7", () => {
        const input = `(L32 ((dict (a "z") (b '())) 'b))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 7");
        expectWithPrint(evalP(input), evalParse("'()"), "evalP 7");
    });

    it("Q24 test 8", () => {
        const input = `(L32 ((dict (a "z") (b (1 #t -))) 'b))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 8");
        expectWithPrint(evalP(input), evalParse("'(1 #t -)"), "evalP 8");
    });

    it("Q24 test 9 - with defines", () => {
        const input = `(L32
            (define x "a")
            (define y "b")
            ((dict (a x) (b y)) 'b))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 9");
        expectWithPrint(evalP(input), makeOk(makeSymbolSExp('y')), "evalP 9");
    });

    it("Q24 test 10 - inside if", () => {
        const input = `(L32 
            (define x 1)
            (
              (if (< x 0)
                (dict (a 1) (b 2))
                (dict (a 2) (b 1)))
            'a))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 10");
        expectWithPrint(evalP(input), makeOk(2), "evalP 10");
    });

    it("Q24 test 11 - dict with expression", () => {
        const input = `(L32 ((dict (a 1) (b (+ 1 1))) 'b))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 11");
        expectWithPrint(evalP(input), evalParse("'(+ 1 1)"), "evalP 11");
    });

    it("Q24 test 12 - dict with lambda", () => {
        const input = `(L32 ((dict (a (lambda (x) (square x))) (b (+ 1 1))) 'a))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 12");
        expectWithPrint(evalP(input), evalParse("'(lambda (x) (square x))"), "evalP 12");
    });

    it("Q24 test 13 - nested dict inside dict", () => {
        const input = `(L32 ((dict (a (dict (c 2) (d 3))) (b (+ 1 1))) 'a))`;
        expectWithPrint(noDict(input), makeOk(true), "noDict 13");
        expectWithPrint(evalP(input), evalParse("'(dict (c 2) (d 3))"), "evalP 13");
    });
});
















// import { expect } from 'chai';
// import { all, map } from "ramda";
// import {  evalL32program, evalParse } from '../src/L32/L32-eval';
// import { Value } from "../src/L32/L32-value";
// import { Result, bind, makeOk } from "../src/shared/result";
// import { Binding, CExp, Exp, isAppExp, isAtomicExp, isDefineExp, isDictExp, isIfExp, isLetExp, isLitExp, isProcExp, isProgram, parseL32, parseL32CExp, parseL32Exp, Program } from "../src/L32/L32-ast";
// import { L32toL3 } from "../src/q24";
// import { makeSymbolSExp } from '../src/L3/L3-value';


// const noDictExp = (e : Program | Exp) : boolean =>
//     isAtomicExp(e) ? true :
//     isLitExp(e) ? true :
//     isIfExp(e) ? noDictExp(e.test) && noDictExp(e.then) && noDictExp(e.alt) :
//     isProcExp(e) ? all((b) => noDictExp(b), e.body) :
//     isAppExp(e) ? noDictExp(e.rator) &&
//               all((rand) => noDictExp(rand), e.rands) :
//     isDefineExp(e) ? noDictExp(e.val) :
//     isLetExp(e) ? all((val : CExp) => noDictExp(val), map((b : Binding) => b.val, e.bindings)) &&
//                   all((b) => noDictExp(b), e.body) :
//     isDictExp(e) ? false :
//     isProgram(e) ? all((e) => noDictExp(e), e.exps) : 
//     true;


// const evalP = (x: string): Result<Value> => 
//     bind(parseL32(x), (prog) => 
//         evalL32program(L32toL3(prog)))

// const noDict = (x: string): Result<boolean> => 
//     bind(parseL32(x), (prog) => 
//         makeOk(noDictExp(L32toL3(prog))))

// describe('Q24 Tests', () => {


//     it("Q24 test 1", () => {
//         expect(noDict(`(L32 ((dict (a 1) (b 2)) 'a))`)).to.deep.equal(makeOk(true));
//         expect(evalP(`(L32 ((dict (a 1) (b 2)) 'a))`)).to.deep.equal(makeOk(1));
//     });
    
//     it("Q24 test 2", () => {
//         expect(noDict(`(L32 ((dict (a 1) (b 2)) 'a))`)).to.deep.equal(makeOk(true));
//         expect(evalP(`(L32 ((dict (a 1) (b 2)) 'a))`)).to.deep.equal(makeOk(1));
//     });

//     it("Q24 test 3", () => {
//         expect(noDict(`(L32 ((dict (a 1) (b #f)) 'b))`)).to.deep.equal(makeOk(true));
//         expect(evalP(`(L32 ((dict (a 1) (b #f)) 'b))`)).to.deep.equal(makeOk(false));
//     });

//     it("Q24 test 4", () => {
//         expect(noDict(`(L32 ((dict (a 1) (b #f)) 'a))`)).to.deep.equal(makeOk(true));
//         expect(evalP(`(L32 ((dict (a "z") (b #f)) 'a))`)).to.deep.equal(makeOk("z"));
//     });

//     it("Q24 test 5", () => {
//         expect(noDict(`(L32 ((dict (a 1) (b 'red)) 'b))`)).to.deep.equal(makeOk(true));
//         expect(evalP(`(L32 ((dict (a "z") (b 'red)) 'b))`)).to.deep.equal(makeOk(makeSymbolSExp("red")));
//     });

    
//     it("Q24 test 6", () => {
//         expect(noDict(`(L32 ((dict (a 1) (b +)) 'b))`)).to.deep.equal(makeOk(true));
//         expect(evalP(`(L32 ((dict (a "z") (b +)) 'b))`)).to.deep.equal(makeOk(makeSymbolSExp("+")));
//     });

//     it("Q24 test 7", () => {
//         expect(noDict(`(L32 ((dict (a 1) (b '())) 'b))`)).to.deep.equal(makeOk(true));
//         expect(evalP(`(L32 ((dict (a "z") (b '())) 'b))`)).to.deep.equal(evalParse("'()"));
//     });

//     it("Q24 test 8", () => {
//         expect(noDict(`(L32 ((dict (a 1) (b (1 #t -))) 'b))`)).to.deep.equal(makeOk(true));
//         expect(evalP(`(L32 ((dict (a "z") (b (1 #t -))) 'b))`)).to.deep.equal(evalParse("'(1 #t -)"));
//     });

//     it("Q23 tests 9", () => {
//     expect(noDict(`(L32
//                       (define x "a")
//                       (define y "b")
//                       ((dict (a x) (b y)) 'b))`)).to.deep.equal(makeOk(true));
        
//         expect(evalP(`(L32
//                       (define x "a")
//                       (define y "b")
//                       ((dict (a x) (b y)) 'b))`)).to.deep.equal(makeOk(makeSymbolSExp('y')))
//     });
    
//     it("Q24 test 10", () => {
//         expect(noDict(`(L32 
//             (define x 1)
//             (
//               (if (< x 0)
//                 (dict (a 1) (b 2))
//                 (dict (a 2) (b 1)))
//             'a))`)).to.deep.equal(makeOk(true));
            
//         expect(evalP(`(L32 
//             (define x 1)
//             (
//               (if (< x 0)
//                 (dict (a 1) (b 2))
//                 (dict (a 2) (b 1)))
//             'a))`)).to.deep.equal(makeOk(2));
//     });

//     it("Q23 tests 11", () => {
//         expect(noDict(`(L32
//                           ((dict (a 1) (b (+ 1 1))) 'b))`)).to.deep.equal(makeOk(true));
            
//         expect(evalP(`(L32
//                           ((dict (a 1) (b (+ 1 1))) 'b))`)).to.deep.equal(evalParse("'(+ 1 1)"))
//     });

//     it("Q23 tests 12", () => {
//         expect(noDict(`(L32
//                           ((dict (a (lambda (x) (square x))) (b (+ 1 1))) 'a))`)).to.deep.equal(makeOk(true));
            
//         expect(evalP(`(L32
//                           ((dict (a (lambda (x) (square x))) (b (+ 1 1))) 'a))`)).to.deep.equal(evalParse("'(lambda (x) (square x))"))
//     });


//     it("Q23 tests 13", () => {
//         expect(noDict(`(L32
//                           ((dict (a (dict (c 2) (d 3))) (b (+ 1 1))) 'a))`)).to.deep.equal(makeOk(true));
            
//         expect(evalP(`(L32
//                           ((dict (a (dict (c 2) (d 3))) (b (+ 1 1))) 'a))`)).to.deep.equal(evalParse("'(dict (c 2) (d 3))"))
//     });

// });
