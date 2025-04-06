// Constantes
const MAX_VARIABLES = 6; // Límite por rendimiento (2^6 = 64 filas)
const OPERATORS = {
    '¬': { prec: 4, assoc: 'right', fn: (a) => !a },
    '∧': { prec: 3, assoc: 'left', fn: (a, b) => a && b },
    '∨': { prec: 2, assoc: 'left', fn: (a, b) => a || b },
    '→': { prec: 1, assoc: 'right', fn: (a, b) => !a || b },
    '△': { prec: 2, assoc: 'left', fn: (a, b) => a !== b }, // XOR
    '↔': { prec: 1, assoc: 'left', fn: (a, b) => a === b }
};

// Función principal para generar la tabla de verdad
function generateTruthTable() {
    try {
        // Obtener inputs
        const variablesInput = document.getElementById('variables').value;
        let expression = document.getElementById('expression').value;
        const outputType = document.querySelector('input[name="outputType"]:checked').value;
        const showSteps = document.getElementById('showSteps').checked;
        
        // Procesar variables
        const variables = variablesInput.split(',')
            .map(v => v.trim())
            .filter(v => v.length > 0);
        
        if (variables.length === 0) {
            throw new Error("Por favor ingresa al menos una variable");
        }
        
        if (variables.length > MAX_VARIABLES) {
            throw new Error(`Por razones de rendimiento, el máximo es ${MAX_VARIABLES} variables`);
        }
        
        if (!expression) {
            throw new Error("Por favor ingresa una expresión lógica");
        }
        
        // Normalizar expresión
        expression = expression.replace(/{/g, '(').replace(/}/g, ')');
        
        if (!areParenthesesBalanced(expression)) {
            throw new Error("Paréntesis/llaves desbalanceados en la expresión");
        }
        
        // Generar combinaciones ordenadas
        const rows = generateOrderedCombinations(variables);
        
        // Analizar la expresión
        const parsed = parseExpression(expression, variables);
        if (!parsed.valid) {
            throw new Error("Expresión lógica no válida");
        }
        
        // Construir tabla
        let tableHTML = `<table><thead><tr>`;
        
        // Encabezados
        tableHTML += variables.map(v => `<th>${v}</th>`).join('');
        if (showSteps) {
            tableHTML += parsed.subExpressions.map(exp => `<th>${exp}</th>`).join('');
        }
        tableHTML += `<th>${parsed.finalExpression}</th></tr></thead><tbody>`;
        
        // Filas de datos
        rows.forEach(row => {
            const context = {};
            variables.forEach((v, i) => { context[v] = row[i]; });
            
            const results = {};
            if (showSteps) {
                parsed.subExpressions.forEach(exp => {
                    results[exp] = evaluateParsedExpression(exp, context);
                });
            }
            
            const finalResult = evaluateParsedExpression(parsed.finalExpression, context);
            
            tableHTML += `<tr>`;
            tableHTML += row.map(val => `<td class="${val ? 'true' : 'false'}">${formatValue(val, outputType)}</td>`).join('');
            
            if (showSteps) {
                tableHTML += parsed.subExpressions.map(exp => `
                    <td class="${results[exp] ? 'true' : 'false'} connector-cell">
                        ${formatValue(results[exp], outputType)}
                    </td>
                `).join('');
            }
            
            tableHTML += `
                <td class="${finalResult ? 'true' : 'false'} final-result">
                    ${formatValue(finalResult, outputType)}
                </td>
            </tr>`;
        });
        
        tableHTML += `</tbody></table>`;
        document.getElementById('result').innerHTML = tableHTML;
        
    } catch (error) {
        alert(error.message);
        console.error(error);
    }
}

