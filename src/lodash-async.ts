import _ from 'lodash';

declare module 'lodash' {
  interface LoDashStatic {
    /**
     * Creates a function that returns the result of invoking the provided functions with the this binding of the
     * created function, where each successive invocation is supplied the return value of the previous.
     *
     * @param funcs Functions to invoke.
     * @return Returns the new function.
     */
    flowAsync<A extends any[], R1, R2, R3, R4, R5, R6, R7>(f1: (...args: A) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7): (...args: A) => R7;
    /**
     * @see _.flow
     */
    flowAsync<A extends any[], R1, R2, R3, R4, R5, R6, R7>(f1: (...args: A) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6, f7: (a: R6) => R7, ...func: Array<Many<(a: any) => any>>): (...args: A) => any;
    /**
     * @see _.flow
     */
    flowAsync<A extends any[], R1, R2, R3, R4, R5, R6>(f1: (...args: A) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5, f6: (a: R5) => R6): (...args: A) => R6;
    /**
     * @see _.flow
     */
    flowAsync<A extends any[], R1, R2, R3, R4, R5>(f1: (...args: A) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4, f5: (a: R4) => R5): (...args: A) => R5;
    /**
     * @see _.flow
     */
    flowAsync<A extends any[], R1, R2, R3, R4>(f1: (...args: A) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3, f4: (a: R3) => R4): (...args: A) => R4;
    /**
     * @see _.flow
     */
    flowAsync<A extends any[], R1, R2, R3>(f1: (...args: A) => R1, f2: (a: R1) => R2, f3: (a: R2) => R3): (...args: A) => R3;
    /**
     * @see _.flow
     */
    flowAsync<A extends any[], R1, R2>(f1: (...args: A) => R1, f2: (a: R1) => R2): (...args: A) => R2;
    /**
     * @see _.flow
     */
    flowAsync(...func: Array<Many<(...args: any[]) => any>>): (...args: any[]) => any;
  }
}

_.flowAsync = (...fns: any): (...args: any[]) => any => {
  const asyncWrap = (fn: any) => async (arg: any) => {
    const result = await arg;
    return fn(result);
  }
  const asyncFns = _(fns).map(fn => asyncWrap(fn)) as any;
  return _.flow(...asyncFns);
}