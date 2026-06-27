
//----------------------------------------------------------------------------------------------
// Evaluate formula
//----------------------------------------------------------------------------------------------
function IdM_eval_formula(str, context, forceStringMode = false) {

    // -----------------------------------------------------
    // FORCE STRING MODE for HTML / CDATA / multiline text
    // -----------------------------------------------------
    if (forceStringMode) {
        return str.replace(/\$\{([^}:]+)(?::(number|int|float|string))?\}/g, (_, name) => {
        if (context[name] === undefined) throw new Error(`Unknown variable ${name}`);
        return context[name];
        });
    }
    
    let expr = str;

    const hasVar = /\$\(|\$\{[^}]+\}/.test(str);
    const hasMathFunc = /\b(?:ceil|floor|round|min|max|abs|round5|ceil5)\b/.test(str);
    const hasTernary = /\?/.test(str);
    const hasCompare = /(>=|<=|==|>|<)/.test(str);
    const startsWithIf = /^\s*if\s*\(/.test(str);

    const isExpression = hasVar && (hasMathFunc || hasTernary || hasCompare || startsWithIf);

    // =====================================================
    // STRING MODE (template replacement only)
    // =====================================================
    if (!isExpression) {
   
        const fullMatch = str.match(/^\$\{([^}:]+)(?::(number|int|float|string))?\}$/);

        // Case: string is ONLY a single template → return typed value
        if (fullMatch) {
        const [, name, type] = fullMatch;

        if (context[name] === undefined) {
            throw new Error(`Unknown variable ${name}`);
        }

        let val = context[name];

        switch (type) {
            case "number":
            case "float":
            val = Number(val);
            if (Number.isNaN(val)) throw new Error(`Variable ${name} is not a number`);
            return val;

            case "int":
            val = parseInt(val, 10);
            if (Number.isNaN(val)) throw new Error(`Variable ${name} is not an int`);
            return val;

            case "string":
            return String(val);

            default:
            return val;
        }
        }

        // Otherwise, it's part of a larger string → keep string behavior
        return str.replace(/\$\{([^}:]+)(?::(number|int|float|string))?\}/g, (_, name) => {
        if (context[name] === undefined) {
            throw new Error(`Unknown variable ${name}`);
        }
        return context[name];
        });
    }

    // =====================================================
    // EXPRESSION MODE
    // =====================================================

    // $(VAR[:type]) → typed JS literal
    expr = expr.replace(/\$\(([^):]+)(?::(number|int|float|string))?\)/g, (_, name, type) => {
        if (context[name] === undefined) {
        throw new Error(`Unknown variable ${name}`);
        }

        let val = context[name];

        switch (type) {
        case "number":
        case "float":
            val = Number(val);
            if (Number.isNaN(val)) throw new Error(`Variable ${name} is not a number`);
            return val;

        case "int":
            val = parseInt(val, 10);
            if (Number.isNaN(val)) throw new Error(`Variable ${name} is not an int`);
            return val;

        case "string":
            return JSON.stringify(String(val));

        default:
            if (typeof val === "number") return val;
            if (!isNaN(val) && val !== "") return Number(val);
            return JSON.stringify(val);
        }
    });

    // ${VAR[:type]} inside expression → always JS literal
    expr = expr.replace(/\$\{([^}:]+)(?::(number|int|float|string))?\}/g, (_, name, type) => {
        if (context[name] === undefined) {
        throw new Error(`Unknown variable ${name}`);
        }

        let val = context[name];

        switch (type) {
        case "number":
        case "float":
            val = Number(val);
            if (Number.isNaN(val)) throw new Error(`Variable ${name} is not a number`);
            return val;

        case "int":
            val = parseInt(val, 10);
            if (Number.isNaN(val)) throw new Error(`Variable ${name} is not an int`);
            return val;

        case "string":
            return JSON.stringify(String(val));

        default:
            return JSON.stringify(val);
        }
    });

    // normalize "if (cond) ? a : b"
    expr = expr.replace(/^if\s*\(/, '(');

    try {
        const helpers = {
        ceil: Math.ceil,
        floor: Math.floor,
        round: Math.round,
        min: Math.min,
        max: Math.max,
        abs: Math.abs,
        round5: (v) => Math.round(v / 5) * 5,
        ceil5: (v) => Math.ceil(v / 5) * 5
        };

        const fn = new Function(...Object.keys(helpers), `return ${expr};`);
        return fn(...Object.values(helpers));

    } catch (e) {
        console.error("Formula error:", expr, e);
        return str;
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { IdM_eval_formula };
}