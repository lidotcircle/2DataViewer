function SplitString(input) {
    const tokens = [];
    let currentToken = '';
    const stack = [];
    let escapeNext = false;
    let currentBracketContext = null;

    const bracketMap = {
        '(': { type: 'paren', close: ')', balance: 0 },
        '[': { type: 'bracket', close: ']', balance: 0 },
        '{': { type: 'brace', close: '}', balance: 0 }
    };

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (currentBracketContext) {
            currentBracketContext.balance += (char === currentBracketContext.open) ? 1 : 0;
            currentBracketContext.balance -= (char === currentBracketContext.close) ? 1 : 0;

            currentToken += char;

            if (currentBracketContext.balance === 0) {
                tokens.push(currentToken.slice(0, -1)); // Exclude the closing bracket
                tokens.push(char);
                currentToken = '';
                currentBracketContext = null;
            }
        } else if (stack.length > 0) {
            const context = stack[stack.length - 1];
            if (context.type === 'quote') {
                if (escapeNext) {
                    currentToken += char;
                    escapeNext = false;
                } else {
                    if (char === '\\') {
                        escapeNext = true;
                        currentToken += char;
                    } else if (char === '"') {
                        currentToken += char;
                        stack.pop();
                        tokens.push(currentToken);
                        currentToken = '';
                    } else {
                        currentToken += char;
                    }
                }
            }
        } else {
            if (char === ' ' || char === '\t' || char === '\n') {
                if (currentToken !== '') {
                    tokens.push(currentToken);
                    currentToken = '';
                }
            } else if (char === '"') {
                if (currentToken !== '') {
                    tokens.push(currentToken);
                    currentToken = '';
                }
                currentToken += char;
                stack.push({ type: 'quote' });
            } else if (bracketMap[char]) {
                if (currentToken !== '') {
                    tokens.push(currentToken);
                    currentToken = '';
                }
                tokens.push(char);
                currentBracketContext = {
                    open: char,
                    close: bracketMap[char].close,
                    balance: 1
                };
            } else if
                // ([{
                ([')', ']', '}'].includes(char)) {
                if (currentToken !== '') {
                    tokens.push(currentToken);
                    currentToken = '';
                }
                tokens.push(char);
            } else {
                currentToken += char;
            }
        }
    }

    if (currentToken !== '') {
        tokens.push(currentToken);
    }

    if (stack.length > 0 && stack[stack.length - 1].type == "quote") {
        throw "Unmatched quote";
    }

    if (currentBracketContext) {
        throw "Unmatched bracket";
    }

    return tokens.filter(t => t !== '');
}

export { SplitString }