// Función para evaluar expresiones parseadas
function evaluateParsedExpression(expr, context) {
    const tokens = shuntingYard(expr);
    const stack = [];
    
    for (const token of tokens) {
        if (token in OPERATORS) {
            const op = OPERATORS[token];
            if (token === '¬') {
                const a = stack.pop();
                stack.push(op.fn(a));
            } else {
                const b = stack.pop();
                const a = stack.pop();
                stack.push(op.fn(a, b));
            }
        } else {
            stack.push(context[token]);
        }
    }
    
    return stack[0];
}

// Algoritmo Shunting-yard para parsear expresiones
function shuntingYard(expr) {
    const output = [];
    const operators = [];
    
    const tokens = expr.match(/[∧∨¬→△↔()]|[A-Za-z]+/g) || [];
    
    for (const token of tokens) {
        if (token in OPERATORS) {
            while (operators.length > 0 && 
                   operators[operators.length-1] !== '(' &&
                   (OPERATORS[operators[operators.length-1]].prec > OPERATORS[token].prec ||
                   (OPERATORS[operators[operators.length-1]].prec === OPERATORS[token].prec &&
                    OPERATORS[token].assoc === 'left'))) {
                output.push(operators.pop());
            }
            operators.push(token);
        } else if (token === '(') {
            operators.push(token);
        } else if (token === ')') {
            while (operators.length > 0 && operators[operators.length-1] !== '(') {
                output.push(operators.pop());
            }
            operators.pop(); // Quitar el '('
        } else {
            output.push(token); // Variable
        }
    }
    
    while (operators.length > 0) {
        output.push(operators.pop());
    }
    
    return output;
}

// Función para analizar la expresión
function parseExpression(expr, variables) {
    try {
        const subExpressions = new Set();
        const tokens = shuntingYard(expr);
        
        // Verificar variables válidas
        tokens.forEach(token => {
            if (!(token in OPERATORS) && !['(', ')'].includes(token)) {
                if (!variables.includes(token)) {
                    throw new Error(`Variable no declarada: ${token}`);
                }
            }
        });
        
        // Extraer subexpresiones
        const regex = /(\([^()]+\))/g;
        let match;
        while ((match = regex.exec(expr)) !== null) {
            subExpressions.add(match[1]);
        }
        
        // Añadir componentes atómicos
        variables.forEach(v => {
            subExpressions.add(v);
            subExpressions.add(`¬${v}`);
        });
        
        return {
            valid: true,
            subExpressions: Array.from(subExpressions).sort((a, b) => a.length - b.length),
            finalExpression: expr
        };
    } catch (e) {
        return { valid: false, error: e.message };
    }
}

// Generar combinaciones ordenadas
function generateOrderedCombinations(variables) {
    const count = variables.length;
    const totalRows = Math.pow(2, count);
    const rows = [];
    
    for (let row = 0; row < totalRows; row++) {
        const combination = [];
        
        variables.forEach((_, index) => {
            const groupSize = Math.pow(2, count - index - 1);
            combination.push(Math.floor(row / groupSize) % 2 === 0);
        });
        
        rows.push(combination);
    }
    
    return rows;
}

// Funciones auxiliares
function formatValue(value, outputType) {
    if (outputType === '01') return value ? '1' : '0';
    return value ? 'V' : 'F';
}

function areParenthesesBalanced(expr) {
    let balance = 0;
    for (const char of expr) {
        if (char === '(' || char === '{') balance++;
        if (char === ')' || char === '}') balance--;
        if (balance < 0) return false;
    }
    return balance === 0;
}

function insertSymbol(symbol) {
    const input = document.getElementById('expression');
    const startPos = input.selectionStart;
    const endPos = input.selectionEnd;
    input.value = input.value.substring(0, startPos) + symbol + input.value.substring(endPos);
    input.focus();
    input.setSelectionRange(startPos + symbol.length, startPos + symbol.length);
}

function clearTable() {
    document.getElementById('result').innerHTML = '';
    document.getElementById('variables').value = 'p, q, r';
    document.getElementById('expression').value = '(p→q)△(q→p)';
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('expression').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') generateTruthTable();
    });
});