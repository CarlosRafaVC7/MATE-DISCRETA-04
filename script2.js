document.addEventListener('DOMContentLoaded', function () {
    const expressionInput = document.getElementById('expression');
    const variablesInput = document.getElementById('variables');
    const evaluateBtn = document.getElementById('evaluate');
    const clearBtn = document.getElementById('clear');
    const truthTableContainer = document.getElementById('truth-table-container');
    const circuitDiagram = document.getElementById('circuit-diagram');
    const simplifiedExpr = document.getElementById('simplified-expr');
    const errorMessage = document.getElementById('error-message');
    const symbolButtons = document.querySelectorAll('.symbol-btn');

    const operatorMap = {
        '¬': '¬', '~': '¬',
        '·': '∧', '*': '∧', '×': '∧', '&&': '∧',
        '+': '∨', '||': '∨',
        '→': '→', '->': '→',
        '↔': '↔', '<->': '↔'
    };

    const gateMap = {
        '¬': 'NOT',
        '∧': 'AND',
        '∨': 'OR',
        '→': 'OR',
        '↔': 'XNOR'
    };

    symbolButtons.forEach(button => {
        button.addEventListener('click', function () {
            const symbol = this.getAttribute('data-symbol');
            insertAtCursor(expressionInput, symbol);
        });
    });

    evaluateBtn.addEventListener('click', evaluateExpression);
    clearBtn.addEventListener('click', clearAll);

    function clearAll() {
        expressionInput.value = '';
        variablesInput.value = 'A, B, C';
        truthTableContainer.innerHTML = '';
        circuitDiagram.innerHTML = '';
        simplifiedExpr.innerHTML = '';
        errorMessage.textContent = '';
    }

    function insertAtCursor(field, value) {
        const startPos = field.selectionStart;
        const endPos = field.selectionEnd;
        field.value = field.value.substring(0, startPos) + value + field.value.substring(endPos);
        field.selectionStart = field.selectionEnd = startPos + value.length;
        field.focus();
    }

    function evaluateExpression() {
        errorMessage.textContent = '';
        simplifiedExpr.innerHTML = '';
        circuitDiagram.innerHTML = '';

        try {
            const expression = expressionInput.value.trim();
            // Eliminar todos los espacios para evitar errores
expressionInput.value = expressionInput.value.replace(/\s+/g, '');

            const variablesText = variablesInput.value.trim();

            if (!expression) throw new Error('Por favor ingresa una expresión lógica.');
            if (!variablesText) throw new Error('Por favor ingresa al menos una variable.');

            const variables = variablesText.split(',').map(v => v.trim()).filter(v => v.length > 0);
            if (variables.length === 0) throw new Error('Por favor ingresa al menos una variable válida.');

            const variablePattern = new RegExp(`\\b[${variables.join('')}]\\b`, 'g');
            const validChars = new RegExp(`[${escapeRegExp('¬~·*×+→↔()\\s')}]`, 'g');
            const invalidChars = expression.replace(variablePattern, '').replace(validChars, '');

            if (invalidChars.length > 0) throw new Error(`Caracteres no válidos en la expresión: ${invalidChars}`);

            let normalizedExpr = expression;
            for (const [alt, std] of Object.entries(operatorMap)) {
                const regex = new RegExp(escapeRegExp(alt), 'g');
                normalizedExpr = normalizedExpr.replace(regex, std);
            }

            let simplified = normalizeExpression(normalizedExpr);
            simplifiedExpr.innerHTML = `<strong>Expresión simplificada:</strong> ${simplified}`;

            const truthTable = generateTruthTable(simplified, variables);
            displayTruthTable(truthTable, variables, simplified);

            generateCircuitDiagram(simplified, variables);

        } catch (error) {
            errorMessage.textContent = error.message;
            console.error(error);
        }
    }

    function normalizeExpression(expr) {
        expr = expr.replace(/(.+?)→(.+?)(?=\)|$)/g, '(¬($1) ∨ ($2))');
        expr = expr.replace(/(.+?)↔(.+?)(?=\)|$)/g, '((¬($1) ∨ ($2)) ∧ (¬($2) ∨ ($1)))');
        expr = expr.replace(/¬¬([A-Z])/g, '$1');
        return expr;
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function generateTruthTable(expression, variables) {
        const rows = Math.pow(2, variables.length);
        const truthTable = [];

        for (let i = 0; i < rows; i++) {
            const row = {};
            for (let j = 0; j < variables.length; j++) {
                const variable = variables[j];
                row[variable] = !!(i & (1 << (variables.length - 1 - j)));
            }
            row['RESULT'] = evaluateLogicalExpression(expression, row);
            truthTable.push(row);
        }

        return truthTable;
    }

    function evaluateLogicalExpression(expr, context) {
        expr = expr.replace(/\s+/g, '');

        function evaluate(subExpr) {
            while (subExpr[0] === '(' && subExpr[subExpr.length - 1] === ')') {
                let balance = 0;
                let valid = true;
                for (let i = 0; i < subExpr.length; i++) {
                    if (subExpr[i] === '(') balance++;
                    if (subExpr[i] === ')') balance--;
                    if (balance === 0 && i !== subExpr.length - 1) {
                        valid = false;
                        break;
                    }
                }
                if (valid) subExpr = subExpr.slice(1, -1);
                else break;
            }

            let depth = 0, opPos = -1, op = '';
            const binaryOps = ['↔', '→', '∨', '∧'];

            for (const binaryOp of binaryOps) {
                for (let i = 0; i <= subExpr.length - binaryOp.length; i++) {
                    const part = subExpr.slice(i, i + binaryOp.length);
                    if (subExpr[i] === '(') depth++;
                    if (subExpr[i] === ')') depth--;
                    if (depth === 0 && part === binaryOp) {
                        opPos = i;
                        op = binaryOp;
                        break;
                    }
                }
                if (opPos !== -1) break;
            }

            if (opPos !== -1) {
                const left = subExpr.slice(0, opPos);
                const right = subExpr.slice(opPos + op.length);
                const leftVal = evaluate(left);
                const rightVal = evaluate(right);
                switch (op) {
                    case '∧': return leftVal && rightVal;
                    case '∨': return leftVal || rightVal;
                    case '→': return !leftVal || rightVal;
                    case '↔': return leftVal === rightVal;
                }
            }

            if (subExpr[0] === '¬') {
                return !evaluate(subExpr.slice(1));
            }

            if (context.hasOwnProperty(subExpr)) {
                return context[subExpr];
            }

            throw new Error(`Variable desconocida: ${subExpr}`);
        }

        return evaluate(expr);
    }

    function displayTruthTable(truthTable, variables, expression) {
        let html = '<table><thead><tr>';
        for (const variable of variables) html += `<th>${variable}</th>`;
        html += `<th>${expression}</th></tr></thead><tbody>`;
        for (const row of truthTable) {
            html += '<tr>';
            for (const variable of variables) html += `<td>${row[variable] ? 'V' : 'F'}</td>`;
            html += `<td>${row['RESULT'] ? 'V' : 'F'}</td></tr>`;
        }
        html += '</tbody></table>';
        truthTableContainer.innerHTML = html;
        const logicType = checkLogicType(truthTable);
html += `<div style="margin-top: 10px; font-weight: bold;">Tipo de expresión: ${logicType}</div>`;
truthTableContainer.innerHTML = html;

    }


    
    function generateCircuitDiagram(expression, variables) {
        // Limpiar el contenedor
        circuitDiagram.innerHTML = '';
        
        // Objeto para contar compuertas
        const gateCounts = {
            'NOT': 0,
            'AND': 0,
            'OR': 0,
            'NOR': 0,
            'NAND': 0,
            'XOR': 0,
            'XNOR': 0
        };
    
        // Analizar la expresión para determinar las compuertas necesarias
        const gates = [];
        const connections = [];
        let gateCount = 0;
        
        function processSubExpression(subExpr, parentGate = null, inputSide = '') {
            subExpr = subExpr.replace(/\s+/g, '');
        
            // Eliminar paréntesis externos balanceados
            while (
                subExpr[0] === '(' && 
                subExpr[subExpr.length - 1] === ')' &&
                isBalanced(subExpr.slice(1, -1))
            ) {
                subExpr = subExpr.slice(1, -1);
            }
        
            // Buscar operador principal fuera de paréntesis
            let depth = 0;
            let opPos = -1;
            let op = '';
            const binaryOps = ['↔', '→', '∨', '∧'];
        
            for (const binaryOp of binaryOps) {
                for (let i = 0; i <= subExpr.length - binaryOp.length; i++) {
                    const part = subExpr.slice(i, i + binaryOp.length);
                    const c = subExpr[i];
                    if (c === '(') depth++;
                    if (c === ')') depth--;
                    if (depth === 0 && part === binaryOp) {
                        opPos = i;
                        op = binaryOp;
                        break;
                    }
                }
                if (opPos !== -1) break;
            }
        
            if (opPos !== -1) {
                const left = subExpr.slice(0, opPos);
                const right = subExpr.slice(opPos + op.length);
                const gateId = `gate${++gateCount}`;
                
                // Determinar tipo de compuerta
                let gateType = gateMap[op];
                
                // Detectar compuertas compuestas (NOR, NAND, etc.)
                if (op === '∨' && parentGate && gates.find(g => g.id === parentGate)?.type === 'NOT') {
                    gateType = 'NOR';
                } else if (op === '∧' && parentGate && gates.find(g => g.id === parentGate)?.type === 'NOT') {
                    gateType = 'NAND';
                }
                
                gates.push({
                    id: gateId,
                    type: gateType,
                    inputs: [],
                    output: null
                });
                
                // Contar la compuerta
                gateCounts[gateType]++;
        
                const leftInput = processSubExpression(left, gateId, 'left');
                const rightInput = processSubExpression(right, gateId, 'right');
                gates.find(g => g.id === gateId).inputs = [leftInput, rightInput];
        
                if (parentGate) {
                    connections.push({
                        from: gateId,
                        to: parentGate,
                        toInput: inputSide
                    });
                }
        
                return gateId;
            }
        
            // Operador unario (¬)
            if (subExpr[0] === '¬') {
                const inner = subExpr.slice(1);
                const gateId = `gate${++gateCount}`;
        
                gates.push({
                    id: gateId,
                    type: 'NOT',
                    inputs: [],
                    output: null
                });
                
                // Contar NOT
                gateCounts.NOT++;
        
                const innerInput = processSubExpression(inner, gateId, 'single');
                gates.find(g => g.id === gateId).inputs = [innerInput];
        
                if (parentGate) {
                    connections.push({
                        from: gateId,
                        to: parentGate,
                        toInput: inputSide
                    });
                }
        
                return gateId;
            }
        
            // Variable directa
            if (variables.includes(subExpr)) {
                return subExpr;
            }
        
            throw new Error(`Expresión no reconocida: ${subExpr}`);
        }
        
        // Verifica si los paréntesis están balanceados (auxiliar)
        function isBalanced(str) {
            let balance = 0;
            for (let ch of str) {
                if (ch === '(') balance++;
                else if (ch === ')') balance--;
                if (balance < 0) return false;
            }
            return balance === 0;
        }
        
        // Procesar la expresión completa
        try {
            const outputGate = processSubExpression(expression);
            
            // Crear elemento para mostrar la información
            const infoDiv = document.createElement('div');
            infoDiv.style.marginBottom = '20px';
            infoDiv.style.padding = '10px';
            infoDiv.style.backgroundColor = '#f0f0f0';
            infoDiv.style.borderRadius = '5px';
            
            // Filtrar solo las compuertas que tienen al menos una ocurrencia
            const presentGates = Object.entries(gateCounts)
                .filter(([gate, count]) => count > 0)
                .map(([gate, count]) => `${gate}: ${count}`)
                .join(', ');
    
            infoDiv.innerHTML = `
                <p><strong>Entradas:</strong> ${variables.length}</p>
                <p><strong>Salidas:</strong> 1</p>
                <p><strong>Compuertas totales:</strong> ${gateCount}</p>
                <p><strong>Detalle de compuertas:</strong> ${presentGates || 'No se identificaron compuertas'}</p>
            `;
            
            circuitDiagram.appendChild(infoDiv);
            
            // Dibujar el diagrama del circuito
            drawCircuitDiagram(gates, connections, variables, outputGate);
            
        } catch (error) {
            errorMessage.textContent = "Error al generar el circuito: " + error.message;
        }
    }
    
    function drawCircuitDiagram(gates, connections, variables, outputGate) {
        
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '400');
        svg.setAttribute('viewBox', '0 0 800 400');
        
        // Posicionamiento
        const gateWidth = 80;
        const gateHeight = 60;
        const horizontalSpacing = 120;
        const verticalSpacing = 100;
        
        // Organizar compuertas en niveles
        const levels = [];
        const gatePositions = {};
        
        function assignLevels(gateId, level) {
            const gate = gates.find(g => g.id === gateId);
            if (!gate) return;
            
            if (!levels[level]) levels[level] = [];
            if (!levels[level].includes(gateId)) {
                levels[level].push(gateId);
            }
            
            gate.inputs.forEach(inputId => {
                assignLevels(inputId, level + 1);
            });
        }
        
        assignLevels(outputGate, 0);
        
        // Calcular posiciones
        let maxLevelHeight = 0;
        
        for (let level = levels.length - 1; level >= 0; level--) {
            const gatesInLevel = levels[level];
            const levelHeight = gatesInLevel.length * verticalSpacing;
            maxLevelHeight = Math.max(maxLevelHeight, levelHeight);
            
            const startY = (400 - levelHeight) / 2;
            
            gatesInLevel.forEach((gateId, idx) => {
                const x = 150 + (levels.length - 1 - level) * horizontalSpacing;
                const y = startY + idx * verticalSpacing;
                gatePositions[gateId] = { x, y };
            });
        }
        
        // Dibujar variables de entrada
        const inputVariables = [];
        for (const gate of gates) {
            for (const inputId of gate.inputs) {
                if (variables.includes(inputId)) {
                    inputVariables.push(inputId);
                }
            }
        }
        
        const uniqueInputs = [...new Set(inputVariables)];
        const inputLevel = levels.length;
        const inputHeight = uniqueInputs.length * verticalSpacing;
        const inputStartY = (400 - inputHeight) / 2;
        
        uniqueInputs.forEach((varId, idx) => {
            const x = 50;
            const y = inputStartY + idx * verticalSpacing;
            gatePositions[varId] = { x, y };
            
            // Dibujar círculo de entrada
            const inputCircle = document.createElementNS(svgNS, "circle");
            inputCircle.setAttribute('cx', x);
            inputCircle.setAttribute('cy', y);
            inputCircle.setAttribute('r', 10);
            inputCircle.setAttribute('fill', '#3498db');
            svg.appendChild(inputCircle);
            
            // Etiqueta
            const label = document.createElementNS(svgNS, "text");
            label.setAttribute('x', x - 15);
            label.setAttribute('y', y + 5);
            label.setAttribute('text-anchor', 'end');
            label.textContent = varId;
            svg.appendChild(label);
        });
        
        // Dibujar compuertas
        for (const gate of gates) {
            const pos = gatePositions[gate.id];
            if (!pos) continue;
            
            let gateElement;
            
            switch (gate.type) {
                case 'AND':
                    gateElement = drawANDGate(pos.x, pos.y, svgNS);
                    break;
                case 'OR':
                    gateElement = drawORGate(pos.x, pos.y, svgNS);
                    break;
                case 'NOT':
                    gateElement = drawNOTGate(pos.x, pos.y, svgNS);
                    break;
                case 'XNOR':
                    gateElement = drawXNORGate(pos.x, pos.y, svgNS);
                    break;
                default:
                    continue;
            }
            
            svg.appendChild(gateElement);
            
            // Etiqueta
            const label = document.createElementNS(svgNS, "text");
            label.setAttribute('x', pos.x);
            label.setAttribute('y', pos.y + gateHeight + 20);
            label.setAttribute('text-anchor', 'middle');
            label.textContent = gate.type;
            svg.appendChild(label);
        }
        
        // Dibujar conexiones
        for (const connection of connections) {
            const fromPos = gatePositions[connection.from];
            const toPos = gatePositions[connection.to];
            
            if (!fromPos || !toPos) continue;
            
            let fromX, fromY, toX, toY;
            
            fromX = fromPos.x + gateWidth;
            fromY = fromPos.y + gateHeight / 2;
            
            toX = toPos.x;
            
            if (connection.toInput === 'left') {
                toY = toPos.y + gateHeight / 3;
            } else if (connection.toInput === 'right') {
                toY = toPos.y + 2 * gateHeight / 3;
            } else {
                toY = toPos.y + gateHeight / 2;
            }
            
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute('x1', fromX);
            line.setAttribute('y1', fromY);
            line.setAttribute('x2', toX);
            line.setAttribute('y2', toY);
            line.setAttribute('stroke', '#333');
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
        }
        
        // Conectar variables de entrada
        for (const gate of gates) {
            for (let i = 0; i < gate.inputs.length; i++) {
                const inputId = gate.inputs[i];
                if (variables.includes(inputId)) {
                    const fromPos = gatePositions[inputId];
                    const toPos = gatePositions[gate.id];
                    
                    if (!fromPos || !toPos) continue;
                    
                    let fromX = fromPos.x + 10;
                    let fromY = fromPos.y;
                    let toX = toPos.x;
                    let toY;
                    
                    if (gate.inputs.length === 1) {
                        toY = toPos.y + gateHeight / 2;
                    } else if (i === 0) {
                        toY = toPos.y + gateHeight / 3;
                    } else {
                        toY = toPos.y + 2 * gateHeight / 3;
                    }
                    
                    const line = document.createElementNS(svgNS, "line");
                    line.setAttribute('x1', fromX);
                    line.setAttribute('y1', fromY);
                    line.setAttribute('x2', toX);
                    line.setAttribute('y2', toY);
                    line.setAttribute('stroke', '#333');
                    line.setAttribute('stroke-width', '2');
                    svg.appendChild(line);
                }
            }
        }
        
        // Dibujar salida
        const outputPos = gatePositions[outputGate];
        if (outputPos) {
            const outputX = outputPos.x + gateWidth;
            const outputY = outputPos.y + gateHeight / 2;
            
            const outputCircle = document.createElementNS(svgNS, "circle");
            outputCircle.setAttribute('cx', outputX + 20);
            outputCircle.setAttribute('cy', outputY);
            outputCircle.setAttribute('r', 10);
            outputCircle.setAttribute('fill', '#3498db');
            svg.appendChild(outputCircle);
            
            const outputLine = document.createElementNS(svgNS, "line");
            outputLine.setAttribute('x1', outputX);
            outputLine.setAttribute('y1', outputY);
            outputLine.setAttribute('x2', outputX + 20);
            outputLine.setAttribute('y2', outputY);
            outputLine.setAttribute('stroke', '#333');
            outputLine.setAttribute('stroke-width', '2');
            svg.appendChild(outputLine);
            
            const outputLabel = document.createElementNS(svgNS, "text");
            outputLabel.setAttribute('x', outputX + 40);
            outputLabel.setAttribute('y', outputY + 5);
            outputLabel.textContent = 'Salida';
            svg.appendChild(outputLabel);
        }
        
        circuitDiagram.appendChild(svg);
    }
    
    function drawANDGate(x, y, svgNS) {
        const group = document.createElementNS(svgNS, "g");
        
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute('d', `M ${x} ${y + 10} L ${x} ${y + 50} Q ${x + 40} ${y + 30} ${x} ${y + 10} Z`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#333');
        path.setAttribute('stroke-width', '2');
        group.appendChild(path);
        
        const leftLine1 = document.createElementNS(svgNS, "line");
        leftLine1.setAttribute('x1', x - 20);
        leftLine1.setAttribute('y1', y + 20);
        leftLine1.setAttribute('x2', x);
        leftLine1.setAttribute('y2', y + 20);
        leftLine1.setAttribute('stroke', '#333');
        leftLine1.setAttribute('stroke-width', '2');
        group.appendChild(leftLine1);
        
        const leftLine2 = document.createElementNS(svgNS, "line");
        leftLine2.setAttribute('x1', x - 20);
        leftLine2.setAttribute('y1', y + 40);
        leftLine2.setAttribute('x2', x);
        leftLine2.setAttribute('y2', y + 40);
        leftLine2.setAttribute('stroke', '#333');
        leftLine2.setAttribute('stroke-width', '2');
        group.appendChild(leftLine2);
        
        const rightLine = document.createElementNS(svgNS, "line");
        rightLine.setAttribute('x1', x + 60);
        rightLine.setAttribute('y1', y + 30);
        rightLine.setAttribute('x2', x + 80);
        rightLine.setAttribute('y2', y + 30);
        rightLine.setAttribute('stroke', '#333');
        rightLine.setAttribute('stroke-width', '2');
        group.appendChild(rightLine);
        
        return group;
    }
    
    function drawORGate(x, y, svgNS) {
        const group = document.createElementNS(svgNS, "g");
        
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute('d', `M ${x} ${y + 10} Q ${x + 20} ${y + 10} ${x + 30} ${y + 30} Q ${x + 20} ${y + 50} ${x} ${y + 50} Q ${x + 15} ${y + 50} ${x + 20} ${y + 40} Q ${x + 25} ${y + 30} ${x + 20} ${y + 20} Q ${x + 15} ${y + 10} ${x} ${y + 10}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#333');
        path.setAttribute('stroke-width', '2');
        group.appendChild(path);
        
        const leftLine1 = document.createElementNS(svgNS, "line");
        leftLine1.setAttribute('x1', x - 20);
        leftLine1.setAttribute('y1', y + 20);
        leftLine1.setAttribute('x2', x - 5);
        leftLine1.setAttribute('y2', y + 15);
        leftLine1.setAttribute('stroke', '#333');
        leftLine1.setAttribute('stroke-width', '2');
        group.appendChild(leftLine1);
        
        const leftLine2 = document.createElementNS(svgNS, "line");
        leftLine2.setAttribute('x1', x - 20);
        leftLine2.setAttribute('y1', y + 40);
        leftLine2.setAttribute('x2', x - 5);
        leftLine2.setAttribute('y2', y + 45);
        leftLine2.setAttribute('stroke', '#333');
        leftLine2.setAttribute('stroke-width', '2');
        group.appendChild(leftLine2);
        
        const rightLine = document.createElementNS(svgNS, "line");
        rightLine.setAttribute('x1', x + 35);
        rightLine.setAttribute('y1', y + 30);
        rightLine.setAttribute('x2', x + 55);
        rightLine.setAttribute('y2', y + 30);
        rightLine.setAttribute('stroke', '#333');
        rightLine.setAttribute('stroke-width', '2');
        group.appendChild(rightLine);
        
        return group;
    }
    
    function drawNOTGate(x, y, svgNS) {
        const group = document.createElementNS(svgNS, "g");
        
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute('d', `M ${x} ${y} L ${x + 40} ${y + 30} L ${x} ${y + 60} Z`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#333');
        path.setAttribute('stroke-width', '2');
        group.appendChild(path);
        
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute('cx', x + 50);
        circle.setAttribute('cy', y + 30);
        circle.setAttribute('r', 5);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#333');
        circle.setAttribute('stroke-width', '2');
        group.appendChild(circle);
        
        const leftLine = document.createElementNS(svgNS, "line");
        leftLine.setAttribute('x1', x - 20);
        leftLine.setAttribute('y1', y + 30);
        leftLine.setAttribute('x2', x);
        leftLine.setAttribute('y2', y + 30);
        leftLine.setAttribute('stroke', '#333');
        leftLine.setAttribute('stroke-width', '2');
        group.appendChild(leftLine);
        
        const rightLine = document.createElementNS(svgNS, "line");
        rightLine.setAttribute('x1', x + 55);
        rightLine.setAttribute('y1', y + 30);
        rightLine.setAttribute('x2', x + 75);
        rightLine.setAttribute('y2', y + 30);
        rightLine.setAttribute('stroke', '#333');
        rightLine.setAttribute('stroke-width', '2');
        group.appendChild(rightLine);
        
        return group;
    }
    
    function drawXNORGate(x, y, svgNS) {
        const group = drawORGate(x, y, svgNS);
        
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute('cx', x + 65);
        circle.setAttribute('cy', y + 30);
        circle.setAttribute('r', 5);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#333');
        circle.setAttribute('stroke-width', '2');
        group.appendChild(circle);
        
        const lines = group.getElementsByTagNameNS(svgNS, "line");
        const outputLine = lines[lines.length - 1];
        outputLine.setAttribute('x1', x + 70);
        
        return group;
    }
});
//ultimo
function checkLogicType(truthTable) {
    const results = truthTable.map(row => row.RESULT);
    if (results.every(val => val === true)) return '🔵 Tautología (siempre verdadera)';
    if (results.every(val => val === false)) return '🔴 Contradicción (siempre falsa)';
    return '🟡 Contingencia (a veces verdadera)';
}
//siu